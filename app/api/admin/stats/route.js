import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { scanAllOverdue } from '@/services/overdueService';

export async function GET() {
  console.log(">>> [SERVER] API /api/admin/stats/route.js started");
  
  try {
    // 0. Passive Overdue Sync - Đảm bảo dữ liệu trễ hạn luôn mới trước khi lấy stats
    await scanAllOverdue().catch(err => console.error("Passive scan failed:", err));

    // 1. Fetch raw data from Firebase
    const [booksSnap, membersSnap, recordsSnap] = await Promise.all([
      adminDb.collection("books").get(),
      adminDb.collection("members").get(),
      adminDb.collection("borrowRecords").get()
    ]);

    // 2. Base Counts
    const totalBooks = booksSnap.size;
    const totalMembers = membersSnap.size;
    const totalInventoryQuantity = booksSnap.docs.reduce((acc, doc) => {
      const b = doc.data();
      return acc + (Number.parseInt(b?.quantity, 10) || 0);
    }, 0);
    const totalDamagedInventoryQuantity = booksSnap.docs.reduce((acc, doc) => {
      const b = doc.data();
      return acc + (Number.parseInt(b?.damagedCount, 10) || 0);
    }, 0);

    // 3. Centralized Aggregation (Multi-book aware)
    let activeBorrowsCount = 0;
    let activeBorrowedBooksForDashboard = 0; // BORROWING/ACTIVE/OVERDUE only (matches dashboard)
    let overdueBooksForDashboard = 0; // Active + dueDate < now OR status OVERDUE
    let totalRevenue = 0;
    let lostBooksCount = 0;
    let damagedBooksCount = 0;
    const lostBooksList = [];
    const damagedBooksList = [];
    const activeLoansDetails = [];
    const penaltyRecords = [];
    const bookFreq = {};
    const memberFreq = {};
    const categoryFreq = {};
    const lateUsers = {};
    const nowServer = new Date();

    // Map for book images
    const bookData = {};
    booksSnap.docs.forEach(doc => {
      const b = doc.data();
      bookData[doc.id] = b;
      const cat = b.category || 'Khác';
      categoryFreq[cat] = (categoryFreq[cat] || 0) + 1;
    });

    recordsSnap.docs.forEach(doc => {
      const record = doc.data();
      let books = record.books || [];
      const uid = record.userId || 'unknown';
      const userName = record.userName || 'Ẩn danh';
      const userPhone = record.borrowerPhone || 'N/A';
      const dueDate = record.dueDate?.toDate ? record.dueDate.toDate() : (record.dueDate ? new Date(record.dueDate) : null);

      // Fallback for legacy flat records (pre-multi-book system)
      if (books.length === 0 && record.bookId) {
        books = [{
          bookId: record.bookId,
          bookTitle: record.bookTitle,
          status: record.status,
          penaltyAmount: record.penaltyAmount,
          actualReturnDate: record.actualReturnDate || record.returnDate,
          uid: 'legacy-' + doc.id
        }];
      }

      if (uid !== 'unknown') {
        if (!memberFreq[uid]) memberFreq[uid] = { count: 0, name: userName, phone: userPhone };
        memberFreq[uid].count++;
      }

      books.forEach(book => {
        // Book popularity
        const bid = book.bookId;
        if (bid) {
          if (!bookFreq[bid]) bookFreq[bid] = { count: 0, title: book.bookTitle || 'Untitled Book' };
          bookFreq[bid].count++;
        }

        const s = (book.status || '').toUpperCase();
        const isActive = (s === 'BORROWING' || s === 'OVERDUE' || s === 'APPROVED_PENDING_PICKUP' || s === 'ACTIVE' || s === 'PARTIALLY_PICKED_UP');
        const isActiveForDashboard = (s === 'BORROWING' || s === 'OVERDUE' || s === 'ACTIVE');
        const isReturned = (s === 'RETURNED' || s === 'RETURNED_OVERDUE');
        const pAmount = Number(book.penaltyAmount) || 0;

        // 1. Active Borrows
        if (isActive) {
          activeBorrowsCount++;
          if (activeLoansDetails.length < 50) {
            activeLoansDetails.push({
              id: `${doc.id}-${book.uid || Math.random()}`,
              userName,
              bookTitle: book.bookTitle,
              dueDate: record.dueDate,
              status: s
            });
          }
        }

        // 1.1 Dashboard-aligned active/overdue (multi-book aware)
        if (isActiveForDashboard) {
          activeBorrowedBooksForDashboard++;
        }
        const isOverdueForDashboard = (s === 'OVERDUE') || (isActiveForDashboard && dueDate && dueDate < nowServer);
        if (isOverdueForDashboard) {
          overdueBooksForDashboard++;
        }
        
        // 1.5. Lost & Damaged stats
        if (!book.isResolved) {
          if (s === 'LOST') {
            lostBooksCount++;
            lostBooksList.push({
              recordId: doc.id,
              bookUid: book.uid,
              bookId: book.bookId,
              bookTitle: book.bookTitle,
              userName,
              userPhone,
              note: book.returnNote || "N/A",
              fee: Number(book.damageFee) || 0,
              date: book.actualReturnDate || record.returnDate
            });
          } else if (s === 'DAMAGED') {
            damagedBooksCount++;
            damagedBooksList.push({
              recordId: doc.id,
              bookUid: book.uid,
              bookId: book.bookId,
              bookTitle: book.bookTitle,
              userName,
              userPhone,
              note: book.returnNote || "N/A",
              fee: Number(book.damageFee) || 0,
              date: book.actualReturnDate || record.returnDate
            });
          }
        }

        // 2. Revenue & Penalty Records
        if (pAmount > 0) {
          totalRevenue += pAmount;
          penaltyRecords.push({
            id: `${doc.id}-${book.uid || Math.random()}`,
            userName,
            bookTitle: book.bookTitle,
            penaltyAmount: pAmount,
            actualReturnDate: book.actualReturnDate
          });
        }

        // 3. Late Returners (History + Current)
        const isCurrentlyLate = isActive && dueDate && dueDate < nowServer;
        const isHistoryLate = (s === 'RETURNED_OVERDUE');

        if (isCurrentlyLate || isHistoryLate) {
          if (!lateUsers[uid]) {
            lateUsers[uid] = { id: uid, name: userName, phone: userPhone, lateCount: 0, totalPenalty: 0 };
          }
          lateUsers[uid].lateCount++;
          if (isHistoryLate) lateUsers[uid].totalPenalty += pAmount;
        }
      });
    });

    // 4. Formatting Results
    const topBooks = Object.keys(bookFreq)
      .map(bid => ({ id: bid, title: bookFreq[bid].title, borrowCount: bookFreq[bid].count, image: bookData[bid]?.image || null }))
      .sort((a, b) => b.borrowCount - a.borrowCount).slice(0, 5);

    const topMembers = Object.keys(memberFreq)
      .map(uid => ({ id: uid, name: memberFreq[uid].name, phone: memberFreq[uid].phone, borrowCount: memberFreq[uid].count }))
      .sort((a, b) => b.borrowCount - a.borrowCount).slice(0, 5);

    const lateReturnersList = Object.values(lateUsers)
      .sort((a, b) => b.lateCount - a.lateCount);

    const newestBooks = booksSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .slice(0, 5);

    // Helper for robust date comparison in sorting
    const getSortTime = (val) => {
      if (!val) return 0;
      if (val.seconds) return val.seconds;
      if (val._seconds) return val._seconds;
      if (typeof val.toDate === 'function') return val.toDate().getTime() / 1000;
      return new Date(val).getTime() / 1000 || 0;
    };

    penaltyRecords.sort((a, b) => getSortTime(b.actualReturnDate) - getSortTime(a.actualReturnDate));
    newestBooks.sort((a, b) => getSortTime(b.createdAt) - getSortTime(a.createdAt));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalBooks,
          totalMembers,
          activeBorrows: activeBorrowsCount,
          totalRevenue,
          lostBooks: lostBooksCount,
          damagedBooks: damagedBooksCount,

          // Dashboard-aligned summary (kept here so dashboard + stats are consistent)
          totalInventoryQuantity,
          totalDamagedInventoryQuantity,
          activeBorrowedBooksForDashboard,
          overdueBooksForDashboard,
          totalLibraryBooksForDashboard: totalInventoryQuantity + activeBorrowedBooksForDashboard
        },
        lostBooksList,
        damagedBooksList,
        topBooks,
        topMembers,
        activeLoans: activeLoansDetails,
        categoryFreq,
        newestBooks,
        penaltyRecords,
        lateReturners: lateReturnersList
      }
    });

  } catch (error) {
    console.error(">>> [ERROR] Stats aggregation failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

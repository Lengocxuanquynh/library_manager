import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';

export async function GET() {
  console.log(">>> [SERVER] API /api/admin/stats/route.js started");
  
  try {
    // 1. Fetch raw data from Firebase
    const [booksSnap, membersSnap, recordsSnap] = await Promise.all([
      adminDb.collection("books").get(),
      adminDb.collection("members").get(),
      adminDb.collection("borrowRecords").get()
    ]);

    // 2. Base Counts
    const totalBooks = booksSnap.size;
    const totalMembers = membersSnap.size;

    // 3. Active Borrows (BORROWING, APPROVED_PENDING_PICKUP, OVERDUE)
    // Note: OVERDUE is often calculated dynamically, but we check if ReturnDate is null
    const activeRecords = recordsSnap.docs.filter(doc => {
      const data = doc.data();
      const s = data.status;
      return (s === 'BORROWING' || s === 'APPROVED_PENDING_PICKUP' || s === 'Active') && !data.returnDate;
    });
    const activeBorrowsCount = activeRecords.length;

    // 4. Revenue (Total penalties from returned books)
    const returnedRecords = recordsSnap.docs.filter(doc => doc.data().status === 'returned');
    const totalRevenue = returnedRecords.reduce((acc, doc) => acc + (Number(doc.data().penaltyAmount) || 0), 0);

    // 5. Top 5 Most Borrowed Books
    const bookFreq = {};
    recordsSnap.docs.forEach(doc => {
      const data = doc.data();
      const bid = data.bookId;
      if (!bid) return;
      if (!bookFreq[bid]) {
        bookFreq[bid] = { count: 0, title: data.bookTitle || 'Untitled Book' };
      }
      bookFreq[bid].count++;
    });

    // Map images from books collection
    const bookData = {};
    booksSnap.docs.forEach(doc => {
      bookData[doc.id] = doc.data();
    });

    const topBooks = Object.keys(bookFreq)
      .map(bid => ({
        id: bid,
        title: bookFreq[bid].title,
        borrowCount: bookFreq[bid].count,
        image: bookData[bid]?.image || null
      }))
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 5);

    // 6. Late Returners Analysis
    // Criteria: status is 'returned' AND actualReturnDate > dueDate
    const lateUsers = {};
    returnedRecords.forEach(doc => {
      const data = doc.data();
      if (data.actualReturnDate && data.dueDate) {
        // Convert Firestore Timestamps or strings to Date
        const retDate = data.actualReturnDate.toDate ? data.actualReturnDate.toDate() : new Date(data.actualReturnDate);
        const dueDate = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);

        if (retDate > dueDate) {
          const uid = data.userId || 'unknown';
          if (!lateUsers[uid]) {
            lateUsers[uid] = { 
              id: uid,
              name: data.userName || 'Unknown Member', 
              phone: data.borrowerPhone || 'N/A', 
              lateCount: 0, 
              totalPenalty: 0 
            };
          }
          lateUsers[uid].lateCount++;
          lateUsers[uid].totalPenalty += (Number(data.penaltyAmount) || 0);
        }
      }
    });

    const lateReturnersList = Object.values(lateUsers)
      .sort((a, b) => b.lateCount - a.lateCount);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalBooks,
          totalMembers,
          activeBorrows: activeBorrowsCount,
          totalRevenue
        },
        topBooks,
        lateReturners: lateReturnersList
      }
    });

  } catch (error) {
    console.error(">>> [ERROR] Stats aggregation failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

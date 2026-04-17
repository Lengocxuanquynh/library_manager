"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { formatDate, getTimestamp } from "@/lib/utils";
import styles from "../dashboard.module.css";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Helper to safely handle diverse date formats from Firestore (Timestamp, Date, or String)
  // This prevents crashes when calling toMillis() on non-Timestamp objects
  const getSafeTime = (dateObj) => {
    if (!dateObj) return 0;
    // Handle Firestore Timestamp object
    if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
    // Handle serializable Firestore Timestamp structure (common in API JSON)
    if (dateObj.seconds) return dateObj.seconds * 1000;
    if (dateObj._seconds) return dateObj._seconds * 1000;
    // Handle standard JS Date object
    if (typeof dateObj.getTime === 'function') return dateObj.getTime();
    // Fallback: Parse as Date string or number
    const t = new Date(dateObj).getTime();
    return isNaN(t) ? 0 : t;
  };

  const [stats, setStats] = useState({
    totalInventory: 0,
    activeMembers: 0,
    borrowingCount: 0,
    overdueCount: 0,
    totalLibraryBooks: 0
  });
  const [data, setData] = useState({
    recentRecords: [],
    newBooks: [],
    allRecords: [] // Store raw records for dynamic calculation
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.uid) return;
      
      try {
        const [booksRes, membersRes, recordsRes] = await Promise.all([
          fetch('/api/books'),
          fetch('/api/members'),
          fetch(`/api/admin/borrow-records?adminId=${user.uid}`)
        ]);

        const books = await booksRes.json();
        const members = await membersRes.json();
        const recordsRaw = await recordsRes.json();
        
        const records = Array.isArray(recordsRaw) ? recordsRaw : [];
        const booksArray = Array.isArray(books) ? books : [];

        // Calculate specific stats
        const borrowing = records.filter(r => r.status === 'BORROWING' || r.status === 'Active' || r.status === 'OVERDUE');
        const overdue = records.filter(r => {
          let dueDate = null;
          if (r.dueDate?._seconds) dueDate = new Date(r.dueDate._seconds * 1000);
          else if (r.dueDate?.seconds || r.dueDate?.seconds === 0) dueDate = new Date(r.dueDate.seconds * 1000);
          else if (r.dueDate) dueDate = new Date(r.dueDate);
          
          const isActive = r.status === 'Active' || r.status === 'BORROWING' || r.status === 'OVERDUE';
          return r.status === 'OVERDUE' || (isActive && dueDate && dueDate < currentTime);
        });

        // Unique readers count
        const activeBorrowerIds = new Set(borrowing.map(r => r.userId).filter(Boolean));

        const inventoryCount = booksArray.reduce((acc, b) => acc + (parseInt(b.quantity) || 0), 0);

        setStats({
          totalInventory: inventoryCount,
          activeMembers: Array.isArray(members) ? members.length : 0,
          borrowingCount: borrowing.length,
          overdueCount: overdue.length,
          totalLibraryBooks: inventoryCount + borrowing.length
        });

        // Sách mới nhập (last 5)
        const sortedBooks = Array.isArray(books) ? [...books].sort((a,b) => getSafeTime(b.createdAt) - getSafeTime(a.createdAt)) : [];

        setData({
          recentRecords: records.slice(0, 5),
          newBooks: sortedBooks.slice(0, 5),
          allRecords: records
        });
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.uid) {
      fetchDashboardData();
    }
  }, [user]);

  // DYNAMIC CALCULATIONS (Computed values that react to currentTime)
  const borrowing = data.allRecords.filter(r => r.status === 'BORROWING' || r.status === 'Active' || r.status === 'OVERDUE');
  const overdueRecords = data.allRecords.filter(r => {
    let dueDate = null;
    if (r.dueDate?._seconds) dueDate = new Date(r.dueDate._seconds * 1000);
    else if (r.dueDate?.seconds || r.dueDate?.seconds === 0) dueDate = new Date(r.dueDate.seconds * 1000);
    else if (r.dueDate) dueDate = new Date(r.dueDate);
    
    const isActive = r.status === 'Active' || r.status === 'BORROWING' || r.status === 'OVERDUE';
    return r.status === 'OVERDUE' || (isActive && dueDate && dueDate < currentTime);
  });

  const borrowingCount = borrowing.length;
  const overdueCount = overdueRecords.length;
  const totalLibraryBooks = stats.totalInventory + borrowingCount;

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Dashboard (Tổng quan)</h1>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <Link href="/admin/books" className="btn-outline">Quản lý Sách</Link>
          <Link href="/admin/transactions" className="btn-primary">Quản lý Phiếu mượn</Link>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.5)' }}>Đang tải dữ liệu tổng quan...</div>
      ) : (
        <>

          {/* Stats Grid */}
          <div className={styles.grid} style={{ marginBottom: '2.5rem' }}>
            <div className={styles.card} style={{ borderLeft: '4px solid #bb86fc' }} key="total-books">
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Tổng số sách thư viện</div>
              <div style={{ fontSize: "2.8rem", fontWeight: "900", color: "#fff" }}>{totalLibraryBooks}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Hàng tồn + Đang mượn</div>
            </div>
            
            <div className={styles.card} style={{ borderLeft: '4px solid #03dac6' }} key="inventory">
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Số sách tồn kho</div>
              <div style={{ fontSize: "2.8rem", fontWeight: "900", color: "#fff" }}>{stats.totalInventory}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Sẵn sàng cho mượn</div>
            </div>

            <div className={styles.card} style={{ borderLeft: '4px solid #27c93f' }} key="borrowing">
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Số sách đang mượn</div>
              <div style={{ fontSize: "2.8rem", fontWeight: "900", color: "#fff" }}>{borrowingCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Sách đã ra khỏi kho</div>
            </div>

            <div className={styles.card} style={{ borderLeft: '4px solid #ff5f56' }} key="overdue">
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Số sách quá hạn</div>
              <div style={{ fontSize: "2.8rem", fontWeight: "900", color: "#fff" }}>{overdueCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Cần thu hồi gấp</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
             {/* Recent Activity Table */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Phiếu mượn gần đây</h2>
                <Link href="/admin/transactions" style={{ fontSize: '0.85rem', color: '#bb86fc', textDecoration: 'none' }}>Tất cả →</Link>
              </div>

              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Người mượn</th>
                      <th style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Ngày mượn</th>
                      <th style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Hạn trả</th>
                      <th style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentRecords.map(activity => {
                      const isActive = activity.status === 'Active' || activity.status === 'BORROWING' || activity.status === 'OVERDUE';
                      const isOverdue = activity.status === 'OVERDUE' || (isActive && getTimestamp(activity.dueDate) < currentTime.getTime() && getTimestamp(activity.dueDate) !== 0);
                      return (
                        <tr key={activity.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                            <div style={{ fontWeight: '600' }}>{activity.userName || activity.memberName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{activity.bookTitle}</div>
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                            {formatDate(activity.borrowDate)}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                            {formatDate(activity.dueDate)}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{
                              padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700',
                              background: isOverdue ? 'rgba(255,95,86,0.15)' : activity.status === 'RETURNED_OVERDUE' ? 'rgba(255,176,32,0.15)' : activity.status === 'RETURNED' ? 'rgba(255,255,255,0.06)' : 'rgba(39,201,63,0.15)',
                              color: isOverdue ? '#ff5f56' : activity.status === 'RETURNED_OVERDUE' ? '#ffb020' : activity.status === 'RETURNED' ? 'rgba(255,255,255,0.4)' : '#27c93f'
                            }}>
                              {isOverdue ? 'QUÁ HẠN' : activity.status === 'RETURNED_OVERDUE' ? 'TRẢ MUỘN' : activity.status === 'RETURNED' ? 'ĐÃ TRẢ' : 'MƯỢN'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* New Books List */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem' }}>Sách mới nhập gần đây</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {data.newBooks.map(book => (
                  <Link href="/admin/books" key={book.id} style={{ display: 'flex', gap: '1rem', textDecoration: 'none', color: 'inherit', padding: '0.5rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ width: '40px', height: '60px', borderRadius: '4px', background: `url(${book.coverImage || '/placeholder.png'}) center/cover` }}></div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>{book.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{book.author} • {book.category}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


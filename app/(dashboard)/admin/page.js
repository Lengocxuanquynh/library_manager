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
    totalLibraryBooks: 0,
    totalDamaged: 0,
    totalTitles: 0
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
        const [booksRes, membersRes, recordsRes, statsRes] = await Promise.all([
          fetch('/api/books'),
          fetch('/api/members'),
          fetch(`/api/admin/borrow-records?adminId=${user.uid}`),
          fetch('/api/admin/stats')
        ]);

        if (!booksRes.ok || !membersRes.ok || !recordsRes.ok || !statsRes.ok) {
           throw new Error("Một hoặc nhiều yêu cầu dữ liệu thất bại");
        }

        const [books, members, recordsRaw, statsData] = await Promise.all([
          booksRes.json().catch(() => ({ error: 'Invalid JSON' })),
          membersRes.json().catch(() => ({ error: 'Invalid JSON' })),
          recordsRes.json().catch(() => ({ error: 'Invalid JSON' })),
          statsRes.json().catch(() => ({ error: 'Invalid JSON' }))
        ]);
        
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

        const remoteStats = statsData.success ? statsData.data.summary : null;

        // Use remote stats if available for perfect synchronization
        if (remoteStats) {
          setStats({
            totalInventory: remoteStats.totalInventory,
            activeMembers: remoteStats.totalMembers,
            borrowingCount: remoteStats.activeBorrows,
            overdueCount: remoteStats.overdueCount || 0,
            totalLibraryBooks: remoteStats.totalCopies,
            totalDamaged: remoteStats.damagedBooks,
            totalTitles: remoteStats.totalTitles
          });
        } else {
          // Fallback local calculation
          const inventoryCount = booksArray.reduce((acc, b) => acc + (parseInt(b.quantity) || 0), 0);
          setStats({
            totalInventory: inventoryCount,
            activeMembers: Array.isArray(members) ? members.length : 0,
            borrowingCount: 0,
            overdueCount: 0,
            totalLibraryBooks: inventoryCount,
            totalDamaged: 0,
            totalTitles: booksArray.length
          });
        }

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
  const borrowingRecords = data.allRecords.filter(r => r.status === 'BORROWING' || r.status === 'Active' || r.status === 'OVERDUE');
  const overdueRecords = data.allRecords.filter(r => {
    let dueDate = null;
    if (r.dueDate?._seconds) dueDate = new Date(r.dueDate._seconds * 1000);
    else if (r.dueDate?.seconds || r.dueDate?.seconds === 0) dueDate = new Date(r.dueDate.seconds * 1000);
    else if (r.dueDate) dueDate = new Date(r.dueDate);
    
    const isActive = r.status === 'Active' || r.status === 'BORROWING' || r.status === 'OVERDUE';
    return r.status === 'OVERDUE' || (isActive && dueDate && dueDate < currentTime);
  });

  // Đếm tổng số cuốn sách thực tế trong các phiếu đang mượn/quá hạn
  const totalBooksBorrowing = borrowingRecords.reduce((acc, r) => acc + (Array.isArray(r.books) ? r.books.length : 1), 0);
  const totalBooksOverdue = overdueRecords.reduce((acc, r) => acc + (Array.isArray(r.books) ? r.books.filter(b => {
      // Chỉ đếm những cuốn chưa trả trong phiếu quá hạn
      const status = b.status || r.status;
      return !['RETURNED', 'RETURNED_OVERDUE', 'LOST'].includes(status);
  }).length : 1), 0);

  const borrowingCount = totalBooksBorrowing;
  const overdueCount = totalBooksOverdue;
  const totalLibraryBooks = stats.totalInventory + borrowingCount;

  return (
    <div style={{ animation: 'fadeIn 0.8s ease-out' }}>
      {/* Hero Section */}
      <div className={styles.heroCard}>
        <div style={{ zIndex: 1 }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '0.5rem', letterSpacing: '-1px' }}>
            Chào mừng trở lại, {user?.displayName?.split(' ')[0] || "Admin"}!
          </h1>
          <p style={{ opacity: 0.7, fontSize: '1.1rem', maxWidth: '500px' }}>
            Hôm nay là {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}. 
            Hệ thống đang hoạt động ổn định với {borrowingCount} phiếu mượn đang hoạt động.
          </p>
        </div>
        <div style={{ fontSize: '5rem', opacity: 0.2, fontWeight: '900', userSelect: 'none' }}>
          {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className={styles.headerArea} style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Chỉ số quan trọng</h2>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <Link href="/admin/books" className="btn-outline" style={{ borderRadius: '12px' }}>Kho Sách</Link>
          <Link href="/admin/transactions" className="btn-primary" style={{ borderRadius: '12px', boxShadow: '0 4px 15px rgba(187, 134, 252, 0.3)' }}>Phiếu mượn</Link>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Đang tối ưu dữ liệu...</div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className={styles.grid} style={{ marginBottom: '3rem' }}>
            <div className={styles.card} style={{ background: 'linear-gradient(135deg, rgba(187, 134, 252, 0.1), transparent)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Tổng đầu sách</div>
              <div className={styles.statValue}>{stats.totalTitles}</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.4, marginTop: '0.5rem' }}>~ {totalLibraryBooks} cuốn vật lý</div>
              <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', fontSize: '5rem', opacity: 0.03 }}>📖</div>
            </div>
            
            <div className={styles.card} style={{ background: 'linear-gradient(135deg, rgba(3, 218, 198, 0.1), transparent)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Đang mượn</div>
              <div className={styles.statValue}>{borrowingCount}</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.4, marginTop: '0.5rem' }}>{Math.round((borrowingCount/totalLibraryBooks)*100) || 0}% tỉ lệ lưu thông</div>
              <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', fontSize: '5rem', opacity: 0.03 }}>📤</div>
            </div>

            <div className={styles.card} style={{ background: 'linear-gradient(135deg, rgba(255, 95, 86, 0.1), transparent)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Quá hạn</div>
              <div className={styles.statValue} style={{ color: '#ff5f56', WebkitTextFillColor: '#ff5f56' }}>{overdueCount}</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.4, marginTop: '0.5rem' }}>Cần xử lý ngay</div>
              <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', fontSize: '5rem', opacity: 0.03 }}>⚠️</div>
            </div>

            <div className={styles.card} style={{ background: 'linear-gradient(135deg, rgba(255, 176, 32, 0.1), transparent)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Hư hỏng</div>
              <div className={styles.statValue}>{stats.totalDamaged}</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.4, marginTop: '0.5rem' }}>Đang chờ bảo trì</div>
              <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', fontSize: '5rem', opacity: 0.03 }}>🔧</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2.5rem' }}>
             {/* Recent Activity */}
            <div className={styles.card} style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Hoạt động gần đây</h3>
                <Link href="/admin/transactions" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>Xem tất cả</Link>
              </div>

              <div className="table-container" style={{ border: 'none' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', opacity: 0.3, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ paddingBottom: '1rem' }}>Độc giả</th>
                      <th style={{ paddingBottom: '1rem' }}>Hạn trả</th>
                      <th style={{ paddingBottom: '1rem', textAlign: 'right' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentRecords.map(activity => {
                      const isActive = activity.status === 'Active' || activity.status === 'BORROWING' || activity.status === 'OVERDUE';
                      const isOverdue = activity.status === 'OVERDUE' || (isActive && getTimestamp(activity.dueDate) < currentTime.getTime() && getTimestamp(activity.dueDate) !== 0);
                      return (
                        <tr key={activity.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '1.2rem 0' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{activity.userName || activity.memberName}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{activity.bookTitle}</div>
                          </td>
                          <td style={{ padding: '1.2rem 0', fontSize: '0.85rem', opacity: 0.6 }}>
                            {formatDate(activity.dueDate)}
                          </td>
                          <td style={{ padding: '1.2rem 0', textAlign: 'right' }}>
                            <span className={styles.badge} style={{
                              background: isOverdue ? 'rgba(255,95,86,0.1)' : activity.status === 'RETURNED' ? 'rgba(255,255,255,0.05)' : activity.status === 'APPROVED_PENDING_PICKUP' ? 'rgba(187, 134, 252, 0.1)' : 'rgba(39,201,63,0.1)',
                              color: isOverdue ? '#ff5f56' : activity.status === 'RETURNED' ? 'rgba(255,255,255,0.4)' : activity.status === 'APPROVED_PENDING_PICKUP' ? '#bb86fc' : '#27c93f',
                              border: `1px solid ${isOverdue ? 'rgba(255,95,86,0.2)' : 'transparent'}`
                            }}>
                              {isOverdue ? 'Trễ hạn' : activity.status === 'RETURNED' ? 'Đã trả' : activity.status === 'APPROVED_PENDING_PICKUP' ? 'Chờ lấy sách' : 'Đang mượn'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory Shortcut */}
            <div className={styles.card} style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '2rem' }}>Sách mới nhập</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {data.newBooks.map(book => (
                  <Link href="/admin/books" key={book.id} style={{ display: 'flex', gap: '1.2rem', textDecoration: 'none', color: 'inherit', padding: '0.75rem', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid transparent', transition: 'all 0.3s' }}>
                    <div style={{ width: '45px', height: '65px', borderRadius: '8px', background: `url(${book.coverImage || '/placeholder.png'}) center/cover`, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700' }}>{book.title}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{book.author}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(187, 134, 252, 0.1)', color: 'var(--primary)', borderRadius: '4px' }}>{book.category}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <Link href="/admin/books" className="btn-outline" style={{ width: '100%', marginTop: '1.5rem', borderRadius: '12px', textAlign: 'center', fontSize: '0.9rem' }}>Quản lý kho sách</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


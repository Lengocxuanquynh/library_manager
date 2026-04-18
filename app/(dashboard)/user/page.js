"use client";

import { useEffect, useState } from "react";
import { useAuth, useLucid } from "../../../components/AuthProvider";
import styles from "../dashboard.module.css";
import Link from "next/link";
import { formatDate, getTimestamp } from "../../../lib/utils";
import RenewalModal from "../../../components/RenewalModal";

export default function UserDashboard() {
  const { user } = useAuth();
  const lucid = useLucid();
  const [transactions, setTransactions] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDashboardTab, setActiveDashboardTab] = useState("borrow"); // borrow hoặc inbox
  const [notifications, setNotifications] = useState([]);
  const [profileData, setProfileData] = useState(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedRenewBook, setSelectedRenewBook] = useState(null);

  const loadRecords = async () => {
    if (!user) return;
    try {
      const [resRecords, resReqs, resNotis, resProfile] = await Promise.all([
        fetch(`/api/borrow-records/user/${user.uid}`),
        fetch(`/api/borrow-requests/user/${user.uid}`),
        fetch(`/api/user/notifications?userId=${user.uid}`),
        fetch(`/api/user/profile/${user.uid}`)
      ]);
      const dataRecords = await resRecords.json();
      const dataReqs = await resReqs.json();
      const dataNotis = await resNotis.json();
      const dataProfile = await resProfile.json();
      
      setTransactions(Array.isArray(dataRecords) ? dataRecords : []);
      setNotifications(Array.isArray(dataNotis) ? dataNotis : []);
      setProfileData(dataProfile);
      // Chỉ lấy các yêu cầu đang chờ duyệt hoặc bị từ chối ở danh sách Req
      setPendingRequests(Array.isArray(dataReqs) ? dataReqs.filter(r => r.status === 'PENDING' || r.status === 'REJECTED') : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notiId) => {
    try {
      await fetch('/api/user/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notiId, userId: user.uid })
      });
      // Cập nhật local state nhanh
      setNotifications(prev => prev.map(n => n.id === notiId ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/user/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };


  const handleCancelRequest = async (requestId) => {
    const ok = await lucid.confirm({
      title: "Hủy yêu cầu mượn",
      message: "Bạn có chắc chắn muốn HỦY LƯU toàn bộ yêu cầu mượn này?",
      confirmText: "Hủy đơn",
      cancelText: "Quay lại"
    });
    if (!ok) return;

    const res = await fetch('/api/user/cancel-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, userId: user.uid })
    });
    if (res.ok) {
      loadRecords();
    } else {
      const result = await res.json();
      lucid.alert({
        title: "Lỗi hệ thống",
        message: result.error || "Lỗi khi hủy yêu cầu"
      });
    }
  };

  const handleRemoveBookFromRequest = async (requestId, bookId) => {
    const ok = await lucid.confirm({
      title: "Rút sách khỏi đơn",
      message: "Bạn có muốn rút cuốn sách này khỏi danh sách mượn không?",
      confirmText: "Đồng ý",
      cancelText: "Hủy"
    });
    if (!ok) return;

    const res = await fetch('/api/user/remove-book-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, userId: user.uid, bookId })
    });
    if (res.ok) {
      loadRecords();
    } else {
      const result = await res.json();
      lucid.alert({
        title: "Lỗi",
        message: result.error || "Lỗi khi gỡ sách"
      });
    }
  };

  useEffect(() => {
    if (user?.uid) {
      loadRecords();
    }
  }, [user]);

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Xin chào, {user?.displayName || "Độc giả"}</h1>
      </div>

      {/* TABS NAVBAR */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setActiveDashboardTab("borrow")}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeDashboardTab === "borrow" ? "#bb86fc" : "rgba(255,255,255,0.4)",
            fontSize: '1rem',
            fontWeight: '700',
            cursor: 'pointer',
            paddingBottom: '0.5rem',
            borderBottom: activeDashboardTab === "borrow" ? '2px solid #bb86fc' : 'none',
            transition: 'all 0.3s'
          }}
        >
          📖 Mượn Trả
        </button>
        <button 
          onClick={() => setActiveDashboardTab("inbox")}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeDashboardTab === "inbox" ? "#bb86fc" : "rgba(255,255,255,0.4)",
            fontSize: '1rem',
            fontWeight: '700',
            cursor: 'pointer',
            paddingBottom: '0.5rem',
            borderBottom: activeDashboardTab === "inbox" ? '2px solid #bb86fc' : 'none',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          📥 Hộp Thư
          {notifications.filter(n => !n.isRead).length > 0 && (
            <span style={{
              background: '#ff5f56',
              color: 'white',
              fontSize: '0.7rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '99px',
              minWidth: '18px',
              textAlign: 'center'
            }}>
              {notifications.filter(n => !n.isRead).length}
            </span>
          )}
        </button>
      </div>

      {activeDashboardTab === "borrow" ? (
        <>
          {transactions.some(tx => (tx.status === 'BORROWING' || tx.status === 'OVERDUE' || tx.status === 'PARTIALLY_RETURNED') && (tx.dueDate?.toDate ? tx.dueDate.toDate() : new Date(tx.dueDate)) < new Date()) && (
            <div style={{
              background: 'rgba(255, 95, 86, 0.1)',
              border: '1px solid rgba(255, 95, 86, 0.3)',
              borderRadius: '12px',
              padding: '1.2rem',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: '#ff5f56'
            }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div>
                <h4 style={{ margin: 0, fontWeight: '700' }}>Cảnh báo: Bạn đang có sách QUÁ HẠN!</h4>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>Vui lòng hoàn trả sách sớm nhất có thể để tránh phát sinh phí bồi thường và khôi phục quyền mượn sách mới.</p>
              </div>
            </div>
          )}

          <div className={styles.grid}>
            <div className={styles.card} style={{ 
              gridColumn: '1 / -1', 
              background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '2rem'
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
                
                {/* LEFT: IDENTITY HEADER */}
                <div style={{ flex: '1 1 300px', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ 
                    width: '80px', height: '80px', borderRadius: '24px', 
                    background: 'linear-gradient(135deg, #bb86fc, #9965f4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem', fontWeight: '900', color: '#fff',
                    boxShadow: '0 10px 20px rgba(187, 134, 252, 0.3)'
                  }}>
                    {(user?.displayName || "U")[0]}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>
                      {user?.displayName || "Chưa cập nhật"}
                    </h3>
                    <div style={{ 
                      marginTop: '0.5rem',
                      fontSize: '0.9rem', 
                      color: '#bb86fc', 
                      fontFamily: 'monospace', 
                      background: 'rgba(187, 134, 252, 0.1)', 
                      padding: '0.3rem 0.8rem', 
                      borderRadius: '99px', 
                      border: '1px solid rgba(187, 134, 252, 0.2)',
                      fontWeight: 'bold',
                      display: 'inline-block',
                      letterSpacing: '1px'
                    }}>
                      🆔 {user?.memberCode || user?.uid}
                    </div>
                  </div>
                </div>

                {/* MIDDLE: CONTACT INFO PILLS */}
                <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📧</div>
                    <div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.4, fontWeight: '700', textTransform: 'uppercase' }}>Email</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{user?.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📞</div>
                    <div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.4, fontWeight: '700', textTransform: 'uppercase' }}>Số Điện Thoại</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{user?.phone || "Chưa cập nhật"}</div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: PRIVILEGE MONITOR */}
                <div style={{ 
                  flex: '1 1 280px', 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '1.25rem', 
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>QUYỀN LỢI GIA HẠN</span>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: profileData?.lastOverdueAt ? '#ff5f56' : '#27c93f', 
                      fontWeight: '800',
                      background: profileData?.lastOverdueAt ? 'rgba(255, 95, 86, 0.1)' : 'rgba(39, 201, 63, 0.1)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px'
                    }}>
                      {profileData?.lastOverdueAt ? 'TẠM KHÓA' : 'HOẠT ĐỘNG'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.8rem' }}>
                    <span style={{ fontSize: '2rem', fontWeight: '900', color: '#fff' }}>
                      {3 - (profileData?.renewalCount || 0)}
                    </span>
                    <span style={{ fontSize: '1rem', opacity: 0.4, fontWeight: '600' }}>/ 3 lượt dự trữ</span>
                  </div>

                  {/* PROGRESS BAR */}
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
                    <div style={{ 
                      width: `${((3 - (profileData?.renewalCount || 0)) / 3) * 100}%`, 
                      height: '100%', 
                      background: 'linear-gradient(90deg, #bb86fc, #27c93f)',
                      borderRadius: '10px',
                      transition: 'width 0.5s ease-out'
                    }} />
                  </div>

                  {profileData?.lastOverdueAt ? (
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#ff5f56', fontStyle: 'italic', lineHeight: '1.4' }}>
                      ● Bị khóa do có lịch sử trả trễ trong 3 tháng qua.
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', lineHeight: '1.4' }}>
                      ● Tự động tặng 1 lượt sau mỗi 3 tháng không vi phạm.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.card} style={{ gridColumn: '1 / -1' }}>
              <h3>Yêu Cầu Mượn Sách (Chờ Admin Duyệt)</h3>
              {loading ? (
                <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.5)' }}>Đang tải dữ liệu...</p>
              ) : pendingRequests.length === 0 ? (
                <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                  Bạn không có yêu cầu nào đang chờ xử lý.
                </p>
              ) : (
                <div style={{ marginTop: '1.5rem', overflowX: 'auto', marginBottom: '2rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Mã Đơn</th>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Sách Mượn</th>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Yêu Cầu</th>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody>
                       {pendingRequests.map(req => {
                        const reqBooks = req.books || [];
                        const isRejected = req.status === 'REJECTED';
                        return (
                          <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '1rem', verticalAlign: 'top', fontFamily: 'monospace' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                  {req.id.slice(0, 8)}
                                </span>
                                {!isRejected && (
                                  <button 
                                    onClick={() => handleCancelRequest(req.id)}
                                    style={{ background: 'rgba(255, 95, 86, 0.1)', color: '#ff5f56', border: '1px solid rgba(255, 95, 86, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                  >
                                    Thùng rác
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <ul style={{ margin: 0, paddingLeft: '1rem', color: '#fff' }}>
                                {reqBooks.map((b, i) => (
                                  <li key={i} style={{ marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '0.3rem' }}>
                                      <span>{b.bookTitle}</span>
                                      {!isRejected && (
                                        <button 
                                          onClick={() => handleRemoveBookFromRequest(req.id, b.bookId)}
                                          title="Bỏ sách này"
                                          style={{ background: 'transparent', color: 'rgba(255, 255, 255, 0.3)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%' }}
                                          onMouseOver={(e) => {e.target.style.color = '#ff5f56'; e.target.style.background = 'rgba(255, 95, 86, 0.1)';}}
                                          onMouseOut={(e) => {e.target.style.color = 'rgba(255, 255, 255, 0.3)'; e.target.style.background = 'transparent';}}
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </td>
                            <td style={{ padding: '1rem', verticalAlign: 'top' }}>{formatDate(req.createdAt)}</td>
                            <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                              <span style={{
                                background: isRejected ? 'rgba(255, 95, 86, 0.2)' : 'rgba(255, 152, 0, 0.2)',
                                color: isRejected ? '#ff5f56' : '#ff9800',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                fontWeight: '600'
                              }}>
                                {isRejected ? 'BỊ TỪ CHỐI' : 'CHỜ DUYỆT'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <h3 style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                Sách Đang Mượn & Lịch Sử (Đã Duyệt)
              </h3>
              {loading ? (
                <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.5)' }}>Đang tải dữ liệu...</p>
              ) : transactions.length === 0 ? (
                <div>
                  <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                    Bạn chưa (hoặc từng) mượn cuốn sách nào. Hãy khám phá thư viện ngay!
                  </p>
                  <Link href="/user/books" className="btn-primary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>Xem Danh Mục</Link>
                </div>
              ) : (
                <div style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Sách</th>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Mượn</th>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Hết Hạn</th>
                        {transactions.some(tx => {
                          const due = getTimestamp(tx.dueDate);
                          return (due && new Date() > new Date(due) && tx.status !== 'RETURNED' && tx.status !== 'RETURNED_OVERDUE');
                        }) && (
                          <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Tiền Phạt</th>
                        )}
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody>
                       {transactions.map(tx => {
                        const books = tx.books || (tx.bookId ? [{ bookId: tx.bookId, bookTitle: tx.bookTitle, status: tx.status }] : []);
                        const isPendingPickup = tx.status === 'APPROVED_PENDING_PICKUP';
                        const isOverdue = tx.status === 'OVERDUE';
                        const isLost = tx.status === 'LOST_LOCKED';
                        const isPartiallyReturned = tx.status === 'PARTIALLY_RETURNED';

                        return (
                          <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {books.map((b, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.8rem', borderRadius: '6px' }}>
                                    <span style={{ fontWeight: '500', color: (b.status === 'RETURNED' || b.status === 'RETURNED_OVERDUE') ? 'rgba(255,255,255,0.3)' : '#fff' }}>
                                      {b.bookTitle}
                                    </span>
                                    {(b.status === 'RETURNED' || b.status === 'RETURNED_OVERDUE') && (
                                      <span style={{ fontSize: '0.75rem', color: '#27c93f', fontStyle: 'italic' }}>✓ Đã trả</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '1rem', verticalAlign: 'top' }}>{formatDate(tx.borrowDate)}</td>
                            <td style={{ padding: '1rem', verticalAlign: 'top' }}>{formatDate(tx.dueDate)}</td>
                            {transactions.some(t => {
                               const d = getTimestamp(t.dueDate);
                               return (d && new Date() > new Date(d) && t.status !== 'RETURNED' && t.status !== 'RETURNED_OVERDUE');
                             }) && (
                               <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                                 {(() => {
                                   const dueMs = getTimestamp(tx.dueDate);
                                   if (!dueMs || new Date().getTime() <= dueMs || tx.status === 'RETURNED' || tx.status === 'RETURNED_OVERDUE') return null;
                                   
                                   const diffMs = new Date().getTime() - dueMs;
                                   const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                                   const fine = diffDays * 5000;
                                   if (fine <= 0) return null;

                                   return (
                                     <div style={{ color: '#ff5f56', fontWeight: '700', fontSize: '1.1rem' }}>
                                       {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(fine)}
                                       <div style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: '500' }}>
                                         ({diffDays} ngày trễ)
                                       </div>
                                     </div>
                                   );
                                 })()}
                               </td>
                             )}
                            <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                 <span style={{
                                  background: isLost ? 'rgba(255, 10, 10, 0.2)'
                                    : isOverdue ? 'rgba(255, 95, 86, 0.2)' 
                                    : isPendingPickup ? 'rgba(187, 134, 252, 0.2)' 
                                    : isPartiallyReturned ? 'rgba(39, 201, 63, 0.1)'
                                    : tx.status === 'BORROWING' ? 'rgba(39, 201, 63, 0.2)' 
                                    : 'rgba(255, 255, 255, 0.1)',
                                  color: isLost ? '#ff3131'
                                    : isOverdue ? '#ff5f56' 
                                    : isPendingPickup ? '#bb86fc' 
                                    : isPartiallyReturned ? '#27c93f'
                                    : tx.status === 'BORROWING' ? '#27c93f'
                                    : '#aaa',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  fontWeight: '800',
                                  textAlign: 'center',
                                  border: isLost ? '1px solid rgba(255, 49, 49, 0.4)' : 'none'
                                }}>
                                  {isLost ? 'BỊ KHÓA / MẤT SÁCH'
                                    : isOverdue ? 'QUÁ HẠN' 
                                    : isPendingPickup ? 'CHỜ LẤY SÁCH' 
                                    : isPartiallyReturned ? 'ĐANG TRẢ DẦN'
                                    : tx.status === 'BORROWING' ? 'ĐANG MƯỢN'
                                    : 'ĐÃ TRẢ HẾT'}
                                </span>
                                
                                {(tx.status === 'BORROWING' || tx.status === 'PARTIALLY_RETURNED') && !tx.isRenewed && !isOverdue && !isLost && (
                                  <button
                                    onClick={() => {
                                      setSelectedRenewBook({
                                        ...tx,
                                        bookTitle: books.map(b => b.bookTitle).join(", "),
                                        dueDateFormatted: formatDate(tx.dueDate)
                                      });
                                      setIsRenewModalOpen(true);
                                    }}
                                    style={{
                                      background: 'rgba(187, 134, 252, 0.1)',
                                      color: '#bb86fc',
                                      border: '1px solid rgba(187, 134, 252, 0.3)',
                                      padding: '0.3rem 0.5rem',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      fontWeight: '600',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => {e.target.style.background = 'rgba(187, 134, 252, 0.2)'}}
                                    onMouseOut={(e) => {e.target.style.background = 'rgba(187, 134, 252, 0.1)'}}
                                  >
                                    ⏳ Gia hạn
                                  </button>
                                )}
                                {tx.isRenewed && (
                                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                                    (Đã gia hạn)
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Link href="/user/books" className="btn-outline" style={{ marginTop: '1.5rem', display: 'inline-block' }}>Tìm Sách Khác</Link>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* INBOX TAB */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Thông báo từ hệ thống</h3>
            {notifications.some(n => !n.isRead) && (
              <button 
                onClick={markAllAsRead}
                style={{ background: 'transparent', border: '1px solid rgba(187,134,252,0.3)', color: '#bb86fc', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Đánh dấu tất cả là đã đọc
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className={styles.card} style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              Hộp thư của bạn hiện đang trống.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {notifications.map(noti => {
                const colors = {
                  info: { bg: 'rgba(0, 188, 212, 0.05)', border: 'rgba(0, 188, 212, 0.2)', accent: '#00bcd4' },
                  success: { bg: 'rgba(39, 201, 63, 0.05)', border: 'rgba(39, 201, 63, 0.2)', accent: '#27c93f' },
                  warning: { bg: 'rgba(255, 152, 0, 0.05)', border: 'rgba(255, 152, 0, 0.2)', accent: '#ff9800' },
                  error: { bg: 'rgba(255, 95, 86, 0.05)', border: 'rgba(255, 95, 86, 0.2)', accent: '#ff5f56' }
                };
                const theme = colors[noti.type] || colors.info;

                return (
                  <div 
                    key={noti.id} 
                    onClick={() => !noti.isRead && markAsRead(noti.id)}
                    style={{
                      background: theme.bg,
                      border: `1px solid ${noti.isRead ? 'rgba(255,255,255,0.05)' : theme.border}`,
                      borderRadius: '16px',
                      padding: '1.5rem',
                      display: 'flex',
                      gap: '1.5rem',
                      position: 'relative',
                      cursor: noti.isRead ? 'default' : 'pointer',
                      opacity: noti.isRead ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {!noti.isRead && (
                      <div style={{
                        position: 'absolute', top: '10px', right: '10px',
                        width: '8px', height: '8px', background: theme.accent, borderRadius: '50%'
                      }} />
                    )}
                    <div style={{ 
                      flexShrink: 0, width: '45px', height: '45px', borderRadius: '12px', 
                      background: noti.isRead ? 'rgba(255,255,255,0.05)' : theme.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: noti.isRead ? 'rgba(255,255,255,0.2)' : '#fff', fontSize: '1.2rem'
                    }}>
                      {noti.type === 'success' ? '✓' : noti.type === 'error' ? '✕' : noti.type === 'warning' ? '!' : 'i'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <h4 style={{ margin: 0, color: noti.isRead ? 'rgba(255,255,255,0.5)' : '#fff' }}>{noti.title}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>{formatDate(noti.createdAt, true)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}>
                        {noti.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedRenewBook && (
        <RenewalModal
          isOpen={isRenewModalOpen}
          onClose={() => setIsRenewModalOpen(false)}
          book={selectedRenewBook}
          userId={user?.uid}
          onSuccess={loadRecords}
        />
      )}
    </div>
  );
}

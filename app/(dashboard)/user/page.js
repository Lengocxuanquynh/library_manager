"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import styles from "../dashboard.module.css";
import Link from "next/link";
import { formatDate } from "../../../lib/utils";

export default function UserDashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = async () => {
    if (!user) return;
    try {
      const [resRecords, resReqs] = await Promise.all([
        fetch(`/api/borrow-records/user/${user.uid}`),
        fetch(`/api/borrow-requests/user/${user.uid}`)
      ]);
      const dataRecords = await resRecords.json();
      const dataReqs = await resReqs.json();
      
      setTransactions(Array.isArray(dataRecords) ? dataRecords : []);
      // Chỉ lấy các yêu cầu đang chờ duyệt hoặc bị từ chối ở danh sách Req
      setPendingRequests(Array.isArray(dataReqs) ? dataReqs.filter(r => r.status === 'PENDING' || r.status === 'REJECTED') : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };


  const handleCancelRequest = async (requestId) => {
    if (!confirm("Bạn có chắc chắn muốn HỦY LƯU toàn bộ yêu cầu mượn này?")) return;
    const res = await fetch('/api/user/cancel-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, userId: user.uid })
    });
    if (res.ok) {
      loadRecords();
    } else {
      const result = await res.json();
      alert(result.error || "Lỗi khi hủy yêu cầu");
    }
  };

  const handleRemoveBookFromRequest = async (requestId, bookId) => {
    if (!confirm("Rút cuốn sách này khỏi danh sách mượn?")) return;
    const res = await fetch('/api/user/remove-book-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, userId: user.uid, bookId })
    });
    if (res.ok) {
      loadRecords();
    } else {
      const result = await res.json();
      alert(result.error || "Lỗi khi gỡ sách");
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
        <div className={styles.card}>
          <h3>Thông Tin Cá Nhân</h3>
          <div style={{ marginTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.5, fontWeight: '500' }}>Họ Tên</span>
              <div style={{ fontSize: '1rem', color: '#fff' }}>{user?.displayName || "Chưa cập nhật"}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.5, fontWeight: '500' }}>Email</span>
              <div style={{ fontSize: '1rem', color: '#fff' }}>{user?.email}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.5, fontWeight: '500' }}>Mã Độc Giả</span>
              <div style={{ 
                fontSize: '1.2rem', 
                color: '#fff', 
                fontFamily: 'monospace', 
                background: 'linear-gradient(135deg, rgba(187, 134, 252, 0.2), rgba(153, 101, 244, 0.2))', 
                padding: '0.6rem 1rem', 
                borderRadius: '8px', 
                border: '1px solid rgba(187, 134, 252, 0.3)',
                fontWeight: 'bold',
                display: 'inline-block',
                width: 'fit-content',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                letterSpacing: '2px'
              }}>
                {user?.memberCode || user?.uid}
              </div>
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
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                   {transactions.map(tx => {
                    const books = tx.books || (tx.bookId ? [{ bookId: tx.bookId, bookTitle: tx.bookTitle, status: tx.status }] : []);
                    const isPendingPickup = tx.status === 'APPROVED_PENDING_PICKUP';
                    const isOverdue = tx.status === 'OVERDUE';
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
                        <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                          <span style={{
                            background: isOverdue ? 'rgba(255, 95, 86, 0.2)' 
                              : isPendingPickup ? 'rgba(187, 134, 252, 0.2)' 
                              : isPartiallyReturned ? 'rgba(39, 201, 63, 0.1)'
                              : tx.status === 'BORROWING' ? 'rgba(39, 201, 63, 0.2)' 
                              : 'rgba(255, 255, 255, 0.1)',
                            color: isOverdue ? '#ff5f56' 
                              : isPendingPickup ? '#bb86fc' 
                              : isPartiallyReturned ? '#27c93f'
                              : tx.status === 'BORROWING' ? '#27c93f'
                              : '#aaa',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}>
                            {isOverdue ? 'QUÁ HẠN' 
                              : isPendingPickup ? 'CHỜ LẤY SÁCH' 
                              : isPartiallyReturned ? 'ĐANG TRẢ DẦN'
                              : tx.status === 'BORROWING' ? 'ĐANG MƯỢN'
                              : 'ĐÃ TRẢ HẾT'}
                          </span>
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
    </div>
  );
}

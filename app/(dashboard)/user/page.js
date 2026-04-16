"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import styles from "../dashboard.module.css";
import Link from "next/link";
import { formatDate } from "../../../lib/utils";

export default function UserDashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/borrow-records/user/${user.uid}`);
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (recordId, bookId) => {
    if (confirm("Xác nhận trả cuốn sách này?")) {
      const res = await fetch('/api/return-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, bookId, userId: user.uid })
      });
      if (res.ok) {
        loadRecords();
      } else {
        const result = await res.json();
        alert(result.error || "Có lỗi xảy ra khi gọi API trả sách.");
      }
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
              <div style={{ fontSize: '0.9rem', color: '#fff', wordBreak: 'break-all', fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {user?.uid}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.card} style={{ gridColumn: '1 / -1' }}>
          <h3>Sách Đang Mượn & Lịch Sử</h3>
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
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hành Động</th>
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
                                {(b.status === 'BORROWING' || (isOverdue && b.status !== 'RETURNED')) && (
                                  <button 
                                    onClick={() => handleReturn(tx.id, b.bookId)} 
                                    style={{ background: 'rgba(39, 201, 63, 0.1)', color: '#27c93f', border: '1px solid rgba(39, 201, 63, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                  >
                                    Trả Sách
                                  </button>
                                )}
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
                        <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                          {isPendingPickup ? (
                            <span style={{ color: '#bb86fc', fontSize: '0.85rem', fontStyle: 'italic' }}>Đến thư viện lấy sách</span>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>—</span>
                          )}
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

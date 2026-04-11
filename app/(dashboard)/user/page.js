"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "../dashboard.module.css";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

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
          <div style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            <p><strong>Họ Tên:</strong> {user?.displayName}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Mã Độc Giả:</strong> {user?.uid}</p>
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
                    const isActive = tx.status === 'BORROWING' || tx.status === 'OVERDUE';

                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{tx.bookTitle}</td>
                        <td style={{ padding: '1rem' }}>{formatDate(tx.borrowDate)}</td>
                        <td style={{ padding: '1rem' }}>{formatDate(tx.dueDate)}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            background: tx.status === 'OVERDUE' ? 'rgba(255, 95, 86, 0.2)' : tx.status === 'BORROWING' ? 'rgba(39, 201, 63, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                            color: tx.status === 'OVERDUE' ? '#ff5f56' : tx.status === 'BORROWING' ? '#27c93f' : '#aaa',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem'
                          }}>
                            {tx.status === 'BORROWING' ? 'Đang Mượn' : (tx.status === 'OVERDUE' ? 'Quá Hạn' : 'Đã Trả')}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {isActive ? (
                            <button onClick={() => handleReturn(tx.id, tx.bookId)} style={{ background: 'rgba(39, 201, 63, 0.1)', color: '#27c93f', border: '1px solid rgba(39, 201, 63, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer' }}>Trả Sách</button>
                          ) : (
                            <span style={{ color: '#666', fontSize: '0.9rem' }}>N/A</span>
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

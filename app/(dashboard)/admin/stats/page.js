"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";
import { useAuth } from "@/components/AuthProvider";

export default function AdminStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalBorrowed: 0,
    totalMembers: 0,
    overdue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user?.uid) return;
      try {
        const [booksRes, membersRes, recordsRes] = await Promise.all([
          fetch('/api/books'),
          fetch('/api/members'),
          fetch(`/api/admin/borrow-records?adminId=${user.uid}`)
        ]);

        const books = await booksRes.json();
        const members = await membersRes.json();
        const records = await recordsRes.json();

        const borrowing = Array.isArray(records) ? records.filter(r => r.status === 'BORROWING' || r.status === 'Active') : [];
        const now = new Date();
        const overdue = borrowing.filter(r => {
          const dueDate = r.dueDate?.toDate ? r.dueDate.toDate() : (r.dueDate ? new Date(r.dueDate) : null);
          return dueDate && dueDate < now;
        });

        setStats({
          totalBooks: Array.isArray(books) ? books.length : 0,
          totalBorrowed: borrowing.length,
          totalMembers: Array.isArray(members) ? members.length : 0,
          overdue: overdue.length
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [user]);

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Thống Kê Chi Tiết</h1>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Đang phân tích dữ liệu...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>Hiệu suất cho mượn</div>
            <div style={{ fontSize: '2rem', fontWeight: '800' }}>{((stats.totalBorrowed / (stats.totalBooks || 1)) * 100).toFixed(1)}%</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '0.5rem' }}>Số sách đang lưu thông trên tổng kho</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>Tỷ lệ quá hạn</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: stats.overdue > 0 ? '#ff5f56' : '#27c93f' }}>
              {((stats.overdue / (stats.totalBorrowed || 1)) * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '0.5rem' }}>Sách chưa trả đúng hạn</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>Độc giả trung bình</div>
            <div style={{ fontSize: '2rem', fontWeight: '800' }}>{(stats.totalBorrowed / (stats.totalMembers || 1)).toFixed(2)}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.4, marginTop: '0.5rem' }}>Số cuốn mượn trên mỗi độc giả</div>
          </div>
        </div>
      )}
    </div>
  );
}

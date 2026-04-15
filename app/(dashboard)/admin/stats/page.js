"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";
import { useAuth } from "@/components/AuthProvider";

export default function AdminStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    topBooks: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user?.uid) return;
      try {
        const recordsRes = await fetch(`/api/admin/borrow-records?adminId=${user.uid}`);
        const records = await recordsRes.json();

        // Top books calculation
        const counts = {};
        if (Array.isArray(records)) {
          records.forEach(r => {
            if (r.bookTitle) {
              counts[r.bookTitle] = (counts[r.bookTitle] || 0) + 1;
            }
          });
        }
        
        const topBooks = Object.entries(counts)
          .map(([title, count]) => ({ title, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setStats({
          topBooks
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
    <div style={{ paddingBottom: '3rem' }}>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Thống Kê Chi Tiết</h1>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Đang phân tích dữ liệu...</p>
      ) : (
        <>
          <div style={{ 
            background: 'rgba(255,255,255,0.03)', 
            padding: '2rem', 
            borderRadius: '16px', 
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)'
          }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ color: '#bb86fc' }}>★</span> Sách Được Mượn Nhiều Nhất
            </h2>
            
            {stats.topBooks.length === 0 ? (
              <p style={{ opacity: 0.4, fontSize: '0.9rem', fontStyle: 'italic' }}>Chưa có dữ liệu mượn trả.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {stats.topBooks.map((book, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem',
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.03)'
                  }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: idx === 0 ? 'linear-gradient(135deg, #ffb020, #f8d800)' : 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.9rem',
                      fontWeight: '800',
                      color: idx === 0 ? '#000' : 'rgba(255,255,255,0.5)'
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#fff' }}>{book.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.2rem' }}>
                        Tổng cộng {book.count} lượt mượn
                      </div>
                    </div>
                    <div style={{ width: '120px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${(book.count / stats.topBooks[0].count) * 100}%`, 
                        height: '100%', 
                        background: 'var(--primary)',
                        boxShadow: '0 0 10px rgba(187,134,252,0.5)'
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

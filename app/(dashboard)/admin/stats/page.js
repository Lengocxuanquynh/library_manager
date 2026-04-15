"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";
import { toast } from "sonner";

export default function AdminStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to safely handle diverse date formats from Firestore (Timestamp, Date, or String)
  // This prevents crashes when calling toMillis() on non-Timestamp objects
  const getSafeTime = (dateObj) => {
    if (!dateObj) return 0;
    // Handle Firestore Timestamp object
    if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
    // Handle serializable Firestore Timestamp structure
    if (dateObj.seconds) return dateObj.seconds * 1000;
    if (dateObj._seconds) return dateObj._seconds * 1000;
    // Handle standard JS Date object
    if (typeof dateObj.getTime === 'function') return dateObj.getTime();
    // Fallback: Parse as Date string
    return new Date(dateObj).getTime() || 0;
  };

  useEffect(() => {
    async function fetchDashboardData() {
      console.log(">>> [CLIENT] Fetching dashboard data...");
      try {
        const res = await fetch('/api/admin/stats');
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          throw new Error(json.error || "Lỗi không xác định");
        }
      } catch (error) {
        console.error(">>> [CLIENT ERROR]", error);
        toast.error("Không thể tải dữ liệu thống kê từ máy chủ.");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
  };

  const formatNumber = (val) => {
    return Number(val || 0).toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ height: '40px', width: '250px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '2rem', animation: 'skeleton-pulse 1.5s infinite' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: '160px', background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', animation: 'skeleton-pulse 1.5s infinite' }}></div>
          ))}
        </div>
        <style jsx>{`
          @keyframes skeleton-pulse {
            0% { opacity: 0.5; }
            50% { opacity: 0.2; }
            100% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  const { summary, topBooks, lateReturners } = data || { summary: {}, topBooks: [], lateReturners: [] };

  return (
    <div style={{ color: '#fff', paddingBottom: '3rem' }}>
      <div className={styles.headerArea} style={{ marginBottom: '2.5rem' }}>
        <h1 className={styles.pageTitle}>Thống Kê Hệ Thống</h1>
        <p style={{ opacity: 0.5, fontSize: '0.9rem', marginTop: '0.5rem' }}>Dữ liệu tổng hợp thời gian thực từ thư viện</p>
      </div>

      {/* Overview Cards Area */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <StatCard 
          title="Tổng số sách" 
          value={formatNumber(summary.totalBooks)} 
          sub="Đầu sách trong thư viện" 
          color="#6366f1"
          svg={
            <>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </>
          }
        />
        <StatCard 
          title="Độc giả" 
          value={formatNumber(summary.totalMembers)} 
          sub="Thành viên đã đăng ký" 
          color="#a855f7"
          svg={
            <>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </>
          }
        />
        <StatCard 
          title="Đang mượn" 
          value={formatNumber(summary.activeBorrows)} 
          sub="Sách chưa hoàn trả" 
          color="#f59e0b"
          svg={
            <>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </>
          }
        />
        <StatCard 
          title="Tiền phạt" 
          value={formatCurrency(summary.totalRevenue)} 
          sub="Phí bồi thường thu hồi" 
          color="#10b981"
          svg={
            <>
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </>
          }
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
        {/* Top Books Table */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)', padding: '1.5rem', backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '10px', borderRadius: '12px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Top 5 Sách Mượn Nhiều</h3>
          </div>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', opacity: 0.4, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Sách</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Lượt mượn</th>
                </tr>
              </thead>
              <tbody>
                {topBooks.length > 0 ? topBooks.map((book) => (
                  <tr key={book.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }} className="table-row">
                    <td style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '36px', height: '50px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                        {book.image ? <img src={book.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg></div>}
                      </div>
                      <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{book.title}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <span style={{ color: '#6366f1', fontWeight: '700', fontSize: '1rem' }}>{formatNumber(book.borrowCount)}</span>
                    </td>
                  </tr>
                )) : <tr><td colSpan="2" style={{ padding: '2rem', textAlign: 'center', opacity: 0.3 }}>Chưa có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Late Members Table */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)', padding: '1.5rem', backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '10px', borderRadius: '12px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Độc giả cần lưu ý (Trễ hạn)</h3>
          </div>
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', opacity: 0.4, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Độc giả</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Lần trễ</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Tổng phạt</th>
                </tr>
              </thead>
              <tbody>
                {lateReturners.length > 0 ? lateReturners.slice(0, 5).map((user) => (
                  <tr key={user.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }} className="table-row">
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{user.name}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{user.phone}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>
                        {user.lateCount}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: '#ff5f56' }}>
                      {formatCurrency(user.totalPenalty)}
                    </td>
                  </tr>
                )) : <tr><td colSpan="3" style={{ padding: '2rem', textAlign: 'center', opacity: 0.3 }}>Không có độc giả nào trễ hạn</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
        .table-row:hover {
          background: rgba(255,255,255,0.02);
        }
        @media (max-width: 768px) {
          .table-responsive {
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
}

function StatCard({ title, value, sub, color, svg }) {
  return (
    <div className="stat-card" style={{
      background: 'rgba(255,255,255,0.03)',
      padding: '1.5rem',
      borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.08)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.3s ease, border-color 0.3s ease',
      cursor: 'default'
    }}>
      <div style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ 
          width: '44px', height: '44px', background: `${color}15`, color: color, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '12px', marginBottom: '1.25rem'
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {svg}
          </svg>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontWeight: '500', marginBottom: '0.25rem' }}>{title}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.3, marginTop: '0.5rem' }}>{sub}</div>
      </div>
      
      {/* Glow Effect */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-10%',
        width: '100px',
        height: '100px',
        background: color,
        filter: 'blur(50px)',
        opacity: 0.05,
        borderRadius: '50%'
      }}></div>
      
      <style jsx>{`
        .stat-card:hover {
          transform: translateY(-5px);
          border-color: ${color}40;
        }
      `}</style>
    </div>
  );
}

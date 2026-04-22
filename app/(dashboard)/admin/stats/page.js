"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";
import { toast } from "sonner";

export default function AdminStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'books', 'members', 'borrows', 'revenue', 'damaged', 'lost'
  const [restoring, setRestoring] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null); // { type: 'book'|'member', data: any }

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
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    console.log(">>> [CLIENT] Fetching/Refreshing dashboard data...");
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error(`Máy chủ phản hồi lỗi (${res.status})`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else throw new Error(json.error || "Lỗi không xác định");
    } catch (error) {
      console.error(">>> [CLIENT ERROR]", error);
      toast.error(error.message || "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBook = async (item, actionType) => {
    try {
      setRestoring(true);
      const res = await fetch('/api/admin/books/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: item.recordId,
          bookUid: item.bookUid,
          bookId: item.bookId,
          actionType: actionType
        })
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        await fetchDashboardData(); // Làm mới dữ liệu
      } else {
        toast.error(json.error || "Không thể khôi phục sách.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setRestoring(false);
    }
  };

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
    <div style={{ color: '#fff', paddingBottom: '3rem', animation: 'fadeIn 0.8s ease-out' }}>
      
      {/* Selected Entity Detail View (New Style) */}
      {selectedEntity && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          onClick={() => setSelectedEntity(null)}
        >
          <div 
            className={styles.card}
            style={{ maxWidth: '600px', width: '100%', background: 'rgba(30, 30, 35, 0.95)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                {selectedEntity.type === 'book' ? '📖 Thông tin Sách' : '👤 Hồ sơ Độc giả'}
              </h2>
              <button onClick={() => setSelectedEntity(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', opacity: 0.5 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
                {selectedEntity.type === 'book' && selectedEntity.data.image && (
                   <img src={selectedEntity.data.image} style={{ width: '120px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                )}
                <div>
                   <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>{selectedEntity.data.name || selectedEntity.data.title}</h3>
                   <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>{selectedEntity.type === 'book' ? `Mã sách: ${selectedEntity.data.id}` : `Liên hệ: ${selectedEntity.data.phone}`}</p>
                </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', opacity: 0.8 }}>
                  {selectedEntity.type === 'book' 
                    ? `Cuốn sách này đã được mượn tổng cộng ${selectedEntity.data.borrowCount} lần. Đây là một trong những đầu sách thu hút độc giả nhất.`
                    : `Độc giả này đã có ${selectedEntity.data.lateCount} lần trả sách trễ hạn với tổng phí bồi thường là ${formatCurrency(selectedEntity.data.totalPenalty)}.`}
                </p>
            </div>
            <button onClick={() => setSelectedEntity(null)} className="btn-primary" style={{ width: '100%', marginTop: '2rem', borderRadius: '12px' }}>Đóng cửa sổ</button>
          </div>
        </div>
      )}

      {/* Detail Modals System (Upgraded Layout) */}
      {activeModal && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          onClick={() => setActiveModal(null)}
        >
          <div 
            style={{ 
              background: 'rgba(20, 20, 25, 0.98)', 
              borderRadius: '30px', 
              width: '100%', 
              maxWidth: '900px', 
              maxHeight: '85vh', 
              border: '1px solid rgba(255,255,255,0.1)', 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 30px 60px rgba(0,0,0,0.6)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                {activeModal === 'books' && '📊 Phân tích Kho Sách'}
                {activeModal === 'members' && '⭐ Độc giả Tích cực'}
                {activeModal === 'borrows' && '⏳ Danh sách Đang mượn'}
                {activeModal === 'revenue' && '💸 Chi tiết Phí bồi thường'}
                {activeModal === 'damaged' && '🟠 Sách bị hư hỏng'}
                {activeModal === 'lost' && '🔴 Sách bị báo mất'}
              </h2>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer', opacity: 0.3 }}>×</button>
            </div>
            
            <div style={{ padding: '2.5rem', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ opacity: 0.3, fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {activeModal === 'borrows' && (
                      <>
                        <th style={{ padding: '1rem' }}>Độc giả</th>
                        <th style={{ padding: '1rem' }}>Tên sách</th>
                        <th style={{ padding: '1rem' }}>Hạn trả</th>
                      </>
                    )}
                    {activeModal === 'members' && (
                      <>
                        <th style={{ padding: '1rem' }}>Độc giả</th>
                        <th style={{ padding: '1rem' }}>SĐT</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Lượt mượn</th>
                      </>
                    )}
                    {activeModal === 'revenue' && (
                      <>
                        <th style={{ padding: '1rem' }}>Độc giả</th>
                        <th style={{ padding: '1rem' }}>Sách</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Tiền phạt</th>
                      </>
                    )}
                    {(activeModal === 'damaged' || activeModal === 'lost') && (
                      <>
                        <th style={{ padding: '1rem' }}>Độc giả / Sách</th>
                        <th style={{ padding: '1rem' }}>Tình trạng</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Thao tác</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeModal === 'books' && (
                    <tr>
                      <td colSpan="3" style={{ padding: '1rem' }}>
                        <div style={{ display: 'grid', gap: '2rem' }}>
                          <div>
                            <h4 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--primary)' }}>📊 Phân bổ theo Thể loại</h4>
                            <div style={{ display: 'grid', gap: '1.2rem' }}>
                              {Object.entries(data?.categoryFreq || {}).sort((a,b) => b[1]-a[1]).map(([cat, count], idx) => {
                                const percent = Math.round((count / data.summary.totalTitles) * 100);
                                const colors = ['#6366f1', '#a855f7', '#03dac6', '#f59e0b', '#ef4444'];
                                const color = colors[idx % colors.length];
                                return (
                                  <div key={cat}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                      <span>{cat}</span>
                                      <span style={{ opacity: 0.6 }}>{count} đầu sách ({percent}%)</span>
                                    </div>
                                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                                      <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: '10px', boxShadow: `0 0 10px ${color}33` }}></div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <div>
                            <h4 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--primary)' }}>🆕 Sách mới cập nhật</h4>
                            <div style={{ display: 'grid', gap: '0.8rem' }}>
                              {data?.newestBooks?.map(b => (
                                <div key={b.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <div style={{ fontWeight: '600' }}>{b.title}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{b.author}</div>
                                  </div>
                                  <div style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'rgba(187,134,252,0.1)', color: 'var(--primary)', borderRadius: '6px' }}>{b.category}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {activeModal === 'revenue' && data?.penaltyRecords?.map(rec => (
                    <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '1.2rem 1rem', fontWeight: '600' }}>{rec.userName}</td>
                      <td style={{ padding: '1.2rem 1rem', opacity: 0.6, fontSize: '0.9rem' }}>{rec.bookTitle}</td>
                      <td style={{ padding: '1.2rem 1rem', textAlign: 'right', color: '#10b981', fontWeight: '800' }}>{formatCurrency(rec.penaltyAmount)}</td>
                    </tr>
                  ))}
                  {activeModal === 'borrows' && data?.activeLoans?.map(loan => (
                    <tr key={loan.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '1.2rem 1rem', fontWeight: '600' }}>{loan.userName}</td>
                      <td style={{ padding: '1.2rem 1rem', color: 'var(--primary)' }}>{loan.bookTitle}</td>
                      <td style={{ padding: '1.2rem 1rem', opacity: 0.5 }}>{new Date(getSafeTime(loan.dueDate)).toLocaleDateString('vi-VN')}</td>
                    </tr>
                  ))}
                  {activeModal === 'members' && data?.topMembers?.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '1.2rem 1rem', fontWeight: '700' }}>{m.name}</td>
                      <td style={{ padding: '1.2rem 1rem', opacity: 0.5 }}>{m.phone}</td>
                      <td style={{ padding: '1.2rem 1rem', textAlign: 'right', color: 'var(--primary)', fontWeight: '800' }}>{m.borrowCount}</td>
                    </tr>
                  ))}
                  {activeModal === 'damaged' && data?.damagedBooksList?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '1.2rem 1rem' }}>
                        <div style={{ fontWeight: '700' }}>{item.bookTitle}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{item.userName}</div>
                      </td>
                      <td style={{ padding: '1.2rem 1rem' }}>
                        <div style={{ fontSize: '0.85rem' }}>{item.note}</div>
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '700' }}>Phí: {formatCurrency(item.fee)}</div>
                      </td>
                      <td style={{ padding: '1.2rem 1rem', textAlign: 'right' }}>
                        <button disabled={restoring} onClick={() => handleRestoreBook(item, 'RENEWED')} style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>Đổi mới</button>
                      </td>
                    </tr>
                  ))}
                  {activeModal === 'lost' && data?.lostBooksList?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '1.2rem 1rem' }}>
                        <div style={{ fontWeight: '700' }}>{item.bookTitle}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{item.userName}</div>
                      </td>
                      <td style={{ padding: '1.2rem 1rem' }}>
                        <div style={{ fontSize: '0.85rem' }}>{item.note}</div>
                        <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '700' }}>Phí: {formatCurrency(item.fee)}</div>
                      </td>
                      <td style={{ padding: '1.2rem 1rem', textAlign: 'right' }}>
                        <button disabled={restoring} onClick={() => handleRestoreBook(item, 'RESTOCKED')} style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid #6366f1', background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>Bổ sung</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className={styles.headerArea} style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 className={styles.pageTitle} style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>Thống Kê Hệ Thống</h1>
          <p style={{ opacity: 0.5, fontSize: '1rem' }}>Phân tích dữ liệu vận hành thư viện thời gian thực</p>
        </div>
      </div>

      {/* Overview Cards Area */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '3.5rem' }}>
        <StatCard 
          title="Đầu sách" 
          value={formatNumber(summary.totalTitles)} 
          sub={`~ ${formatNumber(summary.totalCopies)} cuốn vật lý`} 
          color="#6366f1"
          onClick={() => setActiveModal('books')}
          icon="📚"
        />
        <StatCard 
          title="Độc giả" 
          value={formatNumber(summary.totalMembers)} 
          sub="Thành viên đã đăng ký" 
          color="#a855f7"
          onClick={() => setActiveModal('members')}
          icon="👥"
        />
        <StatCard 
          title="Đang mượn" 
          value={formatNumber(summary.activeBorrows)} 
          sub="Sách chưa hoàn trả" 
          color="#03dac6"
          onClick={() => setActiveModal('borrows')}
          icon="📤"
        />
        <StatCard 
          title="Sách hỏng" 
          value={formatNumber(summary.damagedBooks)} 
          sub="Cần bảo trì/thay thế" 
          color="#f59e0b"
          onClick={() => setActiveModal('damaged')}
          icon="🔧"
        />
        <StatCard 
          title="Sách mất" 
          value={formatNumber(summary.lostBooks)} 
          sub="Báo thất lạc" 
          color="#ef4444"
          onClick={() => setActiveModal('lost')}
          icon="❌"
        />
        <StatCard 
          title="Tiền phạt" 
          value={formatCurrency(summary.totalRevenue)} 
          sub="Tổng phí thu hồi" 
          color="#10b981"
          onClick={() => setActiveModal('revenue')}
          icon="💰"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2.5rem' }}>
        {/* Category Breakdown Progress Bars */}
        <div className={styles.card} style={{ padding: '2.5rem' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <span style={{ fontSize: '1.5rem' }}>📊</span> Cơ cấu Thể loại Sách
          </h3>
          <div style={{ display: 'grid', gap: '1.8rem' }}>
            {Object.entries(data?.categoryFreq || {}).sort((a,b) => b[1]-a[1]).map(([cat, count], idx) => {
              const percent = Math.round((count / data.summary.totalTitles) * 100);
              const colors = ['#6366f1', '#a855f7', '#03dac6', '#f59e0b', '#ef4444'];
              const color = colors[idx % colors.length];
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem', fontWeight: '600' }}>
                    <span>{cat}</span>
                    <span style={{ opacity: 0.7 }}>{count} cuốn ({percent}%)</span>
                  </div>
                  <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${percent}%`, 
                      background: `linear-gradient(90deg, ${color}, ${color}88)`, 
                      borderRadius: '10px',
                      boxShadow: `0 0 10px ${color}44`
                    }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Books Highlights */}
        <div className={styles.card} style={{ padding: '2.5rem' }}>
           <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <span style={{ fontSize: '1.5rem' }}>🔥</span> Top Sách Được Mượn Nhiều
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {topBooks.map((book, idx) => (
              <div 
                key={book.id} 
                onClick={() => setSelectedEntity({ type: 'book', data: book })}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1.25rem', 
                  padding: '1rem', 
                  background: 'rgba(255,255,255,0.02)', 
                  borderRadius: '18px',
                  border: idx === 0 ? '1px solid rgba(187, 134, 252, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              >
                <div style={{ position: 'relative' }}>
                  <div style={{ width: '45px', height: '65px', borderRadius: '8px', background: `url(${book.image || '/placeholder.png'}) center/cover`, boxShadow: '0 4px 15px rgba(0,0,0,0.4)' }}></div>
                  <div style={{ 
                    position: 'absolute', top: '-8px', left: '-8px', width: '24px', height: '24px', 
                    background: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.1)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '900', color: '#000'
                  }}>
                    {idx + 1}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1rem', fontWeight: '700' }}>{book.title}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{book.borrowCount} lượt mượn</div>
                </div>
                {idx === 0 && <span style={{ fontSize: '1.2rem' }}>⭐</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, color, icon, onClick }) {
  return (
    <div className={styles.card} onClick={onClick} style={{ cursor: 'pointer', padding: '1.5rem' }}>
      <div style={{ 
        width: '40px', height: '40px', background: `${color}15`, color: color, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '12px', marginBottom: '1.25rem', fontSize: '1.2rem'
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{title}</div>
      <div className={styles.statValue} style={{ fontSize: '2rem', color: '#fff', WebkitTextFillColor: '#fff' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '0.5rem' }}>{sub}</div>
      <div style={{ position: 'absolute', right: '1.5rem', bottom: '1.5rem', opacity: 0.2, fontSize: '0.8rem' }}>→</div>
    </div>
  );
}

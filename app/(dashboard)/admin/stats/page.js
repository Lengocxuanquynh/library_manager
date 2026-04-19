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
    <div style={{ color: '#fff', paddingBottom: '3rem' }}>
      <div className={styles.headerArea} style={{ marginBottom: '2.5rem' }}>
        <h1 className={styles.pageTitle}>Thống Kê Hệ Thống</h1>
        <p style={{ opacity: 0.5, fontSize: '0.9rem', marginTop: '0.5rem' }}>Dữ liệu tổng hợp thời gian thực từ thư viện</p>
      </div>

      {selectedEntity && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          onClick={() => setSelectedEntity(null)}
        >
          <div 
            style={{ 
              background: 'rgba(30, 30, 32, 0.95)', 
              borderRadius: '24px', 
              width: '100%', 
              maxWidth: '600px', 
              border: '1px solid rgba(255,255,255,0.1)', 
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem' }}>
                {selectedEntity.type === 'book' ? '📖 Thông tin Sách' : '👤 Hồ sơ Độc giả'}
              </h2>
              <button onClick={() => setSelectedEntity(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer', opacity: 0.5 }}>×</button>
            </div>
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {selectedEntity.type === 'book' && selectedEntity.data.image && (
                   <img src={selectedEntity.data.image} style={{ width: '100px', borderRadius: '12px' }} />
                )}
                <div>
                   <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{selectedEntity.data.name || selectedEntity.data.title}</h3>
                   <p style={{ opacity: 0.6 }}>{selectedEntity.type === 'book' ? `ID: ${selectedEntity.data.id}` : `SĐT: ${selectedEntity.data.phone}`}</p>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.6' }}>
                  {selectedEntity.type === 'book' 
                    ? `Cuốn sách này đã được mượn tổng cộng ${selectedEntity.data.borrowCount} lần. Đây là một trong những đầu sách thu hút độc giả nhất của thư viện.`
                    : `Độc giả này đã có ${selectedEntity.data.lateCount} lần trả sách trễ hạn với tổng phí bồi thường là ${formatCurrency(selectedEntity.data.totalPenalty)}. Cần lưu ý nhắc nhở khi mượn tiếp.`}
                </p>
              </div>
              <button 
                onClick={() => setSelectedEntity(null)} 
                className="btn-primary" 
                style={{ width: '100%', marginTop: '2rem', padding: '1rem' }}
              >
                Đóng chi tiết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modals System */}
      {activeModal && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          onClick={() => setActiveModal(null)}
        >
          <div 
            style={{ 
              background: 'rgba(30, 30, 32, 0.95)', 
              borderRadius: '24px', 
              width: '100%', 
              maxWidth: '800px', 
              maxHeight: '90vh', 
              border: '1px solid rgba(255,255,255,0.1)', 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.4rem' }}>
                {activeModal === 'books' && '📊 Phân tích Kho Sách'}
                {activeModal === 'members' && '⭐ Độc giả tích cực nhất (Top Fans)'}
                {activeModal === 'borrows' && '⏳ Danh sách Đang mượn'}
                {activeModal === 'revenue' && '💸 Chi tiết Thu phí bồi thường'}
                {activeModal === 'damaged' && '🟠 Danh sách Sách bị hư hỏng'}
                {activeModal === 'lost' && '🔴 Danh sách Sách bị báo mất'}
              </h2>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.8rem', cursor: 'pointer', opacity: 0.5 }}>×</button>
            </div>
            
            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ opacity: 0.5, fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
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
                    {activeModal === 'books' && (
                       <th style={{ padding: '1rem' }}>Phân tích Cơ cấu Thể loại</th>
                    )}
                    {activeModal === 'revenue' && (
                      <>
                        <th style={{ padding: '1rem' }}>Độc giả</th>
                        <th style={{ padding: '1rem' }}>Tên sách</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Tiền phạt</th>
                        <th style={{ padding: '1rem' }}>Ngày thu</th>
                      </>
                    )}
                    {(activeModal === 'damaged' || activeModal === 'lost') && (
                      <>
                        <th style={{ padding: '1rem' }}>Độc giả / Sách</th>
                        <th style={{ padding: '1rem' }}>Ghi chú tình trạng</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Thao tác</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeModal === 'books' && (
                    <tr>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                          <div>
                            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', opacity: 0.8 }}>📊 Tỉ lệ theo Thể loại</h4>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                              {Object.entries(data?.categoryFreq || {}).sort((a,b) => b[1]-a[1]).map(([cat, count]) => {
                                const percent = Math.round((count / data.summary.totalBooks) * 100);
                                return (
                                  <div key={cat}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                                      <span>{cat}</span>
                                      <span style={{ opacity: 0.6 }}>{count} cuốn ({percent}%)</span>
                                    </div>
                                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${percent}%`, background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '10px' }}></div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <div style={{ marginTop: '1rem' }}>
                            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', opacity: 0.8 }}>🆕 Sách mới nhập gần đây</h4>
                            <div style={{ display: 'grid', gap: '0.6rem' }}>
                              {data?.newestBooks?.map(b => (
                                <div key={b.id} style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space_between' }}>
                                  <span style={{ fontWeight: '500' }}>{b.title}</span>
                                  <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>{b.author}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {activeModal === 'revenue' && data?.penaltyRecords?.map(rec => (
                    <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>{rec.userName}</td>
                      <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>{rec.bookTitle}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>{formatCurrency(rec.penaltyAmount)}</td>
                      <td style={{ padding: '1rem', opacity: 0.6 }}>
                        {rec.actualReturnDate ? new Date(getSafeTime(rec.actualReturnDate)).toLocaleDateString('vi-VN') : '—'}
                      </td>
                    </tr>
                  ))}
                  {activeModal === 'borrows' && data?.activeLoans?.map(loan => (
                    <tr key={loan.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>{loan.userName}</td>
                      <td style={{ padding: '1rem', color: '#bb86fc' }}>{loan.bookTitle}</td>
                      <td style={{ padding: '1rem', opacity: 0.6 }}>
                        {loan.dueDate ? new Date(getSafeTime(loan.dueDate)).toLocaleDateString('vi-VN') : '—'}
                      </td>
                    </tr>
                  ))}
                  {activeModal === 'members' && data?.topMembers?.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem', fontWeight: '600' }}>{m.name}</td>
                      <td style={{ padding: '1rem', opacity: 0.6 }}>{m.phone}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#bb86fc', fontWeight: '700' }}>{m.borrowCount}</td>
                    </tr>
                  ))}

                  {activeModal === 'damaged' && data?.damagedBooksList?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1.2rem 1rem' }}>
                        <div style={{ fontWeight: '700', color: '#fff' }}>{item.bookTitle}</div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Người mượn: {item.userName}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ color: '#fff', fontSize: '0.85rem' }}>{item.note}</div>
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Tiền bồi thường: {formatCurrency(item.fee)}</div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button 
                          disabled={restoring}
                          onClick={() => handleRestoreBook(item, 'RENEWED')}
                          style={{ 
                            padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', 
                            color: '#10b981', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700'
                          }}
                        >
                          Đã đổi mới
                        </button>
                      </td>
                    </tr>
                  ))}

                  {activeModal === 'lost' && data?.lostBooksList?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1.2rem 1rem' }}>
                        <div style={{ fontWeight: '700', color: '#fff' }}>{item.bookTitle}</div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Người mượn: {item.userName}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ color: '#fff', fontSize: '0.85rem' }}>{item.note}</div>
                        <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Tiền bồi thường: {formatCurrency(item.fee)}</div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button 
                          disabled={restoring}
                          onClick={() => handleRestoreBook(item, 'RESTOCKED')}
                          style={{ 
                            padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #6366f1', background: 'rgba(99,102,241,0.1)', 
                            color: '#6366f1', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700'
                          }}
                        >
                          Đã bổ sung
                        </button>
                      </td>
                    </tr>
                  ))}
                  {((activeModal === 'books' || activeModal === 'revenue') && (
                    <tr>
                      <td colSpan="3" style={{ padding: '3rem', textAlign: 'center', opacity: 0.3 }}>Dữ liệu chi tiết đang được tổng hợp.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards Area */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <StatCard 
          title="Tổng số sách" 
          value={formatNumber(summary.totalBooks)} 
          sub="Đầu sách trong thư viện" 
          color="#6366f1"
          onClick={() => setActiveModal('books')}
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
          onClick={() => setActiveModal('members')}
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
          color="#6366f1"
          onClick={() => setActiveModal('borrows')}
          svg={
            <>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </>
          }
        />
        <StatCard 
          title="Sách hỏng" 
          value={formatNumber(summary.damagedBooks)} 
          sub="Ghi nhận hỏng/hủy" 
          color="#f59e0b"
          onClick={() => setActiveModal('damaged')}
          svg={
            <>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </>
          }
        />
        <StatCard 
          title="Sách mất" 
          value={formatNumber(summary.lostBooks)} 
          sub="Độc giả báo làm mất" 
          color="#ef4444"
          onClick={() => setActiveModal('lost')}
          svg={
            <>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </>
          }
        />
        <StatCard 
          title="Tiền phạt" 
          value={formatCurrency(summary.totalRevenue)} 
          sub="Tổng phí thu hồi" 
          color="#10b981"
          onClick={() => setActiveModal('revenue')}
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
                  <tr 
                    key={book.id} 
                    style={{ borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s', cursor: 'pointer' }} 
                    className="table-row"
                    onClick={() => setSelectedEntity({ type: 'book', data: book })}
                  >
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
                  <tr 
                    key={user.id} 
                    style={{ borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s', cursor: 'pointer' }} 
                    className="table-row"
                    onClick={() => setSelectedEntity({ type: 'member', data: user })}
                  >
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

function StatCard({ title, value, sub, color, svg, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={{
      background: 'rgba(255,255,255,0.03)',
      padding: '1.5rem',
      borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.08)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      cursor: 'pointer'
    }}>
      <div style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ 
          width: '44px', height: '44px', background: `${color}15`, color: color, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '12px', marginBottom: '1.25rem',
          transition: 'all 0.4s ease'
        }} className="icon-container">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {svg}
          </svg>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontWeight: '500', marginBottom: '0.25rem' }}>{title}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.3, marginTop: '0.5rem' }}>{sub} 
            <span style={{ color: color, marginLeft: '5px', opacity: 0.8 }}>→</span>
        </div>
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
        opacity: 0,
        borderRadius: '50%',
        transition: 'opacity 0.4s ease'
      }} className="glow-bubble"></div>
      
      <style jsx>{`
        .stat-card:hover {
          transform: translateY(-8px) scale(1.02);
          border-color: ${color}60;
          background: rgba(255,255,255,0.05);
          box-shadow: 0 20px 40px -20px ${color}40;
        }
        .stat-card:hover .glow-bubble {
          opacity: 0.15;
        }
        .stat-card:hover .icon-container {
          transform: scale(1.1) rotate(5deg);
          box-shadow: 0 0 20px ${color}30;
        }
        .stat-card:active {
          transform: translateY(-4px) scale(0.98);
        }
      `}</style>
    </div>
  );
}

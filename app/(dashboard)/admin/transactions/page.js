"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "../../dashboard.module.css";

export default function ManageLoans() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, BORROWING, RETURNED, OVERDUE

  // Offline modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allBooks, setAllBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [reqRes, recRes] = await Promise.all([
        fetch(`/api/admin/borrow-requests?status=PENDING&adminId=${user.uid}`),
        fetch(`/api/admin/borrow-records?adminId=${user.uid}`)
      ]);
      const requestsData = await reqRes.json();
      setRequests(Array.isArray(requestsData) ? requestsData : []);
      const recordsData = await recRes.json();
      setRecords(Array.isArray(recordsData) ? recordsData : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ==================
  // OFFLINE MODAL
  // ==================
  const openOfflineModal = async () => {
    setIsModalOpen(true);
    setSelectedBook("");
    setBorrowerName("");
    setBookSearch("");
    try {
      const bookRes = await fetch('/api/books');
      const booksData = await bookRes.json();
      setAllBooks(Array.isArray(booksData) ? booksData.filter(b => (b.quantity || 0) > 0) : []);
    } catch (error) {
      console.error(error);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedBook("");
    setBorrowerName("");
    setBookSearch("");
  };

  const filteredBooks = allBooks.filter(b =>
    b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.author?.toLowerCase().includes(bookSearch.toLowerCase())
  );

  const handleOfflineSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBook || !borrowerName.trim()) return;

    setSubmitting(true);
    try {
      const book = allBooks.find(b => b.id === selectedBook);

      const res = await fetch('/api/admin/offline-borrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: borrowerName.trim(),
          bookId: book.id,
          bookTitle: book.title
        })
      });

      const data = await res.json();
      if (res.ok) {
        closeModal();
        fetchData();
      } else {
        alert(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      console.error(error);
      alert("Lỗi kết nối server");
    } finally {
      setSubmitting(false);
    }
  };

  // ==================
  // REQUEST ACTIONS
  // ==================
  const handleApprove = async (req) => {
    try {
      const res = await fetch('/api/admin/approve-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          userId: req.userId,
          bookId: req.bookId,
          userName: req.userName,
          bookTitle: req.bookTitle,
          adminId: user.uid
        })
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Duyệt thất bại");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleReject = async (id) => {
    if (!confirm("Xác nhận từ chối yêu cầu này?")) return;
    try {
      const res = await fetch('/api/admin/reject-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: id,
          adminId: user.uid
        })
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleReturn = async (recordId, bookId) => {
    if (!confirm("Xác nhận thu hồi / trả sách?")) return;
    try {
      const res = await fetch('/api/return-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          bookId,
          adminId: user.uid
        })
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  // ==================
  // SELECTED BOOK INFO
  // ==================
  const selectedBookInfo = allBooks.find(b => b.id === selectedBook);

  return (
    <div style={{ position: 'relative' }}>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Mượn Trả</h1>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={openOfflineModal} style={{
            background: 'linear-gradient(135deg, #27c93f, #1fa834)',
            border: 'none', color: '#fff', padding: '0.6rem 1.2rem',
            borderRadius: '8px', fontWeight: '600', cursor: 'pointer',
            fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}>
            + Tạo Phiếu Offline
          </button>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }}></div>
          <button
            className={activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab('requests')}
          >
            Chờ Duyệt ({requests.length})
          </button>
          <button
            className={activeTab === 'records' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab('records')}
          >
            Lịch Sử Mượn
          </button>
        </div>
      </div>

      {/* ===================== OFFLINE MODAL ===================== */}
      {isModalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(145deg, #2a2a2d, #1e1e21)',
              padding: '2.5rem', borderRadius: '20px',
              width: '100%', maxWidth: '520px',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '0.3rem' }}>Tạo Phiếu Mượn</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Nhập thông tin người mượn và chọn sách</p>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>

            <form onSubmit={handleOfflineSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Borrower Name */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: '500' }}>
                  Tên người mượn
                </label>
                <input
                  type="text"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  placeholder="Nhập họ tên người mượn..."
                  autoFocus
                  style={{
                    width: '100%', padding: '0.9rem 1rem', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.06)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '1rem', outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(187,134,252,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  required
                />
              </div>

              {/* Book Selection */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: '500' }}>
                  Chọn sách (còn trong kho)
                </label>
                <input
                  type="text"
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  placeholder="Tìm theo tên sách hoặc tác giả..."
                  style={{
                    width: '100%', padding: '0.7rem 1rem', borderRadius: '10px 10px 0 0',
                    background: 'rgba(255,255,255,0.06)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
                    fontSize: '0.9rem', outline: 'none'
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(187,134,252,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <div style={{
                  maxHeight: '180px', overflowY: 'auto',
                  border: '1px solid rgba(255,255,255,0.1)', borderTop: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '0 0 10px 10px',
                  background: 'rgba(0,0,0,0.2)'
                }}>
                  {filteredBooks.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                      Không tìm thấy sách phù hợp
                    </div>
                  ) : (
                    filteredBooks.map(b => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBook(b.id)}
                        style={{
                          padding: '0.7rem 1rem',
                          cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: selectedBook === b.id ? 'rgba(187,134,252,0.15)' : 'transparent',
                          borderLeft: selectedBook === b.id ? '3px solid #bb86fc' : '3px solid transparent',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { if (selectedBook !== b.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (selectedBook !== b.id) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div>
                          <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: selectedBook === b.id ? '600' : '400' }}>{b.title}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{b.author}</div>
                        </div>
                        <span style={{
                          fontSize: '0.7rem', padding: '0.15rem 0.4rem',
                          background: 'rgba(39,201,63,0.12)', color: '#27c93f',
                          borderRadius: '4px', fontWeight: '600', flexShrink: 0
                        }}>
                          Còn {b.quantity}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Selected Book Preview */}
              {selectedBookInfo && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.8rem 1rem', borderRadius: '10px',
                  background: 'rgba(187,134,252,0.08)', border: '1px solid rgba(187,134,252,0.2)'
                }}>

                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.9rem' }}>{selectedBookInfo.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{selectedBookInfo.author} • Còn {selectedBookInfo.quantity} bản</div>
                  </div>
                  <button type="button" onClick={() => setSelectedBook("")} style={{ background: 'none', border: 'none', color: '#ff5f56', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    flex: 1, padding: '0.9rem', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
                    color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontWeight: '500', fontSize: '0.9rem'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedBook || !borrowerName.trim()}
                  style={{
                    flex: 2, padding: '0.9rem', borderRadius: '10px',
                    border: 'none',
                    background: (submitting || !selectedBook || !borrowerName.trim()) ? 'rgba(187,134,252,0.3)' : 'linear-gradient(135deg, #bb86fc, #9965f4)',
                    color: (submitting || !selectedBook || !borrowerName.trim()) ? 'rgba(255,255,255,0.4)' : '#fff',
                    fontWeight: '700', cursor: (submitting || !selectedBook || !borrowerName.trim()) ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem', transition: 'all 0.2s'
                  }}
                >
                  {submitting ? "Đang xử lý..." : "Xác Nhận Mượn"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MAIN CONTENT ===================== */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1.5rem', marginTop: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.5)' }}>Đang tải dữ liệu...</div>
        ) : activeTab === 'requests' ? (
          /* PENDING REQUESTS */
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hội Viên</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Sách Yêu Cầu</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Gửi</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      Không có yêu cầu nào đang chờ duyệt.
                    </td>
                  </tr>
                ) : (
                  requests.map(req => (
                    <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{req.userName}</td>
                      <td style={{ padding: '1rem' }}>{req.bookTitle}</td>
                      <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                        {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('vi-VN') : 'Vừa xong'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleApprove(req)} style={{ background: 'rgba(39, 201, 63, 0.15)', color: '#27c93f', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Duyệt</button>
                          <button onClick={() => handleReject(req.id)} style={{ background: 'rgba(255, 95, 86, 0.15)', color: '#ff5f56', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Từ Chối</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* BORROW RECORDS */
          <>
            <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '12px' }}>
              <button 
                onClick={() => setFilterStatus('ALL')}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: filterStatus === 'ALL' ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', fontWeight: filterStatus === 'ALL' ? '700' : '400' }}
              >Tất cả</button>
              <button 
                onClick={() => setFilterStatus('BORROWING')}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: filterStatus === 'BORROWING' ? 'rgba(39,201,63,0.1)' : 'transparent', color: '#27c93f', fontSize: '0.85rem', cursor: 'pointer', fontWeight: filterStatus === 'BORROWING' ? '700' : '400' }}
              >Đang mượn</button>
              <button 
                onClick={() => setFilterStatus('OVERDUE')}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: filterStatus === 'OVERDUE' ? 'rgba(255,95,86,0.1)' : 'transparent', color: '#ff5f56', fontSize: '0.85rem', cursor: 'pointer', fontWeight: filterStatus === 'OVERDUE' ? '700' : '400' }}
              >Quá hạn</button>
              <button 
                onClick={() => setFilterStatus('RETURNED')}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: filterStatus === 'RETURNED' ? 'rgba(255,255,255,0.05)' : 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: filterStatus === 'RETURNED' ? '700' : '400' }}
              >Đã trả</button>
            </div>

            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Người Mượn</th>
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Sách</th>
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hạn Trả</th>
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Trạng Thái</th>
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {records.filter(rec => {
                    const dueDate = rec.dueDate?.toDate ? rec.dueDate.toDate() : (rec.dueDate ? new Date(rec.dueDate) : null);
                    const isActive = rec.status === 'Active' || rec.status === 'BORROWING';
                    const isOverdue = isActive && dueDate && dueDate < new Date();
                    
                    if (filterStatus === 'BORROWING') return isActive && !isOverdue;
                    if (filterStatus === 'OVERDUE') return isOverdue;
                    if (filterStatus === 'RETURNED') return rec.status === 'RETURNED';
                    return true;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                        Không có bản ghi nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    records.filter(rec => {
                      const dueDate = rec.dueDate?.toDate ? rec.dueDate.toDate() : (rec.dueDate ? new Date(rec.dueDate) : null);
                      const isActive = rec.status === 'Active' || rec.status === 'BORROWING';
                      const isOverdue = isActive && dueDate && dueDate < new Date();
                      
                      if (filterStatus === 'BORROWING') return isActive && !isOverdue;
                      if (filterStatus === 'OVERDUE') return isOverdue;
                      if (filterStatus === 'RETURNED') return rec.status === 'RETURNED';
                      return true;
                    }).map(rec => {
                      const dueDate = rec.dueDate?.toDate ? rec.dueDate.toDate() : (rec.dueDate ? new Date(rec.dueDate) : null);
                      const isActive = rec.status === 'Active' || rec.status === 'BORROWING';
                      const isOverdue = isActive && dueDate && dueDate < new Date();

                    return (
                      <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{rec.memberName || rec.userName}</td>
                        <td style={{ padding: '1rem' }}>{rec.bookTitle}</td>
                        <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                          {dueDate ? dueDate.toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            background: isOverdue ? 'rgba(255,95,86,0.15)' : isActive ? 'rgba(39,201,63,0.15)' : 'rgba(255,255,255,0.06)',
                            color: isOverdue ? '#ff5f56' : isActive ? '#27c93f' : 'rgba(255,255,255,0.4)',
                            padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600'
                          }}>
                            {isOverdue ? 'QUÁ HẠN' : isActive ? 'ĐANG MƯỢN' : 'ĐÃ TRẢ'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {isActive && (
                            <button onClick={() => handleReturn(rec.id, rec.bookId)} className="btn-outline" style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}>
                              Thu Hồi
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
              </div>
            </>
          )}
      </div>
    </div>
  );
}

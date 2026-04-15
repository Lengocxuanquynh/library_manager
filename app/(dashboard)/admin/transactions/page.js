"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../../../components/AuthProvider";
import styles from "../../dashboard.module.css";
import { formatDate } from "../../../../lib/utils";
import { toast } from "sonner";

export default function ManageLoans() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');
  const [currentTime, setCurrentTime] = useState(new Date());
  const intervalRef = useRef(null);

  // Live clock for countdown timers
  useEffect(() => {
    intervalRef.current = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, BORROWING, RETURNED, OVERDUE

  const [searchQuery, setSearchQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState("ALL");

  // Return Book Modal states
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedReturnRecord, setSelectedReturnRecord] = useState(null);
  const [returnNote, setReturnNote] = useState("");
  const [penaltyFee, setPenaltyFee] = useState(0);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);


  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Auto-cleanup expired pickups before loading data
      fetch('/api/admin/clean-expired-pickups', { method: 'POST' }).catch(() => {});

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
  // REQUEST ACTIONS
  // ==================
  const handleApprove = async (req) => {
    const loadingToast = toast.loading('Đang duyệt phiếu mượn...');
    try {
      // Detect format: batch (books[]) vs single (bookId)
      const hasBooksArray = Array.isArray(req.books) && req.books.length > 0;
      const hasSingleBook = req.bookId && req.bookTitle;

      if (!hasBooksArray && !hasSingleBook) {
        console.error('[handleApprove] Dữ liệu phiếu thiếu sách:', req);
        toast.error('Phiếu không có thông tin sách. Kiểm tra console để biết thêm.', { id: loadingToast });
        return;
      }

      const res = await fetch('/api/admin/approve-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          userId: req.userId,
          userName: req.userName,
          // Gửi cả 2 format — API sẽ tự nhận dạng đúng
          books: hasBooksArray ? req.books : null,
          bookId: hasSingleBook ? req.bookId : null,
          bookTitle: hasSingleBook ? req.bookTitle : null,
          adminId: user.uid
        })
      });

      if (res.ok) {
        const bookCount = hasBooksArray ? req.books.length : 1;
        toast.success(`Đã duyệt phiếu (${bookCount} cuốn). Độc giả có 24h để lấy sách.`, { id: loadingToast });
        fetchData();
      } else {
        const data = await res.json();
        console.error('[handleApprove] Lỗi từ server:', data);
        toast.error(data.message || 'Duyệt thất bại', { id: loadingToast });
      }
    } catch (error) {
      console.error('[handleApprove] Exception:', error);
      toast.error('Lỗi kết nối server', { id: loadingToast });
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

  const handleReturn = (record) => {
    setSelectedReturnRecord(record);
    setReturnNote("");
    setPenaltyFee(0);
    setIsReturnModalOpen(true);
  };

  const confirmReturn = async () => {
    if (!selectedReturnRecord) return;
    
    setReturning(true);
    const loadingToast = toast.loading("Đang xác nhận trả sách...");
    try {
      const res = await fetch('/api/return-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: selectedReturnRecord.id,
          bookId: selectedReturnRecord.bookId,
          adminId: user.uid,
          returnNote: returnNote,
          penaltyAmount: Number(penaltyFee)
        })
      });
      if (res.ok) {
        toast.success("Trả sách thành công!", { id: loadingToast });
        setIsReturnModalOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.message || "Trả sách thất bại", { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi kết nối server", { id: loadingToast });
    } finally {
      setReturning(false);
    }
  };

  const handleConfirmPickup = async (recordId, bookId) => {
    if (!confirm("Xác nhận hội viên đã đến lấy sách? Hệ thống sẽ trừ số lượng sách trong kho và bắt đầu tính 14 ngày mượn.")) return;
    const loadingToast = toast.loading("Đang xác nhận lấy sách...");
    try {
      const res = await fetch('/api/admin/confirm-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          bookId,
          adminId: user.uid
        })
      });
      if (res.ok) {
        toast.success('Đã xác nhận! Phiếu mượn chính thức bắt đầu.', { id: loadingToast });
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.message || "Xác nhận thất bại", { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi kết nối server", { id: loadingToast });
    }
  };

  // Helper: parse any Firestore/JS date to JS Date object
  const toJsDate = (d) => {
    if (!d) return null;
    if (typeof d?.toDate === 'function') return d.toDate();
    if (d?._seconds) return new Date(d._seconds * 1000);
    if (d?.seconds) return new Date(d.seconds * 1000);
    return new Date(d);
  };

  // Helper: render countdown from deadline to now
  const renderCountdown = (pickupDeadlineRaw) => {
    const deadline = toJsDate(pickupDeadlineRaw);
    if (!deadline) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;

    const diffMs = deadline - currentTime;
    if (diffMs <= 0) {
      return <span style={{ color: '#ff5f56', fontWeight: '700' }}>Đã quá hạn</span>;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    const isUrgent = diffMs < 2 * 60 * 60 * 1000; // < 2 hours
    return (
      <span style={{
        color: isUrgent ? '#ffb020' : '#27c93f',
        fontWeight: '700',
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'monospace'
      }}>
        Còn {hh}:{mm}:{ss}
      </span>
    );
  };



  return (
    <div style={{ position: 'relative' }}>
      <div className={styles.headerArea} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h1 className={styles.pageTitle}>Quản Lý Mượn Trả</h1>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.2rem' }}>

          {/* Chờ Duyệt (Online requests) */}
          <button
            className={activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab('requests')}
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.9rem' }}
          >
            Chờ Duyệt ({requests.length})
          </button>

          {/* Chờ Lấy Sách */}
          <button
            onClick={() => { setActiveTab('records'); setFilterStatus('APPROVED_PENDING_PICKUP'); }}
            style={{
              background: (activeTab === 'records' && filterStatus === 'APPROVED_PENDING_PICKUP') ? 'rgba(187,134,252,0.2)' : 'transparent',
              border: '1px solid rgba(187,134,252,0.4)',
              color: '#bb86fc', padding: '0.6rem 1.1rem',
              borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
              whiteSpace: 'nowrap'
            }}
          >
            ⏳ Chờ Lấy ({records.filter(r => r.status === 'APPROVED_PENDING_PICKUP').length})
          </button>

          {/* Trả Sách (Active borrowing) */}
          <button
            onClick={() => { setActiveTab('records'); setFilterStatus('BORROWING'); }}
            style={{
              background: (activeTab === 'records' && filterStatus === 'BORROWING') ? 'rgba(39,201,63,0.2)' : 'transparent',
              border: '1px solid rgba(39,201,63,0.4)',
              color: '#27c93f', padding: '0.6rem 1.1rem',
              borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
              whiteSpace: 'nowrap'
            }}
          >
            Trả Sách
          </button>

          {/* Trễ Hạn */}
          <button
            onClick={() => { setActiveTab('records'); setFilterStatus('OVERDUE'); }}
            style={{
              background: (activeTab === 'records' && filterStatus === 'OVERDUE') ? 'rgba(255,95,86,0.2)' : 'transparent',
              border: '1px solid rgba(255,95,86,0.4)',
              color: '#ff5f56', padding: '0.6rem 1.1rem',
              borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
              whiteSpace: 'nowrap'
            }}
          >
            Trễ Hạn
          </button>

          {/* Lịch Sử (Read-only) */}
          <button
            className={(activeTab === 'records' && filterStatus === 'ALL') ? 'btn-primary' : 'btn-outline'}
            onClick={() => { setActiveTab('records'); setFilterStatus('ALL'); }}
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.9rem' }}
          >
            Lịch Sử
          </button>
        </div>
      </div>


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
                      <td style={{ padding: '1rem', fontWeight: '500' }}>
                        {req.userName}
                        {(req.userPhone || req.userCCCD) && (
                          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                            {req.userPhone} {req.userCCCD && `- CCCD: ${req.userCCCD}`}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {req.books && req.books.length > 0 
                          ? req.books.map(b => b.bookTitle).join(', ') 
                          : req.bookTitle}
                      </td>
                      <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                        {formatDate(req.createdAt, true)}
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
            <div style={{
              display: 'flex', gap: '1rem', marginBottom: '1.5rem',
              background: 'rgba(255,255,255,0.02)', padding: '1rem',
              borderRadius: '12px', alignItems: 'center', flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên hội viên, SĐT hoặc tên sách..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '0.7rem 1rem', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: '0.9rem', outline: 'none'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.2rem' }}
                  >×</button>
                )}
              </div>

              {filterStatus === 'ALL' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Xem nhanh:</span>
                  <select
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)', color: '#000000ff', 
                      border: '1px solid rgba(187, 134, 252, 0.3)',
                      padding: '0.6rem 1rem', borderRadius: '8px', outline: 'none', 
                      fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    <option value="ALL">Toàn bộ lịch sử</option>
                    <option value="RETURNED">Sách đã trả</option>
                    <option value="BORROWING">Đang mượn</option>
                    <option value="OVERDUE">Quá hạn</option>
                  </select>
                </div>
              )}
            </div>
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Người Mượn</th>
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Sách</th>
                    {filterStatus === 'APPROVED_PENDING_PICKUP' ? (
                      <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>⏱ Thời Hạn Còn Lại</th>
                    ) : (
                      <>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Mượn</th>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hạn Trả</th>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Trả</th>
                      </>
                    )}
                    {(filterStatus === 'RETURNED' || (filterStatus === 'ALL' && historyFilter === 'RETURNED')) && (
                      <>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ghi chú</th>
                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Phí bồi thường</th>
                      </>
                    )}
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Trạng Thái</th>
                    {filterStatus !== 'ALL' && <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Thao Tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.filter(rec => {
                    const dueDate = rec.dueDate?.toDate ? rec.dueDate.toDate() : (rec.dueDate ? new Date(rec.dueDate) : null);
                    const isActive = rec.status === 'Active' || rec.status === 'BORROWING';
                    const isOverdue = isActive && dueDate && dueDate < new Date();

                    // 1. Filter by Status
                    let statusMatch = true;
                    const effectiveStatus = filterStatus === 'ALL' ? historyFilter : filterStatus;

                    if (effectiveStatus === 'BORROWING') statusMatch = isActive && !isOverdue;
                    else if (effectiveStatus === 'APPROVED_PENDING_PICKUP') statusMatch = (rec.status === 'APPROVED_PENDING_PICKUP');
                    else if (effectiveStatus === 'OVERDUE') statusMatch = isOverdue;
                    else if (effectiveStatus === 'RETURNED') statusMatch = (rec.status === 'RETURNED');

                    if (!statusMatch) return false;

                    // 2. Filter by Search Query
                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      const name = (rec.memberName || rec.userName || "").toLowerCase();
                      const phone = (rec.borrowerPhone || "").toLowerCase();
                      const book = (rec.bookTitle || "").toLowerCase();
                      return name.includes(q) || phone.includes(q) || book.includes(q);
                    }

                    return true;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                        Không có bản ghi nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    records.filter(rec => {
                      const dueDate = rec.dueDate?.toDate ? rec.dueDate.toDate() : (rec.dueDate ? new Date(rec.dueDate) : null);
                      const isActive = rec.status === 'Active' || rec.status === 'BORROWING';
                      const isOverdue = isActive && dueDate && dueDate < new Date();

                      // 1. Filter by Status
                      let statusMatch = true;
                      const effectiveStatus = filterStatus === 'ALL' ? historyFilter : filterStatus;

                      if (effectiveStatus === 'BORROWING') statusMatch = isActive && !isOverdue;
                      else if (effectiveStatus === 'APPROVED_PENDING_PICKUP') statusMatch = (rec.status === 'APPROVED_PENDING_PICKUP');
                      else if (effectiveStatus === 'OVERDUE') statusMatch = isOverdue;
                      else if (effectiveStatus === 'RETURNED') statusMatch = (rec.status === 'RETURNED');

                      if (!statusMatch) return false;

                      // 2. Filter by Search Query
                      if (searchQuery.trim()) {
                        const q = searchQuery.toLowerCase();
                        const name = (rec.memberName || rec.userName || "").toLowerCase();
                        const phone = (rec.borrowerPhone || "").toLowerCase();
                        const book = (rec.bookTitle || "").toLowerCase();
                        return name.includes(q) || phone.includes(q) || book.includes(q);
                      }

                      return true;
                    }).map(rec => {
                      const dueDate = rec.dueDate?.toDate ? rec.dueDate.toDate() : (rec.dueDate ? new Date(rec.dueDate) : null);
                      const isActive = rec.status === 'Active' || rec.status === 'BORROWING';
                      const isOverdue = isActive && dueDate && dueDate < new Date();

                      return (
                        <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '1rem', fontWeight: '500' }}>
                            {rec.memberName || rec.userName}
                            {rec.borrowerPhone && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{rec.borrowerPhone}</div>}
                          </td>
                          <td style={{ padding: '1rem' }}>{rec.bookTitle}</td>
                          {filterStatus === 'APPROVED_PENDING_PICKUP' ? (
                            <td style={{ padding: '1rem' }}>
                              {renderCountdown(rec.pickupDeadline)}
                              {rec.approvedAt && (
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.2rem' }}>
                                  Duyệt lúc: {formatDate(rec.approvedAt, true)}
                                </div>
                              )}
                            </td>
                          ) : (
                            <>
                              <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                                {rec.borrowDate ? formatDate(rec.borrowDate, true) : 'Chờ xác nhận'}
                              </td>
                              <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                                {rec.dueDate ? formatDate(rec.dueDate, true) : 'Chờ xác nhận'}
                              </td>
                              <td style={{ padding: '1rem', color: '#4caf50', fontSize: '0.9rem' }}>
                                {formatDate(rec.actualReturnDate || rec.returnDate, true)}
                              </td>
                            </>
                          )}
                          {(filterStatus === 'RETURNED' || (filterStatus === 'ALL' && historyFilter === 'RETURNED')) && (
                            <>
                              <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', maxWidth: '200px' }}>
                                {rec.returnNote || <span style={{ opacity: 0.3 }}>—</span>}
                              </td>
                              <td style={{ padding: '1rem', fontSize: '0.9rem', color: rec.penaltyAmount > 0 ? '#ff5f56' : 'rgba(255,255,255,0.4)', fontWeight: rec.penaltyAmount > 0 ? '600' : '400' }}>
                                {rec.penaltyAmount > 0 ? (
                                  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(rec.penaltyAmount)
                                ) : (
                                  "0 đ"
                                )}
                              </td>
                            </>
                          )}
                          <td style={{ padding: '1rem' }}>
                            <span style={{
                              background: isOverdue ? 'rgba(255,95,86,0.15)' : rec.status === 'APPROVED_PENDING_PICKUP' ? 'rgba(187,134,252,0.15)' : isActive ? 'rgba(39,201,63,0.15)' : 'rgba(255,255,255,0.06)',
                              color: isOverdue ? '#ff5f56' : rec.status === 'APPROVED_PENDING_PICKUP' ? '#bb86fc' : isActive ? '#27c93f' : 'rgba(255,255,255,0.4)',
                              padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600',
                              whiteSpace: 'nowrap', display: 'inline-block',
                              minWidth: '100px', textAlign: 'center'
                            }}>
                              {isOverdue ? 'QUÁ HẠN' : rec.status === 'APPROVED_PENDING_PICKUP' ? 'CHỜ LẤY SÁCH' : rec.status === 'CANCELLED_EXPIRED' ? 'HẾT HẠN' : isActive ? 'ĐANG MƯỢN' : 'ĐÃ TRẢ'}
                            </span>
                          </td>
                          {filterStatus !== 'ALL' && (
                            <td style={{ padding: '1rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {rec.status === 'APPROVED_PENDING_PICKUP' && (
                                  <button
                                    onClick={() => handleConfirmPickup(rec.id, rec.bookId)}
                                    style={{
                                      background: 'linear-gradient(135deg, #bb86fc, #9965f4)',
                                      color: '#fff', border: 'none', padding: '0.4rem 0.9rem',
                                      borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    ✓ Xác nhận đã lấy sách
                                  </button>
                                )}
                                {isActive && (
                                  <button onClick={() => handleReturn(rec)} className="btn-outline" style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}>
                                    Thu Hồi
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
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
      {/* RETURN BOOK MODAL */}
      {isReturnModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: '#1a1a1a', width: '90%', maxWidth: '500px',
            borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>Xác nhận trả sách</h2>
              <button onClick={() => setIsReturnModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: '2rem' }}>
              <div style={{ marginBottom: '1.5rem', background: 'rgba(187,134,252,0.05)', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid #bb86fc' }}>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>Sách đang trả:</p>
                <p style={{ fontSize: '1.05rem', fontWeight: '600', color: '#fff' }}>{selectedReturnRecord?.bookTitle}</p>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>Người mượn: <span style={{ color: '#bb86fc' }}>{selectedReturnRecord?.memberName || selectedReturnRecord?.userName}</span></p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Ghi chú tình trạng (Nếu có)</label>
                <textarea
                  placeholder="Ví dụ: Sách còn mới, rách trang 20, mất bìa..."
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  style={{
                    width: '100%', padding: '0.8rem', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: '0.9rem', outline: 'none', minHeight: '100px', resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Phí bồi thường (VNĐ)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={penaltyFee}
                    onChange={(e) => setPenaltyFee(e.target.value)}
                    style={{
                      width: '100%', padding: '0.8rem 1rem', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', fontSize: '1rem', outline: 'none', fontWeight: 'bold'
                    }}
                  />
                  <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>đ</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}>* Để trống hoặc nhập 0 nếu không có hư tổn.</p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setIsReturnModalOpen(false)}
                  style={{
                    flex: 1, padding: '0.8rem', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.05)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                    fontWeight: '600', transition: 'all 0.2s'
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={confirmReturn}
                  disabled={returning}
                  style={{
                    flex: 1, padding: '0.8rem', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #bb86fc, #9965f4)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    fontWeight: '600', boxShadow: '0 10px 20px -5px rgba(187,134,252,0.3)',
                    opacity: returning ? 0.7 : 1
                  }}
                >
                  {returning ? 'Đang thực hiện...' : 'Xác nhận trả'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


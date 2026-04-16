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

  const [pendingPickupCount, setPendingPickupCount] = useState(0);
  const [borrowingCount, setBorrowingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  // Detail Modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState(null);

  // Return Book Modal states
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedReturnRecord, setSelectedReturnRecord] = useState(null); // { record, book }
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
      const recs = Array.isArray(recordsData) ? recordsData : [];
      setRecords(recs);

      // Update counts
      setPendingPickupCount(recs.filter(r => r.status === 'APPROVED_PENDING_PICKUP').length);
      
      const now = new Date();
      let bCount = 0;
      let oCount = 0;
      recs.forEach(rec => {
        const dueDate = toJsDate(rec.dueDate);
        const isActive = rec.status === 'Active' || rec.status === 'BORROWING' || rec.status === 'PARTIALLY_RETURNED' || rec.status === 'OVERDUE';
        const isOverdue = rec.status === 'OVERDUE' || (isActive && dueDate && dueDate < now);
        if (isOverdue) oCount++;
        else if (isActive) bCount++;
      });
      setBorrowingCount(bCount);
      setOverdueCount(oCount);
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

  const handleOpenDetail = (record) => {
    setSelectedDetailRecord(record);
    setIsDetailModalOpen(true);
  };

  const handleReturnClick = (record, book) => {
    setSelectedReturnRecord({ record, book });
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
          recordId: selectedReturnRecord.record.id,
          bookId: selectedReturnRecord.book.bookId,
          adminId: user.uid,
          returnNote: returnNote,
          penaltyAmount: Number(penaltyFee)
        })
      });
      if (res.ok) {
        toast.success("Trả sách thành công!", { id: loadingToast });
        setIsReturnModalOpen(false);
        // Update the detail modal record if it's open
        fetchData().then(() => {
          if (selectedDetailRecord) {
             // We'll update after fetch
          }
        });
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

  useEffect(() => {
    if (isDetailModalOpen && selectedDetailRecord) {
      const updated = records.find(r => r.id === selectedDetailRecord.id);
      if (updated) setSelectedDetailRecord(updated);
    }
  }, [records]);

  const handleConfirmPickup = async (recordId) => {
    if (!confirm("Xác nhận hội viên đã đến lấy toàn bộ sách trong phiếu?")) return;
    const loadingToast = toast.loading("Đang xác nhận lấy sách...");
    try {
      const res = await fetch('/api/admin/confirm-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
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
            ⏳ Chờ Lấy ({pendingPickupCount})
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
            Trả Sách ({borrowingCount})
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
            Trễ Hạn ({overdueCount})
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
                        {req.books && req.books.length > 0 ? (
                          <>
                            <div style={{ fontWeight: '600', color: '#fff' }}>{req.books.length} cuốn sách</div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                              {req.books.map(b => b.bookTitle).join(', ')}
                            </div>
                          </>
                        ) : (
                          req.bookTitle
                        )}
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
                    <option value="ALL">Tất cả lịch sử</option>
                    <option value="RETURNED">Sách đã trả xong</option>
                    <option value="CANCELLED_EXPIRED">Hết hạn/Hủy bỏ</option>
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
                    const isActive = rec.status === 'Active' || rec.status === 'BORROWING' || rec.status === 'OVERDUE';
                    const isOverdue = rec.status === 'OVERDUE' || (isActive && dueDate && dueDate < currentTime);

                    // 1. Filter by Status
                    let statusMatch = true;
                    const effectiveStatus = filterStatus === 'ALL' ? historyFilter : filterStatus;

                    if (effectiveStatus === 'BORROWING') statusMatch = isActive && !isOverdue;
                    else if (effectiveStatus === 'APPROVED_PENDING_PICKUP') statusMatch = (rec.status === 'APPROVED_PENDING_PICKUP');
                    else if (effectiveStatus === 'OVERDUE') statusMatch = isOverdue;
                    else if (effectiveStatus === 'RETURNED') statusMatch = (rec.status === 'RETURNED' || rec.status === 'RETURNED_OVERDUE');

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
                      const dueDate = toJsDate(rec.dueDate);
                      const status = rec.status;
                      const isActive = status === 'Active' || status === 'BORROWING' || status === 'PARTIALLY_RETURNED' || status === 'OVERDUE';
                      const isOverdue = status === 'OVERDUE' || (isActive && dueDate && dueDate < currentTime);

                      // 1. Filter by Status
                      let statusMatch = true;
                      const isFinished = (status === 'RETURNED' || status === 'RETURNED_OVERDUE' || status === 'CANCELLED_EXPIRED');
                      const effectiveStatus = filterStatus === 'ALL' ? historyFilter : filterStatus;

                      if (effectiveStatus === 'ALL') {
                        statusMatch = isFinished;
                      } else if (effectiveStatus === 'BORROWING') {
                        statusMatch = isActive && !isOverdue;
                      } else if (effectiveStatus === 'APPROVED_PENDING_PICKUP') {
                        statusMatch = (status === 'APPROVED_PENDING_PICKUP');
                      } else if (effectiveStatus === 'OVERDUE') {
                        statusMatch = isOverdue;
                      } else if (effectiveStatus === 'RETURNED') {
                        statusMatch = (status === 'RETURNED' || status === 'RETURNED_OVERDUE');
                      } else if (effectiveStatus === 'CANCELLED_EXPIRED') {
                        statusMatch = (status === 'CANCELLED_EXPIRED');
                      }

                      if (!statusMatch) return false;

                      // 2. Filter by Search Query
                      if (searchQuery.trim()) {
                        const q = searchQuery.toLowerCase();
                        const name = (rec.memberName || rec.userName || "").toLowerCase();
                        const phone = (rec.borrowerPhone || "").toLowerCase();
                        const books = (rec.books || []).map(b => b.bookTitle.toLowerCase()).join(" ");
                        return name.includes(q) || phone.includes(q) || books.includes(q);
                      }

                      return true;
                    }).map(rec => {
                      const dueDate = toJsDate(rec.dueDate);
                      const status = rec.status;
                      const isActive = status === 'Active' || status === 'BORROWING' || status === 'PARTIALLY_RETURNED' || status === 'OVERDUE';
                      const isOverdue = status === 'OVERDUE' || (isActive && dueDate && dueDate < new Date());
                      
                      const books = rec.books || [];
                      const returnedCount = books.filter(b => b.status === 'RETURNED' || b.status === 'RETURNED_OVERDUE').length;

                      return (
                        <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '1rem', fontWeight: '500' }}>
                            {rec.memberName || rec.userName}
                            {rec.borrowerPhone && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{rec.borrowerPhone}</div>}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ fontWeight: '600', color: '#fff' }}>{books.length} cuốn sách</div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {books.map(b => b.bookTitle).join(', ')}
                            </div>
                            {returnedCount > 0 && (
                              <div style={{ fontSize: '0.75rem', color: '#27c93f', marginTop: '0.2rem' }}>
                                Đã trả {returnedCount}/{books.length}
                              </div>
                            )}
                          </td>
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
                                {rec.status === 'RETURNED' || rec.status === 'RETURNED_OVERDUE' ? formatDate(rec.actualReturnDate || rec.returnDate, true) : '—'}
                              </td>
                            </>
                          )}
                          {(filterStatus === 'RETURNED' || (filterStatus === 'ALL' && historyFilter === 'RETURNED')) && (
                            <>
                              <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', maxWidth: '200px' }}>
                                {books.map(b => b.returnNote).filter(Boolean).join('; ') || <span style={{ opacity: 0.3 }}>—</span>}
                              </td>
                              <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#ff5f56' }}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(books.reduce((acc, b) => acc + (b.penaltyAmount || 0), 0))}
                              </td>
                            </>
                          )}
                          <td style={{ padding: '1rem' }}>
                            <span style={{
                              background: isOverdue ? 'rgba(255,95,86,0.15)' : status === 'RETURNED_OVERDUE' ? 'rgba(255,176,32,0.15)' : status === 'APPROVED_PENDING_PICKUP' ? 'rgba(187,134,252,0.15)' : status === 'PARTIALLY_RETURNED' ? 'rgba(39,201,63,0.1)' : isActive ? 'rgba(39,201,63,0.15)' : 'rgba(255,255,255,0.06)',
                              color: isOverdue ? '#ff5f56' : status === 'RETURNED_OVERDUE' ? '#ffb020' : status === 'APPROVED_PENDING_PICKUP' ? '#bb86fc' : status === 'PARTIALLY_RETURNED' ? '#27c93f' : isActive ? '#27c93f' : 'rgba(255,255,255,0.4)',
                              padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600',
                              whiteSpace: 'nowrap', display: 'inline-block',
                              minWidth: '100px', textAlign: 'center'
                            }}>
                              {isOverdue ? 'QUÁ HẠN' : status === 'RETURNED_OVERDUE' ? 'TRẢ MUỘN' : status === 'APPROVED_PENDING_PICKUP' ? 'CHỜ LẤY SÁCH' : status === 'PARTIALLY_RETURNED' ? 'TRẢ MỘT PHẦN' : (rec.status === 'RETURNED') ? 'ĐÃ TRẢ XONG' : isActive ? 'ĐANG MƯỢN' : 'KHÔNG RÕ'}
                            </span>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleOpenDetail(rec)}
                                style={{
                                  background: 'rgba(187,134,252,0.1)',
                                  color: '#bb86fc', border: '1px solid rgba(187,134,252,0.2)',
                                  padding: '0.4rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'
                                }}
                              >
                                Chi Tiết
                              </button>
                              {/* Only show action buttons in active tabs, not in History */}
                              {filterStatus !== 'ALL' && status === 'APPROVED_PENDING_PICKUP' && (
                                <button onClick={() => handleConfirmPickup(rec.id)} className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>Lấy Sách</button>
                              )}
                            </div>
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

      {/* DETAIL MODAL */}
      {isDetailModalOpen && selectedDetailRecord && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: '#1a1a1a', width: '90%', maxWidth: '700px', maxHeight: '85vh',
            borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 30px 60px rgba(0,0,0,0.6)'
          }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff', margin: 0 }}>Chi Tiết Phiếu Mượn</h2>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.2rem' }}>ID: {selectedDetailRecord.id}</p>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
              {/* Member Info Card */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ margin: '0 0 0.8rem 0', color: '#bb86fc', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin độc giả</h4>
                  <p style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff', margin: '0 0 0.3rem 0' }}>{selectedDetailRecord.userName || selectedDetailRecord.memberName}</p>
                  <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>📞 {selectedDetailRecord.borrowerPhone || selectedDetailRecord.userPhone || "Chưa cập nhật"}</p>
                  {selectedDetailRecord.userCCCD && <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', margin: '0.3rem 0 0 0' }}>🆔 CCCD: {selectedDetailRecord.userCCCD}</p>}
                </div>
                
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ margin: '0 0 0.8rem 0', color: '#bb86fc', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thời gian & Trạng thái</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Ngày mượn:</span>
                      <span style={{ color: '#fff' }}>{selectedDetailRecord.borrowDate ? formatDate(selectedDetailRecord.borrowDate, true) : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Hạn trả:</span>
                      <span style={{ color: '#ffb020', fontWeight: '600' }}>{selectedDetailRecord.dueDate ? formatDate(selectedDetailRecord.dueDate, true) : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Trạng thái:</span>
                      <span style={{ color: '#bb86fc', fontWeight: '700' }}>{selectedDetailRecord.status === 'PARTIALLY_RETURNED' ? 'TRẢ MỘT PHẦN' : selectedDetailRecord.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Books List */}
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Danh sách sách mượn ({selectedDetailRecord.books?.length || 0})
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {(selectedDetailRecord.books || []).map((book, idx) => {
                  const isReturned = book.status === 'RETURNED' || book.status === 'RETURNED_OVERDUE';
                  const isOverdue = selectedDetailRecord.status === 'OVERDUE' && !isReturned;

                  return (
                    <div key={idx} style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      padding: '1rem 1.25rem', 
                      borderRadius: '12px', 
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', margin: '0 0 0.2rem 0' }}>{book.bookTitle}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '0.15rem 0.4rem', 
                            borderRadius: '4px',
                            background: isReturned ? 'rgba(39,201,63,0.1)' : isOverdue ? 'rgba(255,95,86,0.1)' : 'rgba(187,134,252,0.1)',
                            color: isReturned ? '#27c93f' : isOverdue ? '#ff5f56' : '#bb86fc',
                            fontWeight: '600'
                          }}>
                            {isReturned ? 'ĐÃ TRẢ' : isOverdue ? 'QUÁ HẠN' : 'ĐANG MƯỢN'}
                          </span>
                          {isReturned && book.actualReturnDate && (
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                              Trả ngày: {formatDate(book.actualReturnDate, true)}
                            </span>
                          )}
                        </div>
                      </div>

                      {!isReturned && (selectedDetailRecord.status === 'BORROWING' || selectedDetailRecord.status === 'PARTIALLY_RETURNED' || selectedDetailRecord.status === 'OVERDUE') && (
                        <button
                          onClick={() => handleReturnClick(selectedDetailRecord, book)}
                          style={{
                            background: 'rgba(39,201,63,0.15)',
                            color: '#27c93f',
                            border: '1px solid rgba(39,201,63,0.3)',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Thu Hồi
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              {selectedDetailRecord.status === 'APPROVED_PENDING_PICKUP' && (
                <button
                  onClick={() => {
                    handleConfirmPickup(selectedDetailRecord.id);
                    setIsDetailModalOpen(false);
                  }}
                  className="btn-primary"
                  style={{ padding: '0.7rem 1.5rem' }}
                >
                  Xác nhận lấy tất cả sách
                </button>
              )}
              <button 
                onClick={() => setIsDetailModalOpen(false)} 
                className="btn-outline"
                style={{ padding: '0.7rem 1.5rem' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

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
                <p style={{ fontSize: '1.05rem', fontWeight: '600', color: '#fff' }}>{selectedReturnRecord?.book?.bookTitle}</p>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>Người mượn: <span style={{ color: '#bb86fc' }}>{selectedReturnRecord?.record?.memberName || selectedReturnRecord?.record?.userName}</span></p>
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


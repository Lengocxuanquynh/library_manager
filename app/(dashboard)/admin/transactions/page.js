"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../../../components/AuthProvider";
import { useConfirm } from "../../../../components/ConfirmProvider";
import styles from "../../dashboard.module.css";
import { formatDate } from "../../../../lib/utils";
import { toast } from "sonner";
import PremiumSelect from "../../../../components/PremiumSelect";

export default function ManageLoans() {
  const { user } = useAuth();
  const { confirmPremium } = useConfirm();
  const [requests, setRequests] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [renewalRequests, setRenewalRequests] = useState([]);
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
  const [timeRange, setTimeRange] = useState("ALL"); // ALL, TODAY, WEEK, MONTH

  // Detail Modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState(null);

  // Return Book Modal states
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedReturnRecord, setSelectedReturnRecord] = useState(null); // { record, book }
  const [returnNote, setReturnNote] = useState("");
  const [penaltyFee, setPenaltyFee] = useState(0);
  const [returning, setReturning] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);


  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Auto-cleanup and notify background tasks
      fetch('/api/admin/clean-expired-pickups', { method: 'POST' }).catch(() => {});
      fetch('/api/admin/notify-overdue', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.uid })
      }).catch(err => console.error("Silent notify failed:", err));

      const [reqRes, recRes, renRes] = await Promise.all([
        fetch(`/api/admin/borrow-requests?status=PENDING&adminId=${user.uid}`),
        fetch(`/api/admin/borrow-records?adminId=${user.uid}`),
        fetch(`/api/admin/renewal/list?adminId=${user.uid}`)
      ]);
      const requestsData = await reqRes.json();
      setRequests(Array.isArray(requestsData) ? requestsData : []);
      const recordsData = await recRes.json();
      const recs = Array.isArray(recordsData) ? recordsData : [];
      setRecords(recs);
      const renewalsData = await renRes.json();
      setRenewalRequests(Array.isArray(renewalsData) ? renewalsData : []);

      // Update counts
      setPendingPickupCount(recs.filter(r => r.status === 'APPROVED_PENDING_PICKUP').length);
      
      const now = new Date();
      let bCount = 0;
      let oCount = 0;
      recs.forEach(rec => {
        const dueDate = toJsDate(rec.dueDate);
        const isActive = rec.status === 'Active' || rec.status === 'BORROWING' || rec.status === 'PARTIALLY_RETURNED' || rec.status === 'OVERDUE';
        const isLost = rec.status === 'LOST_LOCKED';
        const isOverdue = rec.status === 'OVERDUE' || (isActive && dueDate && dueDate < now);
        
        if (isLost) return; // Không đếm vào hàng đợi đang xử lý
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
    if (!await confirmPremium("Từ chối yêu cầu mượn này?", "🚫 Từ chối yêu cầu")) return;
    try {
      const res = await fetch('/api/admin/reject-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, adminId: user.uid })
      });
      if (res.ok) {
        toast.success("Đã từ chối yêu cầu.");
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRenewAction = async (ids, approve) => {
    const actionText = approve ? "duyệt" : "từ chối";
    if (!await confirmPremium(`Xác nhận ${actionText} yêu cầu gia hạn này?`, "⏳ Xử lý gia hạn")) return;

    const loadingToast = toast.loading(`Đang ${actionText} yêu cầu...`);
    try {
      const res = await fetch('/api/admin/renewal/handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          requestIds: Array.isArray(ids) ? ids : [ids],
          isApproved: approve, 
          adminId: user.uid 
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message, { id: loadingToast });
        fetchData();
      } else {
        toast.error(data.error || "Thao tác thất bại", { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi kết nối server", { id: loadingToast });
    }
  };

const handleOpenDetail = (record) => {
    setSelectedDetailRecord(record);
    setIsDetailModalOpen(true);
  };

  const handleReturnClick = (record, book) => {
    if (!record || !book) return;
    setSelectedReturnRecord({ record, book });
    setReturnNote("");
    
    // Tự động tính tiền phạt: 5.000đ/ngày trễ
    const dueDate = toJsDate(record.dueDate);
    if (dueDate && currentTime > dueDate) {
      const diffMs = currentTime - dueDate;
      // Làm tròn lên số ngày trễ (ví dụ trễ 1 phút cũng tính 1 ngày)
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      setPenaltyFee(diffDays * 5000);
    } else {
      setPenaltyFee(0);
    }
    
    if (record.status === 'LOST_LOCKED') {
      toast.error("Phiếu mượn này đã bị niêm phong do quá hạn nặng. Vui lòng xử lý tại quầy hỗ trợ.");
      return;
    }
    
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
          bookUid: selectedReturnRecord.book.uid, // Thay bookId bằng bookUid
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

  const handleConfirmPickup = async (transactionId, books) => {
    if (!await confirmPremium("Xác nhận hội viên đã đến lấy toàn bộ sách trong phiếu?", "📦 Xác nhận nhận sách")) return;
    const loadingToast = toast.loading("Đang xác nhận lấy sách...");
    try {
      const res = await fetch('/api/admin/confirm-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: transactionId,
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

  const handleNotifyAllOverdue = async () => {
    if (!await confirmPremium("Xác nhận gửi email nhắc nhở tới TẤT CẢ độc giả đang quá hạn trả sách?", "📧 Thông báo hàng loạt")) return;
    setIsNotifying(true);
    const loadingToast = toast.loading("Đang gửi thông báo nhắc nợ...");
    try {
      const res = await fetch('/api/admin/notify-overdue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.uid })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message, { id: loadingToast });
      } else {
        toast.error(data.message || "Gửi thông báo thất bại", { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi kết nối server", { id: loadingToast });
    } finally {
      setIsNotifying(false);
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

  // Helper: Check if record date matches the selected time range
  const isWithinTimeRange = (dateRaw) => {
    if (timeRange === "ALL") return true;
    const date = toJsDate(dateRaw);
    if (!date) return false;

    const now = new Date();
    
    if (timeRange === "TODAY") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return date >= startOfDay;
    }

    if (timeRange === "WEEK") {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diffToMonday = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      return date >= startOfWeek;
    }

    if (timeRange === "MONTH") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      return date >= startOfMonth;
    }

    return true;
  };

  // Helper: Centralized Filter Logic for Search & Time
  const getFilteredData = (data, type) => {
    return data.filter(item => {
      // 1. Time Filter
      // Chế độ 'requests' dùng createdAt, 'records' dùng borrowDate, 'renewals' dùng createdAt
      const dateField = type === 'record' ? item.borrowDate : item.createdAt;
      if (!isWithinTimeRange(dateField)) return false;

      // 2. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const slipId = (item.id || "").toLowerCase();
        
        if (type === 'request') {
          const name = (item.userName || "").toLowerCase();
          const phone = (item.userPhone || "").toLowerCase();
          const books = (item.books || []).map(b => b.bookTitle.toLowerCase()).join(" ");
          return name.includes(q) || phone.includes(q) || books.includes(q) || slipId.includes(q);
        }

        if (type === 'renewal') {
          const name = (item.userName || "").toLowerCase();
          const books = (item.bookTitles || "").toLowerCase();
          return name.includes(q) || books.includes(q) || slipId.includes(q);
        }

        if (type === 'record') {
          const name = (item.memberName || item.userName || "").toLowerCase();
          const phone = (item.borrowerPhone || "").toLowerCase();
          const books = (item.books || []).map(b => b.bookTitle.toLowerCase()).join(" ");
          return name.includes(q) || phone.includes(q) || books.includes(q) || slipId.includes(q);
        }
      }

      return true;
    });
  };



  return (
    <div style={{ position: 'relative' }}>
      <div className={styles.headerArea} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h1 className={styles.pageTitle}>Quản Lý Mượn Trả</h1>
        
        {/* 🔍 FILTER BAR - REAL VERSION */}
        <div style={{
          width: '100%',
          display: 'flex',
          gap: '1rem',
          background: 'rgba(255,255,255,0.02)',
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.05)',
          marginTop: '1.5rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
        }}>
          {/* SEARCH BOX - PREMIUM POLISHED */}
          <div style={{ flex: 1, minWidth: '350px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '1.1rem' }}>🔍</span>
            <input
              type="text"
              placeholder="Tìm theo Mã phiếu, Tên hội viên, SĐT hoặc Tên sách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '1rem 1.2rem 1rem 3.2rem',
                borderRadius: '14px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'all 0.3s ease',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#bb86fc';
                e.target.style.boxShadow = '0 0 15px rgba(187, 134, 252, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.boxShadow = 'none';
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.4rem' }}
              >×</button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Thời gian:</span>
            <div style={{ width: '220px' }}>
              <PremiumSelect 
                value={timeRange} 
                onChange={setTimeRange}
                options={[
                  { value: "ALL", label: "Tất cả thời gian" },
                  { value: "TODAY", label: "Hôm nay" },
                  { value: "WEEK", label: "Tuần này" },
                  { value: "MONTH", label: "Tháng này" }
                ]}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.2rem' }}>
          {/* TAB BUTTONS */}
          <button
            className={activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab('requests')}
            style={{ 
              padding: '0.6rem 1.1rem', fontSize: '0.9rem',
              background: activeTab === 'requests' ? 'rgba(255, 152, 0, 0.2)' : 'transparent',
              color: activeTab === 'requests' ? '#ff9800' : 'rgba(255,255,255,0.6)',
              borderColor: activeTab === 'requests' ? '#ff9800' : 'rgba(255,255,255,0.1)'
            }}
          >
            📋 Chờ Duyệt ({requests.length})
          </button>

          <button
            className={activeTab === 'renewals' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab('renewals')}
            style={{ 
              padding: '0.6rem 1.1rem', fontSize: '0.9rem',
              background: activeTab === 'renewals' ? 'rgba(0, 188, 212, 0.2)' : 'transparent',
              color: activeTab === 'renewals' ? '#00bcd4' : 'rgba(255,255,255,0.6)',
              borderColor: activeTab === 'renewals' ? '#00bcd4' : 'rgba(255,255,255,0.1)'
            }}
          >
            ⏳ Gia Hạn ({renewalRequests.length})
          </button>

          <button
            onClick={() => { setActiveTab('records'); setFilterStatus('APPROVED_PENDING_PICKUP'); }}
            style={{
              background: (activeTab === 'records' && filterStatus === 'APPROVED_PENDING_PICKUP') ? 'rgba(187,134,252,0.2)' : 'transparent',
              border: '1px solid ' + ((activeTab === 'records' && filterStatus === 'APPROVED_PENDING_PICKUP') ? '#bb86fc' : 'rgba(187,134,252,0.3)'),
              color: '#bb86fc', padding: '0.6rem 1.1rem',
              borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
              whiteSpace: 'nowrap'
            }}
          >
            ⏳ Chờ Lấy ({pendingPickupCount})
          </button>

          <button
            onClick={() => { setActiveTab('records'); setFilterStatus('BORROWING'); }}
            style={{
              background: (activeTab === 'records' && filterStatus === 'BORROWING') ? 'rgba(39,201,63,0.2)' : 'transparent',
              border: '1px solid ' + ((activeTab === 'records' && filterStatus === 'BORROWING') ? '#27c93f' : 'rgba(39,201,63,0.3)'),
              color: '#27c93f', padding: '0.6rem 1.1rem',
              borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
              whiteSpace: 'nowrap'
            }}
          >
            📚 Đang Mượn ({borrowingCount})
          </button>

          <button
            onClick={() => { setActiveTab('records'); setFilterStatus('OVERDUE'); }}
            style={{
              background: (activeTab === 'records' && filterStatus === 'OVERDUE') ? 'rgba(255,95,86,0.2)' : 'transparent',
              border: '1px solid ' + ((activeTab === 'records' && filterStatus === 'OVERDUE') ? '#ff5f56' : 'rgba(255,95,86,0.3)'),
              color: '#ff5f56', padding: '0.6rem 1.1rem',
              borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
              whiteSpace: 'nowrap'
            }}
          >
            ⚠️ Quá Hạn ({overdueCount})
          </button>

          <button
            className={(activeTab === 'records' && filterStatus === 'ALL') ? 'btn-primary' : 'btn-outline'}
            onClick={() => { setActiveTab('records'); setFilterStatus('ALL'); }}
            style={{ 
              padding: '0.6rem 1.1rem', fontSize: '0.9rem',
              background: (activeTab === 'records' && filterStatus === 'ALL') ? 'rgba(255,255,255,0.1)' : 'transparent'
            }}
          >
            🕒 Lịch Sử
          </button>
 
          {activeTab === 'records' && filterStatus === 'OVERDUE' && overdueCount > 0 && (
            <button
              onClick={handleNotifyAllOverdue}
              disabled={isNotifying}
              style={{
                marginLeft: 'auto',
                background: 'rgba(255, 176, 32, 0.15)',
                color: '#ffb020',
                border: '1px solid rgba(255, 176, 32, 0.3)',
                padding: '0.6rem 1.2rem',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {isNotifying ? "⏳ Đang gửi..." : "🔔 Gửi nhắc nợ hàng loạt"}
            </button>
          )}
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
                    <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Hội Viên</th>
                    <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Nội dung mượn</th>
                    <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Thời điểm gửi</th>
                    <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'right' }}>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                        Hiện chưa có yêu cầu nào mới.
                      </td>
                    </tr>
                  ) : (
                    getFilteredData(requests, 'request').map(req => (
                      <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.95rem' }}>{req.userName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.1rem' }}>
                            {req.userPhone || 'Không có SĐT'}
                          </div>
                        </td>
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <div style={{ fontSize: '0.9rem', color: '#fff' }}>{req.books?.length || 1} cuốn sách</div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                            {req.books ? req.books.map(b => b.bookTitle).join(', ') : req.bookTitle}
                          </div>
                        </td>
                        <td style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                          {formatDate(req.createdAt, true)}
                        </td>
                        <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => handleApprove(req)} style={{ background: 'rgba(39, 201, 63, 0.1)', color: '#27c93f', border: '1px solid rgba(39, 201, 63, 0.2)', padding: '0.3rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>Duyệt</button>
                            <button onClick={() => handleReject(req.id)} style={{ background: 'rgba(255, 95, 86, 0.05)', color: '#ff5f56', border: 'none', padding: '0.3rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Gỡ</button>
                          </div>
                        </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'renewals' ? (
          /* RENEWAL REQUESTS */
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Độc giả</th>
                  <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Lý do gia hạn</th>
                  <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Thời điểm</th>
                  <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'right' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredData(renewalRequests, 'renewal').length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      Không có yêu cầu gia hạn nào đang chờ xử lý.
                    </td>
                  </tr>
                ) : (
                  // Group renewals by userId
                  Object.values(getFilteredData(renewalRequests, 'renewal').reduce((acc, ren) => {
                    const uid = ren.userId;
                    if (!acc[uid]) acc[uid] = { 
                      userId: uid, 
                      userName: ren.userName || "Độc giả", 
                      items: [] 
                    };
                    acc[uid].items.push(ren);
                    return acc;
                  }, {})).map(group => (
                    <tr key={group.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: '700', color: '#fff', fontSize: '1rem' }}>{group.userName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>ID: {group.userId.slice(0,8)}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                          {group.items.map(ren => (
                            <div key={ren.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '10px', borderLeft: '3px solid #00bcd4' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#00bcd4', marginBottom: '0.3rem' }}>
                                📖 {ren.bookTitles || "Không rõ tên sách"}
                              </div>
                              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>
                                "{ren.reason}"
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.4rem' }}>
                                Gửi lúc: {formatDate(ren.createdAt, true)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'right' }} colSpan={2}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'flex-end' }}>
                          <button 
                            onClick={() => handleRenewAction(group.items.map(i => i.id), true)}
                            style={{ 
                              background: 'linear-gradient(135deg, #00bcd4, #0097a7)', 
                              color: '#fff', 
                              border: 'none', 
                              padding: '0.6rem 1.2rem', 
                              borderRadius: '8px', 
                              cursor: 'pointer', 
                              fontSize: '0.9rem', 
                              fontWeight: '700',
                              boxShadow: '0 4px 12px rgba(0, 188, 212, 0.3)'
                            }}
                          >
                            Duyệt tất cả của {group.userName} ({group.items.length})
                          </button>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => handleRenewAction(group.items.map(i => i.id), false)}
                              style={{ background: 'transparent', color: 'rgba(255, 95, 86, 0.6)', border: '1px solid rgba(255, 95, 86, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Từ chối tất cả
                            </button>
                          </div>
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
            {filterStatus === 'ALL' && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Bộ lọc lịch sử:</span>
                <div style={{ width: '250px' }}>
                  <PremiumSelect
                    value={historyFilter}
                    onChange={setHistoryFilter}
                    options={[
                      { value: "ALL", label: "Tất cả lịch sử" },
                      { value: "RETURNED", label: "Sách đã trả xong" },
                      { value: "CANCELLED_EXPIRED", label: "Đơn đã hủy/Hết hạn" },
                      { value: "LOST_LOCKED", label: "🆘 Sách mất / Khóa thẻ" }
                    ]}
                  />
                </div>
              </div>
            )}
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Người Mượn</th>
                    <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Sách</th>
                    {filterStatus === 'APPROVED_PENDING_PICKUP' ? (
                      <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>⏱ Còn Lại</th>
                    ) : (
                      <>
                        <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Mượn/Hạn</th>
                        <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Ngày Trả</th>
                      </>
                    )}
                    <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Trạng Thái</th>
                    {filterStatus !== 'ALL' && <th style={{ padding: '0.8rem 1rem', color: 'rgba(255,255,255,0.6)', textAlign: 'right' }}>Thao Tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {getFilteredData(records, 'record').filter(rec => {
                    const dueDate = toJsDate(rec.dueDate);
                    const isActive = rec.status === 'Active' || rec.status === 'BORROWING' || rec.status === 'PARTIALLY_RETURNED' || rec.status === 'OVERDUE';
                    const isOverdue = rec.status === 'OVERDUE' || (isActive && dueDate && dueDate < currentTime);

                    // 1. Filter by Status
                    let statusMatch = true;
                    const effectiveStatus = filterStatus === 'ALL' ? historyFilter : filterStatus;

                    if (effectiveStatus === 'BORROWING') statusMatch = isActive && !isOverdue;
                    else if (effectiveStatus === 'APPROVED_PENDING_PICKUP') statusMatch = (rec.status === 'APPROVED_PENDING_PICKUP');
                    else if (effectiveStatus === 'OVERDUE') statusMatch = isOverdue;
                    else if (effectiveStatus === 'RETURNED') statusMatch = (rec.status === 'RETURNED' || rec.status === 'RETURNED_OVERDUE');
                    else if (effectiveStatus === 'CANCELLED_EXPIRED') statusMatch = (rec.status === 'CANCELLED_EXPIRED');
                    else if (effectiveStatus === 'LOST_LOCKED') statusMatch = (rec.status === 'LOST_LOCKED');

                    return statusMatch;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                        Không có bản ghi nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    getFilteredData(records, 'record').filter(rec => {
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

                      return statusMatch;
                    }).map(rec => {
                      const dueDate = toJsDate(rec.dueDate);
                      const status = rec.status;
                      const isActive = status === 'Active' || status === 'BORROWING' || status === 'PARTIALLY_RETURNED' || status === 'OVERDUE';
                      const isOverdue = status === 'OVERDUE' || (isActive && dueDate && dueDate < new Date());
                      const isFinished = status === 'RETURNED' || status === 'RETURNED_OVERDUE' || status === 'CANCELLED_EXPIRED';
                      
                      const books = rec.books || [];
                      const returnedCount = books.filter(b => b.status === 'RETURNED' || b.status === 'RETURNED_OVERDUE').length;

                      return (
                        <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>{rec.memberName || rec.userName}</div>
                            {rec.borrowerPhone && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.1rem' }}>{rec.borrowerPhone}</div>}
                          </td>
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <div style={{ fontSize: '0.85rem', color: '#fff' }}>{books.length} sách</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {books.map(b => b.bookTitle).join(', ')}
                            </div>
                          </td>
                          {filterStatus === 'APPROVED_PENDING_PICKUP' ? (
                            <td style={{ padding: '0.8rem 1rem' }}>
                              {renderCountdown(rec.pickupDeadline)}
                            </td>
                          ) : (
                            <>
                              <td style={{ padding: '0.8rem 1rem' }}>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{formatDate(rec.borrowDate, true)}</div>
                                <div style={{ fontSize: '0.75rem', color: '#ffb020', marginTop: '0.1rem' }}>Hạn: {formatDate(rec.dueDate, true)}</div>
                              </td>
                              <td style={{ padding: '0.8rem 1rem', color: '#4caf50', fontSize: '0.85rem' }}>
                                {isFinished ? formatDate(rec.actualReturnDate || rec.returnDate, true) : '—'}
                              </td>
                            </>
                          )}
                          <td style={{ padding: '0.8rem 1rem' }}>
                            <span style={{
                              background: status === 'LOST_LOCKED' ? 'rgba(255,10,10,0.15)' : isOverdue ? 'rgba(255,95,86,0.1)' : status === 'RETURNED_OVERDUE' ? 'rgba(255,176,32,0.1)' : status === 'APPROVED_PENDING_PICKUP' ? 'rgba(187,134,252,0.1)' : isActive ? 'rgba(39,201,63,0.1)' : 'rgba(255,255,255,0.05)',
                              color: status === 'LOST_LOCKED' ? '#ff3131' : isOverdue ? '#ff5f56' : status === 'RETURNED_OVERDUE' ? '#ffb020' : status === 'APPROVED_PENDING_PICKUP' ? '#bb86fc' : isActive ? '#27c93f' : 'rgba(255,255,255,0.4)',
                              padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700',
                              whiteSpace: 'nowrap',
                              border: status === 'LOST_LOCKED' ? '1px solid rgba(255,49,49,0.3)' : 'none'
                            }}>
                              {status === 'LOST_LOCKED' ? 'BỊ KHÓA / MẤT' : isOverdue ? 'QUÁ HẠN' : status === 'RETURNED_OVERDUE' ? 'TRẢ MUỘN' : status === 'APPROVED_PENDING_PICKUP' ? 'CHỜ LẤY SÁCH' : status === 'PARTIALLY_RETURNED' ? 'TRẢ MỘT PHẦN' : (rec.status === 'RETURNED') ? 'ĐÃ TRẢ' : isActive ? 'ĐANG MƯỢN' : 'KHÔNG RÕ'}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                              <button onClick={() => handleOpenDetail(rec)} style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Xem</button>
                              {filterStatus !== 'ALL' && status === 'APPROVED_PENDING_PICKUP' && (
                                <button onClick={() => handleConfirmPickup(rec.id)} style={{ background: 'rgba(187,134,252,0.15)', color: '#bb86fc', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>Lấy Sách</button>
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
                  <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>📞 {selectedDetailRecord.borrowerPhone || selectedDetailRecord.userPhone || "Trống"}</p>
                  <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', margin: '0.3rem 0 0 0' }}>✉️ {selectedDetailRecord.userEmail || selectedDetailRecord.email || "Trống"}</p>
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
                      <span style={{ color: '#bb86fc', fontWeight: '700' }}>{selectedDetailRecord?.status === 'PARTIALLY_RETURNED' ? 'TRẢ MỘT PHẦN' : selectedDetailRecord?.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Books List */}
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Danh sách sách mượn ({selectedDetailRecord.books?.length || 0})
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {(selectedDetailRecord?.books || []).map((book, idx) => {
                  const isReturned = book.status === 'RETURNED' || book.status === 'RETURNED_OVERDUE';
                  const isOverdue = selectedDetailRecord?.status === 'OVERDUE' && !isReturned;

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

                      {!isReturned && (selectedDetailRecord?.status === 'BORROWING' || selectedDetailRecord?.status === 'PARTIALLY_RETURNED' || selectedDetailRecord?.status === 'OVERDUE') && (
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
              {selectedDetailRecord?.status === 'APPROVED_PENDING_PICKUP' && (
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
              {(selectedDetailRecord?.status === 'BORROWING' || selectedDetailRecord?.status === 'PARTIALLY_RETURNED' || selectedDetailRecord?.status === 'OVERDUE') && (
                <button
                  onClick={async () => {
                    if (!await confirmPremium("Bạn có chắc chắn muốn thu hồi toàn bộ sách trong phiếu này không?", "⚠️ Thu hồi khẩn cấp")) return;
                    
                    setReturning(true);
                    const loadingToast = toast.loading("Đang thu hồi tất cả sách...");
                    try {
                      const res = await fetch('/api/admin/return-all', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          recordId: selectedDetailRecord.id,
                          transactionId: selectedDetailRecord.transactionId || selectedDetailRecord.slipId,
                          books: selectedDetailRecord.books || [],
                          adminId: user?.uid,
                          returnNote: "Thu hồi toàn bộ",
                          penaltyAmount: 0 // Optional
                        })
                      });
                      if (res.ok) {
                        toast.success("Thu hồi toàn bộ sách thành công!", { id: loadingToast });
                        setIsDetailModalOpen(false);
                        fetchData();
                      } else {
                        const data = await res.json();
                        toast.error(data.message || data.error || "Thu hồi thất bại", { id: loadingToast });
                      }
                    } catch (error) {
                      console.error(error);
                      toast.error("Lỗi kết nối server", { id: loadingToast });
                    } finally {
                      setReturning(false);
                    }
                  }}
                  disabled={returning}
                  style={{
                    padding: '0.7rem 1.5rem',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    fontWeight: '700',
                    boxShadow: '0 6px 15px -3px rgba(255,65,108,0.4)',
                    opacity: returning ? 0.7 : 1, transition: 'all 0.2s',
                    textTransform: 'uppercase'
                  }}
                >
                  {returning ? 'Đang xử lý...' : 'Thu hồi tất cả sách'}
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
      {isReturnModalOpen && selectedReturnRecord && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: '#1a1a1a', width: '90%', maxWidth: '500px',
            borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', maxHeight: '90vh'
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>Chi tiết Phiếu mượn</h2>
              <button 
                onClick={() => setIsReturnModalOpen(false)} 
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', padding: '0 0.5rem' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* THÔNG TIN ĐỘC GIẢ */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>THÔNG TIN ĐỘC GIẢ</h3>
                <p style={{ fontSize: '1.05rem', fontWeight: '600', color: '#fff' }}>{selectedReturnRecord?.record?.memberName || selectedReturnRecord?.record?.userName}</p>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.6rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>SĐT: </span>
                    {selectedReturnRecord?.record?.borrowerPhone || selectedReturnRecord?.record?.phone ? (
                      <span style={{ color: '#fff', fontWeight: '500' }}>{selectedReturnRecord?.record?.borrowerPhone || selectedReturnRecord?.record?.phone}</span>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>📞 Trống</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Email: </span>
                    {selectedReturnRecord?.record?.userEmail || selectedReturnRecord?.record?.email ? (
                      <span style={{ color: '#fff', fontWeight: '500' }}>{selectedReturnRecord?.record?.userEmail || selectedReturnRecord?.record?.email}</span>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>✉️ Trống</span>
                    )}
                  </div>
                </div>
              </div>

              {/* THÔNG TIN SÁCH */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(187,134,252,0.05)', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid #bb86fc' }}>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>Cuốn sách đang chọn:</p>
                <p style={{ fontSize: '1.1rem', fontWeight: '700', color: '#bb86fc', margin: 0 }}>
                  {selectedReturnRecord?.book?.bookTitle || selectedReturnRecord?.bookTitle}
                </p>
                
                {selectedReturnRecord?.record?.books && selectedReturnRecord.record.books.length > 1 && (
                  <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(187,134,252,0.1)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem' }}>Các sách khác trong phiếu:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {selectedReturnRecord.record.books
                        .filter(b => b.uid !== selectedReturnRecord.book?.uid) // Lọc theo UID thay vì bookId
                        .map((b, idx) => (
                          <span key={idx} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'rgba(255,255,255,0.6)' }}>
                            {b.bookTitle}
                          </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* TÌNH TRẠNG & GHI CHÚ */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Ghi chú tình trạng (Nếu có)</label>
                <textarea
                  placeholder="Ví dụ: Sách còn mới, rách trang 20, mất bìa..."
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  style={{
                    width: '100%', padding: '0.8rem', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: '0.9rem', outline: 'none', minHeight: '80px', resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
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
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}>
                  * Tính tự động: 5.000đ/ngày trễ. Có thể sửa nếu sách hỏng/mất.
                </p>
              </div>

              {/* ACTIONS */}
              <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                {/* NÚT THU HỒI CUỐN NÀY (Xác nhận trả lẻ) */}
                <button
                  onClick={confirmReturn}
                  disabled={returning}
                  style={{
                    width: '100%', padding: '0.9rem', borderRadius: '12px',
                    background: 'rgba(39,201,63,0.15)',
                    color: '#27c93f', border: '1px solid rgba(39,201,63,0.3)', 
                    cursor: 'pointer', fontWeight: '700', fontSize: '1rem',
                    transition: 'all 0.2s'
                  }}
                >
                  {returning ? 'Đang xử lý...' : 'Xác nhận trả cuốn này'}
                </button>

                {/* NÚT THU HỒI TẤT CẢ (Hàng loạt) */}
                {selectedReturnRecord?.record?.books && selectedReturnRecord.record.books.length > 1 && (
                  <button
                    onClick={async () => {
                      if (!await confirmPremium("Bạn có chắc chắn muốn thu hồi toàn bộ sách trong phiếu này không?", "⚠️ Thu hồi khẩn cấp")) return;
                      
                      setReturning(true);
                      const loadingToast = toast.loading("Đang thu hồi tất cả sách...");
                      try {
                        const res = await fetch('/api/admin/return-all', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            recordId: selectedReturnRecord.record.id,
                            transactionId: selectedReturnRecord.record.transactionId || selectedReturnRecord.record.slipId,
                            books: selectedReturnRecord.record.books || [],
                            adminId: user.uid,
                            returnNote: returnNote,
                            penaltyAmount: Number(penaltyFee) || 0
                          })
                        });
                        if (res.ok) {
                          toast.success("Thu hồi toàn bộ sách thành công!", { id: loadingToast });
                          setIsReturnModalOpen(false);
                          fetchData();
                        } else {
                          const data = await res.json();
                          toast.error(data.message || data.error || "Thu hồi thất bại", { id: loadingToast });
                        }
                      } catch (error) {
                        console.error(error);
                        toast.error("Lỗi kết nối server", { id: loadingToast });
                      } finally {
                        setReturning(false);
                      }
                    }}
                    disabled={returning}
                    style={{
                      width: '100%', padding: '0.9rem', borderRadius: '12px',
                      background: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
                      color: '#fff', border: 'none', cursor: 'pointer',
                      fontWeight: '700', fontSize: '1rem',
                      boxShadow: '0 6px 15px -3px rgba(255,65,108,0.4)',
                      opacity: returning ? 0.7 : 1, transition: 'all 0.2s',
                      textTransform: 'uppercase'
                    }}
                  >
                    {returning ? 'Đang thực hiện...' : 'Thu hồi tất cả sách'}
                  </button>
                )}
                
                {/* Nút Đóng */}
                <button
                  onClick={() => setIsReturnModalOpen(false)}
                  style={{
                    width: '100%', padding: '0.8rem', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.05)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                    fontWeight: '600', transition: 'all 0.2s'
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import styles from "../../dashboard.module.css";
import { formatDate, toJsDate } from "@/lib/utils";
import { toast } from "sonner";
import { calculatePenaltyDetails } from "@/lib/penalty-utils";
import PremiumSelect from "@/components/PremiumSelect";
import { getBook } from "@/services/db";

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
  const [penaltyFee, setPenaltyFee] = useState(0); // This will be lateFee
  const [damageFee, setDamageFee] = useState(0);
  const [isLost, setIsLost] = useState(false);
  const [isDamaged, setIsDamaged] = useState(false);
  const [returning, setReturning] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [startDate, setStartDate] = useState(""); // YYYY-MM-DD
  const [endDate, setEndDate] = useState("");     // YYYY-MM-DD

  const [config, setConfig] = useState({ excludeSundays: true, holidays: [] });
  const [isBulkReturnModalOpen, setIsBulkReturnModalOpen] = useState(false);
  const [bulkReturnItems, setBulkReturnItems] = useState([]); // [{ uid, bookTitle, lateFee, damageFee, isLost, price }]

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data && !data.error) setConfig(data);
    } catch (error) {
      console.error("Lỗi tải cấu hình:", error);
    }
  };

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
        const isOverdue = rec.status === 'OVERDUE';
        
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

  const handleReturnClick = async (record, book) => {
    if (!record || !book) return;
    
    // Fallback: Nếu phiếu mượn cũ thiếu giá, lôi giá từ Đầu Sách lên
    let currentBook = { ...book };
    if (!currentBook.price || currentBook.price === 0) {
      try {
        const bookData = await getBook(book.bookId);
        if (bookData && bookData.price) {
          currentBook.price = bookData.price;
        }
      } catch (err) {
        console.error("Failed to fetch latest book price:", err);
      }
    }

    setSelectedReturnRecord({ record, book: currentBook });
    setReturnNote("");
    
    // Tự động tính tiền phạt: 5.000đ/ngày trễ (Day-based)
    const jsDueDate = toJsDate(record.dueDate);
    const penaltyInfo = calculatePenaltyDetails(jsDueDate, new Date(), config);
    setPenaltyFee(penaltyInfo.penaltyFine);

    setIsLost(false);
    setDamageFee(0);
    
    if (record.status === 'LOST_LOCKED' || penaltyInfo.isLocked) {
      toast.info("Phiếu này đang ở trạng thái PHONG TỎA THẺ. Bạn vẫn có thể thực hiện thu hồi và báo hỏng/mất để xử lý bồi thường.");
    }
    
    setIsReturnModalOpen(true);
  };

  const confirmReturn = async () => {
    if (!selectedReturnRecord) return;
    
    // VALIDATION: Bắt buộc ghi chú và tiền đền bù nếu hỏng/mất
    if ((isDamaged || isLost) && (!returnNote || !returnNote.trim())) {
      toast.error(`Vui lòng nhập ghi chú chi tiết tình trạng ${isDamaged ? 'HƯ HỎNG' : 'MẤT'} của sách!`);
      return;
    }

    if (isDamaged && (!damageFee || Number(damageFee) <= 0)) {
      toast.error("Vui lòng nhập số tiền đền bù khi báo hỏng sách!");
      return;
    }

    if (isLost && (!damageFee || Number(damageFee) <= 0)) {
      toast.error("Vui lòng nhập giá trị sách bồi thường khi báo mất!");
      return;
    }
    
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
          penaltyAmount: Number(penaltyFee), 
          isLost: isLost,
          isDamaged: isDamaged,
          damageFee: Number(damageFee)
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

  const handleIsLostToggle = (checked) => {
    setIsLost(checked);
    if (checked) {
      setIsDamaged(false);
      // Khi báo mất, tự động điền giá của cuốn sách vào damageFee CHỈ KHI ô nhập đang trống hoặc bằng 0
      if (!damageFee || Number(damageFee) === 0) {
        setDamageFee(selectedReturnRecord?.book?.price || 0);
      }
      if (!returnNote) setReturnNote("Sách báo mất");
    } else {
      setDamageFee(0);
    }
  };

  const handleIsDamagedToggle = (checked) => {
    setIsDamaged(checked);
    if (checked) {
      setIsLost(false);
      // Khi báo hỏng, KHÔNG tự động lấy giá niêm yết (để người dùng tự nhập mức phạt tùy theo độ hỏng)
      if (!returnNote) setReturnNote("Sách hư hỏng");
    } else {
      setDamageFee(0);
    }
  };

  // ==================
  // BULK RETURN HANDLERS
  // ==================
  const handleOpenBulkReturn = async (record) => {
    if (!record || !record.books) return;
    
    const now = new Date();
    const dueDate = toJsDate(record.dueDate);
    
    // Tự động lôi giá từ Đầu Sách lên cho tất cả sách thiếu giá trong phiếu
    const itemsWithPrices = await Promise.all(record.books
      .filter(b => !['RETURNED', 'RETURNED_OVERDUE', 'LOST'].includes(b.status))
      .map(async (b) => {
        let price = b.price || 0;
        if (!price || price === 0) {
          try {
            const bookData = await getBook(b.bookId);
            if (bookData && bookData.price) price = bookData.price;
          } catch (err) {
            console.error(`Failed to fetch price for book ${b.bookId}:`, err);
          }
        }
        return {
          uid: b.uid,
          bookId: b.bookId,
          bookTitle: b.bookTitle,
          lateFee: 0,
          damageFee: 0,
          isLost: false,
          isDamaged: false,
          price: price,
          returnNote: ""
        };
      }));
      
    if (itemsWithPrices.length === 0) {
      toast.error("Tất cả sách trong phiếu này đã được trả.");
      return;
    }

    // Tính phí trễ hạn TUYỆT ĐỐI cho cả phiếu (chỉ 1 lần)
    let recordLateFee = 0;
    const jsDueDate = toJsDate(record.dueDate);
    const penaltyInfo = calculatePenaltyDetails(jsDueDate, new Date(), config);
    recordLateFee = penaltyInfo.penaltyFine;
    
    setBulkReturnItems(itemsWithPrices);
    // Tạm mượn state penaltyFee để lưu phí trễ cả đơn trong ngữ cảnh này
    setPenaltyFee(recordLateFee); 
    setIsBulkReturnModalOpen(true);
  };

  const handleBulkItemChange = (uid, field, value) => {
    setBulkReturnItems(prev => prev.map(item => {
      if (item.uid === uid) {
        const updated = { ...item, [field]: value };
        // Nếu bật Lost, tự điền damageFee (giá sách)
        if (field === 'isLost' && value === true) {
          updated.damageFee = item.price || 0;
          if (!updated.returnNote) updated.returnNote = "Sách báo mất";
        } else if (field === 'isLost' && value === false) {
          updated.damageFee = 0;
        }

        // Nếu bật Damaged, gợi ý ghi chú nếu trống
        if (field === 'isDamaged' && value === true) {
          if (!updated.returnNote) updated.returnNote = "Sách hư hỏng";
        }
        
        return updated;
      }
      return item;
    }));
  };

  const confirmBulkReturn = async () => {
    if (!selectedDetailRecord || bulkReturnItems.length === 0) return;
    
    // VALIDATION: Kiểm tra tất cả các cuốn bị hỏng/mất xem đã có ghi chú và tiền đền bù chưa
    const missingDetails = bulkReturnItems.find(item => 
      (item.isDamaged || item.isLost) && (!item.returnNote || !item.returnNote.trim() || !item.damageFee || Number(item.damageFee) <= 0)
    );

    if (missingDetails) {
      const type = missingDetails.isLost ? 'MẤT' : 'HỎNG';
      if (!missingDetails.returnNote || !missingDetails.returnNote.trim()) {
        toast.error(`Thiếu ghi chú! Vui lòng nhập tình trạng ${type} cho cuốn: "${missingDetails.bookTitle}"`);
      } else {
        toast.error(`Thiếu phí bồi thường! Vui lòng nhập số tiền đền bù ${type} cho cuốn: "${missingDetails.bookTitle}"`);
      }
      return;
    }

    setReturning(true);
    const loadingToast = toast.loading("Đang xử lý thu hồi hàng loạt...");
    try {
      const res = await fetch('/api/admin/return-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: selectedDetailRecord.id,
          transactionId: selectedDetailRecord.transactionId || selectedDetailRecord.slipId,
          returnItems: bulkReturnItems.map(item => ({
             uid: item.uid,
             isLost: item.isLost,
             isDamaged: item.isDamaged, // Gửi flag hỏng
             damageFee: Number(item.damageFee) || 0,
             penaltyAmount: 0, 
             returnNote: item.returnNote || (item.isDamaged ? "Sách hư hỏng (Hủy)" : "Thu hồi hàng loạt")
          })),
          recordLateFee: Number(penaltyFee), 
          adminId: user.uid
        })
      });
      
      if (res.ok) {
        toast.success("Đã thu hồi toàn bộ sách thành công!", { id: loadingToast });
        setIsBulkReturnModalOpen(false);
        setIsDetailModalOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Có lỗi xảy ra khi thu hồi", { id: loadingToast });
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

  const handleSettleViolation = async (record) => {
    const totalFee = (record.books || []).reduce((acc, b) => acc + (b.damageFee || 0), 0) + (record.penaltyAmount || 0);
    const readerName = record.memberName || record.userName || "Độc giả";
    
    const confirmed = await confirmPremium(
      `Xác nhận độc giả ${readerName} đã hoàn tất đầy đủ các thủ tục bồi thường và đủ điều kiện để khôi phục quyền lợi mượn sách? \n\n(Tổng tiền bồi thường: ${totalFee.toLocaleString('vi-VN')}đ)`,
      "🛡️ Xác nhận mở khóa tài khoản"
    );
    if (!confirmed) return;

    const loadingToast = toast.loading("Đang xử lý hoàn tất...");
    try {
      const res = await fetch('/api/admin/settle-violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          recordId: record.id, 
          userId: record.userId,
          adminId: user.uid 
        })
      });

      if (res.ok) {
        toast.success("Đã xử lý vi phạm và mở khóa tài khoản thành công!", { id: loadingToast });
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Xử lý thất bại", { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi kết nối máy chủ", { id: loadingToast });
    }
  };

  // Helper: render countdown from deadline to now
  const renderCountdown = (record) => {
    let deadline = toJsDate(record.pickupDeadline);
    
    // Fallback: Nếu không có pickupDeadline nhưng đang chờ lấy, tính từ lúc duyệt (createdAt) + 24h
    if (!deadline && record.status === 'APPROVED_PENDING_PICKUP') {
      const start = toJsDate(record.createdAt || record.borrowDate);
      if (start) {
        deadline = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    if (!deadline) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;

    const diffMs = deadline - currentTime;
    if (diffMs <= 0) {
      return <span style={{ color: '#ff5f56', fontWeight: '700' }}>Hết hạn lấy</span>;
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

    if (timeRange === "CUSTOM") {
      if (!startDate && !endDate) return true;
      
      const start = startDate ? new Date(startDate) : null;
      if (start) start.setHours(0, 0, 0, 0);

      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999);

      if (start && end) return date >= start && date <= end;
      if (start) return date >= start;
      if (end) return date <= end;
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
            <div style={{ width: '180px' }}>
              <PremiumSelect 
                value={timeRange} 
                onChange={setTimeRange}
                options={[
                  { value: "ALL", label: "Tất cả" },
                  { value: "TODAY", label: "Hôm nay" },
                  { value: "WEEK", label: "Tuần này" },
                  { value: "MONTH", label: "Tháng này" },
                  { value: "CUSTOM", label: "Chọn ngày ▸" }
                ]}
              />
            </div>
            {timeRange === "CUSTOM" && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', opacity: 0.5 }}>Từ:</span>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      padding: '0.7rem 0.8rem 0.7rem 2.2rem',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(187,134,252,0.4)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', opacity: 0.5 }}>Đến:</span>
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      padding: '0.7rem 0.8rem 0.7rem 2.5rem',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(187,134,252,0.4)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            )}
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
            onClick={() => { setActiveTab('records'); setFilterStatus('LOST_LOCKED'); }}
            style={{
              background: (activeTab === 'records' && filterStatus === 'LOST_LOCKED') ? 'rgba(255,176,32,0.2)' : 'transparent',
              border: '1px solid ' + ((activeTab === 'records' && filterStatus === 'LOST_LOCKED') ? '#ffb020' : 'rgba(255,176,32,0.3)'),
              color: '#ffb020', padding: '0.6rem 1.1rem',
              borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
              whiteSpace: 'nowrap'
            }}
          >
            🆘 Vi phạm ({records.filter(r => r.status === 'LOST_LOCKED').length})
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
                    const isOverdue = rec.status === 'OVERDUE';

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
                      const isOverdue = status === 'OVERDUE';

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
                      const isOverdue = status === 'OVERDUE';
                      const isFinished = status === 'RETURNED' || status === 'RETURNED_OVERDUE' || status === 'CANCELLED_EXPIRED';
                      
                      const books = rec.books || [];
                      const returnedCount = books.filter(b => b.status === 'RETURNED' || b.status === 'RETURNED_OVERDUE').length;
                      
                      // Pre-calculate penalty details
                      const jsDueDateForRecord = toJsDate(rec.dueDate);
                      const penaltyInfo = calculatePenaltyDetails(jsDueDateForRecord, currentTime, config);

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
                              {renderCountdown(rec)}
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
                              background: (status === 'LOST_LOCKED' || (isActive && penaltyInfo.isLocked)) ? 'rgba(255,10,10,0.15)' : 
                                          status === 'LOST' ? 'rgba(255,10,10,0.2)' :
                                          status === 'DAMAGED' ? 'rgba(255,165,0,0.15)' :
                                          isOverdue ? 'rgba(255,95,86,0.1)' : 
                                          status === 'RETURNED_OVERDUE' ? 'rgba(255,176,32,0.1)' : 
                                          status === 'APPROVED_PENDING_PICKUP' ? 'rgba(187,134,252,0.1)' : 
                                          isActive ? 'rgba(39,201,63,0.1)' : 'rgba(255,255,255,0.05)',
                              color: (status === 'LOST_LOCKED' || (isActive && penaltyInfo.isLocked)) ? '#ff3131' : 
                                     status === 'LOST' ? '#ff4b2b' :
                                     status === 'DAMAGED' ? '#ffa502' :
                                     isOverdue ? '#ff5f56' : 
                                     status === 'RETURNED_OVERDUE' ? '#ffb020' : 
                                     status === 'APPROVED_PENDING_PICKUP' ? '#bb86fc' : 
                                     isActive ? '#27c93f' : 'rgba(255,255,255,0.4)',
                              padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800',
                              whiteSpace: 'nowrap',
                              border: (status === 'LOST_LOCKED' || status === 'LOST' || (isActive && penaltyInfo.isLocked)) ? '1px solid rgba(255,49,49,0.3)' : 
                                      status === 'DAMAGED' ? '1px solid rgba(255,165,0,0.3)' : 'none',
                              textTransform: 'uppercase'
                            }}>
                              {status === 'LOST_LOCKED' || (isActive && penaltyInfo.isLocked) ? 'Phong tỏa thẻ' : 
                               status === 'LOST' ? 'Mất Sách' :
                               status === 'DAMAGED' ? 'Sách Hỏng' :
                               isOverdue ? 'Quá Hạn' : 
                               status === 'RETURNED_OVERDUE' ? 'Đã Trả (Trễ)' : 
                               status === 'APPROVED_PENDING_PICKUP' ? 'Chờ Lấy' : 
                               status === 'PARTIALLY_RETURNED' ? 'Trả Một Phần' :
                               isActive ? 'Đang Mượn' : 'Đã trả'}
                            </span>
                          </td>
                          <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                              <button onClick={() => handleOpenDetail(rec)} style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Xem</button>
                              {filterStatus !== 'ALL' && status === 'APPROVED_PENDING_PICKUP' && (
                                <button onClick={() => handleConfirmPickup(rec.id)} style={{ background: 'rgba(187,134,252,0.15)', color: '#bb86fc', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', whiteSpace: 'nowrap' }}>Lấy Sách</button>
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
                  <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>📞 {selectedDetailRecord.userPhone || selectedDetailRecord.borrowerPhone || selectedDetailRecord.phone || "Trống"}</p>
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
                  const isReturned = ['RETURNED', 'RETURNED_OVERDUE', 'LOST', 'DAMAGED'].includes(book.status);
                  const isOverdue = selectedDetailRecord?.status === 'OVERDUE' && !isReturned;
                  const isLost = book.status === 'LOST';
                  const isDamaged = book.status === 'DAMAGED';

                  return (
                    <div key={idx} style={{ 
                      background: isReturned ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)', 
                      padding: '1.2rem 1.5rem', 
                      borderRadius: '16px', 
                      border: '1px solid ' + (isReturned ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)'),
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.8rem',
                      opacity: isReturned ? 0.8 : 1,
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '1rem', fontWeight: '700', color: isReturned ? 'rgba(255,255,255,0.5)' : '#fff', margin: '0 0 0.3rem 0' }}>
                            {idx + 1}. {book.bookTitle}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              padding: '0.15rem 0.5rem', 
                              borderRadius: '6px',
                              background: isReturned ? 'rgba(39,201,63,0.1)' : isOverdue ? 'rgba(255,95,86,0.1)' : 'rgba(187,134,252,0.1)',
                              color: isReturned ? '#27c93f' : isOverdue ? '#ff5f56' : '#bb86fc',
                              fontWeight: '800',
                              textTransform: 'uppercase'
                            }}>
                              {isReturned ? (book.status === 'RETURNED_OVERDUE' ? 'TRẢ MUỘN' : 'ĐÃ TRẢ') : isOverdue ? 'QUÁ HẠN' : 'ĐANG GIỮ'}
                            </span>
                            {isReturned && book.actualReturnDate && (
                              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                                Vào ngày {formatDate(book.actualReturnDate, true)}
                              </span>
                            )}
                          </div>
                        </div>

                        {!isReturned && (selectedDetailRecord?.status === 'BORROWING' || selectedDetailRecord?.status === 'PARTIALLY_RETURNED') && (
                          <button
                            onClick={() => handleReturnClick(selectedDetailRecord, book)}
                            style={{
                              background: 'rgba(39,201,63,0.1)',
                              color: '#27c93f',
                              border: '1px solid rgba(39,201,63,0.2)',
                              padding: '0.6rem 1.2rem',
                              borderRadius: '10px',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.background = 'rgba(39,201,63,0.2)'}
                            onMouseOut={(e) => e.target.style.background = 'rgba(39,201,63,0.1)'}
                          >
                            📥 Thu Hồi
                          </button>
                        )}
                      </div>

                      {/* CHI TIẾT KHI ĐÃ TRẢ */}
                      {isReturned && (book.returnNote || (book.penaltyAmount > 0)) && (
                        <div style={{ 
                          marginTop: '0.4rem', 
                          padding: '0.8rem', 
                          background: 'rgba(0,0,0,0.2)', 
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.03)',
                          fontSize: '0.85rem'
                        }}>
                          {book.returnNote && (
                            <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: (book.penaltyAmount > 0) ? '0.4rem' : 0 }}>
                              <span style={{ opacity: 0.4 }}>📝 Ghi chú:</span> "{book.returnNote}"
                            </div>
                          )}
                          {book.penaltyAmount > 0 && (
                            <div style={{ color: '#ffb020', fontWeight: '600' }}>
                              <span style={{ opacity: 0.6, fontWeight: '400', color: 'rgba(255,255,255,0.6)' }}>💰 Phí phạt:</span> {book.penaltyAmount.toLocaleString('vi-VN')} VNĐ
                            </div>
                          )}
                        </div>
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
              {(selectedDetailRecord?.status === 'BORROWING' || selectedDetailRecord?.status === 'PARTIALLY_RETURNED' || selectedDetailRecord?.status === 'OVERDUE' || selectedDetailRecord?.status === 'LOST_LOCKED') && (
                <button
                  onClick={() => handleOpenBulkReturn(selectedDetailRecord)}
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
                    {selectedReturnRecord?.record?.borrowerPhone || selectedReturnRecord?.record?.phone || selectedReturnRecord?.record?.userPhone ? (
                      <span style={{ color: '#fff', fontWeight: '500' }}>{selectedReturnRecord?.record?.borrowerPhone || selectedReturnRecord?.record?.phone || selectedReturnRecord?.record?.userPhone}</span>
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
                <label style={{ block: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Ghi chú tình trạng (Nếu có)</label>
                <textarea
                  placeholder="Ví dụ: Sách còn mới, rách trang 20, mất bìa..."
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  style={{
                    width: '100%', padding: '0.8rem', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.06)', 
                    border: (isDamaged || isLost) && (!returnNote || !returnNote.trim()) ? '1px solid rgba(255,95,86,0.6)' : '1px solid rgba(255,255,255,0.1)', 
                    color: '#fff', fontSize: '0.95rem', outline: 'none', minHeight: '80px', resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Tiền phạt trễ hạn (Tự tính)</label>
                  <input
                    type="number"
                    readOnly
                    value={penaltyFee}
                    style={{
                      width: '100%', padding: '0.8rem', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                      color: '#ffb020', fontSize: '1rem', fontWeight: 'bold', outline: 'none'
                    }}
                  />
                  <p style={{ fontSize: '0.65rem', color: 'rgba(255,95,86,0.5)', marginTop: '0.3rem' }}>* 5.000đ/ngày trễ</p>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Phí bồi thường/hỏng</label>
                  <input
                    type="number"
                    value={damageFee}
                    onChange={(e) => setDamageFee(e.target.value)}
                    readOnly={isLost}
                    style={{
                      width: '100%', padding: '0.8rem', borderRadius: '10px',
                      background: isLost ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)', 
                      border: isLost ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(187,134,252,0.3)',
                      color: isLost ? 'rgba(255,255,255,0.4)' : '#fff', 
                      fontSize: '1rem', fontWeight: 'bold', outline: 'none',
                      cursor: isLost ? 'not-allowed' : 'text'
                    }}
                  />
                  <p style={{ fontSize: '0.65rem', color: 'rgba(187,134,252,0.5)', marginTop: '0.3rem' }}>* Tự nhập nếu có hư hỏng</p>
                </div>
              </div>

              <div style={{ 
                marginBottom: '1rem', 
                padding: '1rem', 
                borderRadius: '12px', 
                background: isDamaged ? 'rgba(255,176,32,0.1)' : 'rgba(255,255,255,0.02)',
                border: '1px solid ' + (isDamaged ? 'rgba(255,176,32,0.2)' : 'rgba(255,255,255,0.05)'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: isDamaged ? '#ffb020' : '#fff' }}>Báo hỏng sách</h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                    Ghi nhận sách bị hư hỏng, cần bồi thường
                  </p>
                </div>
                <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                  <input 
                    type="checkbox" 
                    checked={isDamaged} 
                    onChange={(e) => handleIsDamagedToggle(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }} 
                  />
                  <span style={{ 
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: isDamaged ? '#ffb020' : '#333', transition: '0.4s', borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: isDamaged ? '28px' : '4px', bottom: '4px',
                      backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                    }}></span>
                  </span>
                </label>
              </div>

              <div style={{ 
                marginBottom: '1.5rem', 
                padding: '1rem', 
                borderRadius: '12px', 
                background: isLost ? 'rgba(255,95,86,0.1)' : 'rgba(255,255,255,0.02)',
                border: '1px solid ' + (isLost ? 'rgba(255,95,86,0.2)' : 'rgba(255,255,255,0.05)'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: isLost ? '#ff5f56' : '#fff' }}>Báo mất sách</h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                    Sẽ không cộng lại vào kho. Tự động lấy giá niêm yết.
                  </p>
                </div>
                <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                  <input 
                    type="checkbox" 
                    checked={isLost} 
                    onChange={(e) => handleIsLostToggle(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }} 
                  />
                  <span style={{ 
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: isLost ? '#ff5f56' : '#333', transition: '0.4s', borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '18px', width: '18px', left: isLost ? '28px' : '4px', bottom: '4px',
                      backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                    }}></span>
                  </span>
                </label>
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

      {/* BULK RETURN MODAL (Professional Version) */}
      {isBulkReturnModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(15px)'
        }}>
          <div style={{
            background: '#141414', width: '95%', maxWidth: '900px', maxHeight: '90vh',
            borderRadius: '28px', border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>📊 Thu Hồi & Tổng Kết Phí Phạt</h2>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.3rem' }}>
                  Độc giả: <span style={{ color: '#bb86fc', fontWeight: 'bold' }}>{selectedDetailRecord?.userName || selectedDetailRecord?.memberName}</span>
                </p>
              </div>
              <button 
                onClick={() => setIsBulkReturnModalOpen(false)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.8rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0 1rem' }}>Sách mượn</th>
                    <th style={{ textAlign: 'right', padding: '0 1rem', width: '200px' }}>Tình trạng</th>
                    <th style={{ textAlign: 'right', padding: '0 1rem', width: '200px' }}>Phí bồi/hỏng</th>
                    <th style={{ textAlign: 'center', padding: '0 1rem', width: '90px' }}>Mất</th>
                    <th style={{ textAlign: 'center', padding: '0 1rem', width: '90px' }}>Hỏng</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkReturnItems.map((item) => (
                    <React.Fragment key={item.uid}>
                      <tr style={{ 
                        background: item.isLost ? 'rgba(255,107,107,0.05)' : item.isDamaged ? 'rgba(255,165,0,0.05)' : 'rgba(255,255,255,0.02)', 
                        borderRadius: '12px',
                        border: '1px solid ' + (item.isLost ? 'rgba(255,107,107,0.1)' : item.isDamaged ? 'rgba(255,165,0,0.1)' : 'rgba(255,255,255,0.05)')
                      }}>
                        <td style={{ padding: '1.2rem 1rem', borderRadius: '12px 0 0 12px' }}>
                          <div style={{ fontWeight: '700', color: '#fff', marginBottom: '0.2rem' }}>{item.bookTitle}</div>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>ID: {item.uid.substring(0,8)}...</div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '0 1rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '0.2rem 0.6rem', 
                            borderRadius: '6px',
                            background: item.isLost ? '#ff4b2b22' : item.isDamaged ? '#ffa50222' : '#27c93f22',
                            color: item.isLost ? '#ff4b2b' : item.isDamaged ? '#ffa502' : '#27c93f',
                            fontWeight: '800'
                          }}>
                            {item.isLost ? 'MẤT SÁCH' : item.isDamaged ? 'HƯ HỎNG' : 'BÌNH THƯỜNG'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', padding: '0 1rem' }}>
                          <div style={{ position: 'relative' }}>
                            <input 
                              type="number"
                              value={item.damageFee}
                              onChange={(e) => handleBulkItemChange(item.uid, 'damageFee', e.target.value)}
                              readOnly={item.isLost}
                              style={{
                                width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px',
                                background: item.isLost ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)', 
                                border: item.isLost ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(255,255,255,0.1)',
                                color: item.isLost ? 'rgba(255,255,255,0.3)' : '#fff', 
                                textAlign: 'right', fontSize: '0.9rem', outline: 'none',
                                cursor: item.isLost ? 'not-allowed' : 'text'
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '0 0.5rem' }}>
                          <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '34px', height: '18px' }}>
                            <input 
                              type="checkbox" 
                              checked={item.isLost} 
                              onChange={(e) => {
                                handleBulkItemChange(item.uid, 'isLost', e.target.checked);
                                if (e.target.checked) handleBulkItemChange(item.uid, 'isDamaged', false);
                              }}
                              style={{ opacity: 0, width: 0, height: 0 }} 
                            />
                            <span style={{ 
                              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                              backgroundColor: item.isLost ? '#ff4b2b' : '#333', transition: '0.4s', borderRadius: '34px'
                            }}>
                              <span style={{
                                position: 'absolute', content: '""', height: '12px', width: '12px', left: item.isLost ? '18px' : '3px', bottom: '3px',
                                backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                              }}></span>
                            </span>
                          </label>
                        </td>
                        <td style={{ textAlign: 'center', padding: '0 0.5rem', borderRadius: '0 12px 12px 0' }}>
                          <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '34px', height: '18px' }}>
                            <input 
                              type="checkbox" 
                              checked={item.isDamaged} 
                              onChange={(e) => {
                                handleBulkItemChange(item.uid, 'isDamaged', e.target.checked);
                                if (e.target.checked) handleBulkItemChange(item.uid, 'isLost', false);
                              }}
                              style={{ opacity: 0, width: 0, height: 0 }} 
                            />
                            <span style={{ 
                              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                              backgroundColor: item.isDamaged ? '#ffa502' : '#333', transition: '0.4s', borderRadius: '34px'
                            }}>
                              <span style={{
                                position: 'absolute', content: '""', height: '12px', width: '12px', left: item.isDamaged ? '18px' : '3px', bottom: '3px',
                                backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                              }}></span>
                            </span>
                          </label>
                        </td>
                      </tr>
                      {(item.isDamaged || item.isLost) && (
                        <tr>
                          <td colSpan="5" style={{ padding: '0 1rem 1rem 1rem' }}>
                            <div style={{ 
                              background: 'rgba(0,0,0,0.2)', 
                              padding: '1rem', 
                              borderRadius: '0 0 12px 12px',
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderTop: 'none',
                              marginTop: '-0.8rem'
                            }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }}>
                                Ghi chú tình trạng {item.isLost ? 'mất sách' : 'hư hỏng'}:
                              </label>
                              <input 
                                type="text"
                                placeholder="Nhập lý do hoặc tình trạng chi tiết..."
                                value={item.returnNote || ""}
                                onChange={(e) => handleBulkItemChange(item.uid, 'returnNote', e.target.value)}
                                style={{
                                  width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px',
                                  background: 'rgba(255,255,255,0.05)', 
                                  border: (!item.returnNote || !item.returnNote.trim()) ? '1px solid rgba(255,95,86,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                  color: '#fff', fontSize: '0.85rem', outline: 'none'
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ 
              padding: '1.5rem 2.5rem', 
              background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(187,134,252,0.03))', 
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Phí trễ hạn (Đơn)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffb020' }}>
                    {Number(penaltyFee).toLocaleString('vi-VN')} đ
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Tổng phí bồi thường</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#fff' }}>
                    {bulkReturnItems.reduce((sum, item) => sum + Number(item.damageFee), 0).toLocaleString('vi-VN')} đ
                  </div>
                </div>
                <div style={{ width: '2px', background: 'rgba(255,255,255,0.05)', margin: '0 0.5rem' }}></div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#bb86fc', fontWeight: '800', textTransform: 'uppercase' }}>TỔNG CỘNG THU</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#bb86fc', textShadow: '0 0 20px rgba(187, 134, 252, 0.3)' }}>
                    {(Number(penaltyFee) + bulkReturnItems.reduce((sum, item) => sum + Number(item.damageFee), 0)).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => setIsBulkReturnModalOpen(false)} 
                  className="btn-outline"
                  style={{ padding: '0.8rem 2rem' }}
                >
                  Hủy
                </button>
                <button 
                  onClick={confirmBulkReturn}
                  disabled={returning}
                  className="btn-primary"
                  style={{ 
                    padding: '0.8rem 3rem',
                    background: 'linear-gradient(135deg, #bb86fc, #9965f4)',
                    boxShadow: '0 10px 25px -5px rgba(187, 134, 252, 0.4)'
                  }}
                >
                  {returning ? 'Đang xử lý...' : '🔥 XÁC NHẬN THU HỒI'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


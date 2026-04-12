"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "../../dashboard.module.css";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

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
  const [selectedBooks, setSelectedBooks] = useState([]); // Array now
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerPhone, setBorrowerPhone] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [offlineBorrowDate, setOfflineBorrowDate] = useState("");
  const [offlineDueDate, setOfflineDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // New member states
  const [phoneNumber, setPhoneNumber] = useState("");
  const [borrowerEmail, setBorrowerEmail] = useState("");
  const [isNewMember, setIsNewMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [searchingPhone, setSearchingPhone] = useState(false);
  const [currentBorrowCount, setCurrentBorrowCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState("ALL");

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  // Search member by phone number (Debounce 500ms)
  useEffect(() => {
    // Only search if length >= 10
    if (phoneNumber.length < 10) {
      if (phoneNumber.length === 0) {
        setIsNewMember(false);
        setSelectedMemberId("");
      }
      return;
    }

    const timer = setTimeout(async () => {
      // Basic format check: only digits, 10 chars
      if (!/^\d{10}$/.test(phoneNumber)) {
        toast.error("Số điện thoại phải gồm 10 chữ số.");
        return;
      }

      setSearchingPhone(true);
      const loadingToast = toast.loading("Đang tìm kiếm hội viên...");
      try {
        const res = await fetch(`/api/members?phone=${phoneNumber}`);
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          const member = data[0];
          setBorrowerName(member.name);
          setSelectedMemberId(member.id);
          setIsNewMember(false);
          setCurrentBorrowCount(member.borrowCount || 0);
          toast.success(`Tìm thấy hội viên: ${member.name}!`, { id: loadingToast });
        } else {
          setSelectedMemberId("");
          setIsNewMember(true);
          setCurrentBorrowCount(0);
          toast.info("Không tìm thấy thông tin. Đánh dấu độc giả mới.", { id: loadingToast });
        }
      } catch (error) {
        console.error("Lỗi tìm kiếm độc giả:", error);
        toast.error("Lỗi khi kết nối server.", { id: loadingToast });
      } finally {
        setSearchingPhone(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [phoneNumber]);

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
    setSelectedBooks([]);
    setBorrowerName("");
    setPhoneNumber("");
    setBorrowerEmail("");
    setIsNewMember(false);
    setSelectedMemberId("");
    setBorrowerPhone("");

    setBookSearch("");

    // Default dates: Today and 14 days later
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    const due = new Date();
    due.setDate(today.getDate() + 14);
    const formattedDue = due.toISOString().split('T')[0];

    setOfflineBorrowDate(formattedToday);
    setOfflineDueDate(formattedDue);

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
    setSelectedBooks([]);
    setBorrowerName("");
    setPhoneNumber("");
    setBorrowerEmail("");
    setIsNewMember(false);
    setSelectedMemberId("");
    setBorrowerPhone("");

    setBookSearch("");
  };

  const toggleBookSelection = (book) => {
    if (selectedBooks.find(b => b.id === book.id)) {
      setSelectedBooks(selectedBooks.filter(b => b.id !== book.id));
    } else {
      if (selectedBooks.length >= 3) {
        alert("Chỉ được mượn tối đa 3 cuốn sách một lần.");
        return;
      }
      setSelectedBooks([...selectedBooks, { id: book.id, title: book.title }]);
    }
  };

  const filteredBooks = allBooks.filter(b =>
    b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.author?.toLowerCase().includes(bookSearch.toLowerCase())
  );

  const handleOfflineSubmit = async (e) => {
    e.preventDefault();
    if (selectedBooks.length === 0 || !borrowerName.trim() || !phoneNumber.trim()) {
      toast.error("Vui lòng nhập đầy đủ SĐT, Tên và chọn Sách");
      return;
    }

    let memberId = selectedMemberId;

    setSubmitting(true);
    const mainToast = toast.loading("Đang xử lý yêu cầu...");

    try {
      // Logic Step 1: Create member if new
      if (isNewMember) {
        // Email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(borrowerEmail)) {
          toast.error("Email không hợp lệ.", { id: mainToast });
          setSubmitting(false);
          return;
        }

        const memberRes = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: borrowerName.trim(),
            phone: phoneNumber.trim(),
            email: borrowerEmail.trim()
          })
        });

        const memberData = await memberRes.json();
        if (!memberRes.ok) {
          throw new Error(memberData.error || "Không thể tạo độc giả mới");
        }

        // Atomic consistency: Update state immediately so we don't recreate on next try
        memberId = memberData.id;
        setSelectedMemberId(memberId);
        setIsNewMember(false);
        toast.success("Đã tạo thông tin độc giả mới.", { description: "Tiếp tục tạo phiếu mượn..." });
      }

      // Logic Step 2: Create borrow record
      const res = await fetch('/api/borrow-records', {

        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: memberId,
          userName: borrowerName.trim(),
          borrowerPhone: phoneNumber.trim(),

          books: selectedBooks.map(b => ({ bookId: b.id, bookTitle: b.title })),
          borrowDate: offlineBorrowDate,
          dueDate: offlineDueDate
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("🎉 Tạo phiếu mượn thành công!", { id: mainToast });
        closeModal();
        fetchData();
      } else {
        toast.error(data.error || "Có lỗi khi tạo phiếu", { id: mainToast });
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Lỗi kết nối server", { id: mainToast });
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

  const handleConfirmPickup = async (recordId, bookId) => {
    if (!confirm("Xác nhận hội viên đã đến lấy sách? (Hệ thống sẽ trừ số lượng sách trong kho)")) return;
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
      if (res.ok) fetchData();
      else {
        const data = await res.json();
        alert(data.error || "Xác nhận thất bại");
      }
    } catch (error) {
      console.error(error);
    }
  };



  return (
    <div style={{ position: 'relative' }}>
      <div className={styles.headerArea} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h1 className={styles.pageTitle}>Quản Lý Mượn Trả</h1>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.2rem' }}>
          <button onClick={openOfflineModal} style={{
            background: 'linear-gradient(135deg, #27c93f, #1fa834)',
            border: 'none', color: '#fff', padding: '0.6rem 1.2rem',
            borderRadius: '8px', fontWeight: '600', cursor: 'pointer',
            fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}>
            + Tạo Phiếu offline
          </button>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }}></div>

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
            Lấy Sách ({records.filter(r => r.status === 'APPROVED_PENDING_PICKUP').length})
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
              borderRadius: '20px',
              width: '100%', maxWidth: '520px',
              maxHeight: '90vh',
              display: 'flex', flexDirection: 'column',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '1.5rem 2rem',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.2rem' }}>Tạo Phiếu Mượn</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Nhập thông tin người mượn và chọn sách</p>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>

            <form onSubmit={handleOfflineSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Scrollable Content */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.5rem 2rem',
                display: 'flex', flexDirection: 'column', gap: '1.2rem'
              }}>
                {/* Phone Number search */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: '500' }}>
                    Số điện thoại
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Nhập 10 số để tìm kiếm độc giả..."
                      autoFocus
                      style={{
                        width: '100%', padding: '0.9rem 1rem', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)', color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '1rem', outline: 'none'
                      }}
                      required
                    />
                    {searchingPhone && (
                      <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: '#bb86fc' }}>
                        <span className={styles.spinner}></span> Đang tìm...
                      </div>
                    )}
                  </div>
                  {phoneNumber.length >= 10 && !searchingPhone && (
                    <div style={{
                      marginTop: '0.5rem', padding: '0.5rem 0.8rem', borderRadius: '6px',
                      fontSize: '0.8rem',
                      background: isNewMember ? 'rgba(255,204,0,0.1)' : 'rgba(39,201,63,0.1)',
                      color: isNewMember ? '#ffcc00' : '#27c93f',
                      border: `1px solid ${isNewMember ? 'rgba(255,204,0,0.2)' : 'rgba(39,201,63,0.2)'}`
                    }}>
                      {isNewMember ? (
                        <div>ⓘ <strong>Độc giả mới</strong> - Vui lòng nhập thêm Tên & Email phía dưới.</div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>✓ <strong>Độc giả hợp lệ</strong></span>
                          <span style={{ color: currentBorrowCount >= 5 ? '#ff5f56' : 'inherit' }}>
                            Đang mượn: <strong>{currentBorrowCount} cuốn</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {currentBorrowCount >= 5 && !isNewMember && (
                    <div style={{ marginTop: '0.5rem', color: '#ff5f56', fontSize: '0.75rem', fontWeight: '600' }}>
                      ⚠ Cảnh báo: Độc giả đã đạt giới hạn mượn sách tối đa (5 cuốn).
                    </div>
                  )}
                </div>

                {/* Borrower Name */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: '500' }}>
                    Tên người mượn
                  </label>
                  <input
                    type="text"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    placeholder={selectedMemberId ? "" : "Nhập họ tên người mượn..."}
                    readOnly={!!selectedMemberId}
                    style={{
                      width: '100%', padding: '0.9rem 1rem', borderRadius: '10px',
                      background: selectedMemberId ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                      color: selectedMemberId ? 'rgba(255,255,255,0.5)' : '#fff',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '1rem', outline: 'none'
                    }}
                    required
                  />
                </div>

                {/* Email (only for new member) */}
                {isNewMember && (
                  <div style={{ animation: 'fadeIn 0.3s' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: '500' }}>
                      Email (Bắt buộc cho độc giả mới)
                    </label>
                    <input
                      type="email"
                      value={borrowerEmail}
                      onChange={(e) => setBorrowerEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      style={{
                        width: '100%', padding: '0.9rem 1rem', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)', color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '1rem', outline: 'none'
                      }}
                      required={isNewMember}
                    />
                  </div>
                )}


                {/* Date Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: '500' }}>
                      Ngày mượn (Tự động)
                    </label>
                    <input
                      type="date"
                      value={offlineBorrowDate}
                      onChange={(e) => setOfflineBorrowDate(e.target.value)}
                      style={{
                        width: '100%', padding: '0.9rem 1rem', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)', color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '0.9rem', outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: '500' }}>
                      Hạn trả
                    </label>
                    <input
                      type="date"
                      value={offlineDueDate}
                      onChange={(e) => setOfflineDueDate(e.target.value)}
                      style={{
                        width: '100%', padding: '0.9rem 1rem', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)', color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '0.9rem', outline: 'none'
                      }}
                    />
                  </div>
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
                      <div style={{ padding: '0.8rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
                        Không tìm thấy sách phù hợp
                      </div>
                    ) : (
                      filteredBooks.map(b => {
                        const isSelected = selectedBooks.some(sb => sb.id === b.id);
                        return (
                          <div
                            key={b.id}
                            onClick={() => toggleBookSelection(b)}
                            style={{
                              padding: '0.7rem 1rem',
                              cursor: 'pointer',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              background: isSelected ? 'rgba(187,134,252,0.15)' : 'transparent',
                              borderLeft: isSelected ? '3px solid #bb86fc' : '3px solid transparent',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div>
                              <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: isSelected ? '600' : '400' }}>{b.title}</div>
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{b.author}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {isSelected && <span style={{ color: '#bb86fc', fontSize: '1rem' }}>✓</span>}
                              <span style={{
                                fontSize: '0.7rem', padding: '0.15rem 0.4rem',
                                background: 'rgba(39,201,63,0.12)', color: '#27c93f',
                                borderRadius: '4px', fontWeight: '600', flexShrink: 0
                              }}>
                                Còn {b.quantity}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Selected Books Preview */}
                {selectedBooks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
                      Sách đã chọn ({selectedBooks.length}/3)
                    </div>
                    {selectedBooks.map(book => (
                      <div key={book.id} style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '0.6rem 1rem', borderRadius: '10px',
                        background: 'rgba(187,134,252,0.08)', border: '1px solid rgba(187,134,252,0.2)'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.9rem' }}>{book.title}</div>
                        </div>
                        <button type="button" onClick={() => setSelectedBooks(selectedBooks.filter(b => b.id !== book.id))} style={{ background: 'none', border: 'none', color: '#ff5f56', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
              {/* Actions sticky at bottom */}
              <div style={{
                padding: '1.2rem 2rem',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(255,255,255,0.01)',
                display: 'flex', gap: '0.8rem'
              }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    flex: 1, padding: '0.8rem', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
                    color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontWeight: '500', fontSize: '0.9rem'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedBooks.length === 0 || !borrowerName.trim() || !phoneNumber.trim() || (!isNewMember && currentBorrowCount >= 5)}

                  style={{
                    flex: 2, padding: '0.8rem', borderRadius: '10px',
                    border: 'none',
                    background: (submitting || selectedBooks.length === 0 || !borrowerName.trim() || !phoneNumber.trim() || (!isNewMember && currentBorrowCount >= 5)) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #bb86fc, #9965f4)',
                    color: (submitting || selectedBooks.length === 0 || !borrowerName.trim() || !phoneNumber.trim() || (!isNewMember && currentBorrowCount >= 5)) ? 'rgba(255,255,255,0.2)' : '#fff',
                    fontWeight: '700', cursor: (submitting || selectedBooks.length === 0 || !borrowerName.trim() || !phoneNumber.trim() || (!isNewMember && currentBorrowCount >= 5)) ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem', transition: 'all 0.2s'

                  }}
                >
                  {submitting ? "Đang xử lý..." : (currentBorrowCount >= 5 && !isNewMember ? "Giới hạn đã đạt" : "Xác Nhận Mượn")}
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
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Mượn</th>
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hạn Trả</th>
                    <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Trả</th>
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
                          <td style={{ padding: '1rem', fontWeight: '500' }}>{rec.memberName || rec.userName}</td>
                          <td style={{ padding: '1rem' }}>{rec.bookTitle}</td>
                          <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                            {formatDate(rec.borrowDate, true)}
                          </td>
                          <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                            {formatDate(rec.dueDate, true)}
                          </td>
                          <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                            {formatDate(rec.returnDate, true)}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{
                              background: isOverdue ? 'rgba(255,95,86,0.15)' : rec.status === 'APPROVED_PENDING_PICKUP' ? 'rgba(187,134,252,0.15)' : isActive ? 'rgba(39,201,63,0.15)' : 'rgba(255,255,255,0.06)',
                              color: isOverdue ? '#ff5f56' : rec.status === 'APPROVED_PENDING_PICKUP' ? '#bb86fc' : isActive ? '#27c93f' : 'rgba(255,255,255,0.4)',
                              padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600',
                              whiteSpace: 'nowrap', display: 'inline-block',
                              minWidth: '100px', textAlign: 'center'
                            }}>
                              {isOverdue ? 'QUÁ HẠN' : rec.status === 'APPROVED_PENDING_PICKUP' ? 'CHỜ LẤY SÁCH' : isActive ? 'ĐANG MƯỢN' : 'ĐÃ TRẢ'}
                            </span>
                          </td>
                          {filterStatus !== 'ALL' && (
                            <td style={{ padding: '1rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {rec.status === 'APPROVED_PENDING_PICKUP' && (
                                  <button onClick={() => handleConfirmPickup(rec.id, rec.bookId)} style={{ background: 'rgba(187,134,252,0.15)', color: '#bb86fc', border: 'none', padding: '0.35rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                                    Xác nhận lấy sách
                                  </button>
                                )}
                                {isActive && (
                                  <button onClick={() => handleReturn(rec.id, rec.bookId)} className="btn-outline" style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}>
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
    </div>
  );
}

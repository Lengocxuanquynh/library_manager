"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

export default function ManageMembers() {
  const { user } = useAuth();
  const { confirmPremium } = useConfirm();
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // History view state
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberHistory, setMemberHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members');
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải danh sách độc giả.");
    } finally {
      setLoading(false);
    }
  };

  const viewHistory = async (member) => {
    if (!user?.uid) return;
    setSelectedMember(member);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/borrow-records?adminId=${user.uid}`);
      const allRecords = await res.json();
      const filtered = Array.isArray(allRecords) ? allRecords.filter(r => r.userId === member.id || r.memberName === member.name) : [];
      setMemberHistory(filtered);
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi tải lịch sử mượn trả.");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Removed handAddMember due to security vulnerabilities

  const handleResetPassword = async (email) => {
    if (!email) {
      toast.error("Độc giả này chưa có email!");
      return;
    }
    const loadToast = toast.loading("Đang gửi email đặt lại mật khẩu...");
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.", { id: loadToast });
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi gửi email đặt lại mật khẩu.", { id: loadToast });
    }
  };

  const handleDelete = async (member) => {
    const { id, uid, email } = member;
    const confirmed = await confirmPremium(
      `Bạn có chắc chắn muốn xóa độc giả "${member.name}" không? Tài khoản Authentication cũng sẽ bị xóa vĩnh viễn.`,
      "⚠️ Cảnh báo Xóa Vĩnh viễn"
    );
    if (!confirmed) return;
    
    const loadToast = toast.loading("Đang xóa độc giả và tài khoản...");
    try {
      const res = await fetch('/api/admin/delete-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, uid, email })
      });
      
      // Step 1: Handle success (status 200-299)
      if (res.ok) {
        // Essential: Optimistic UI update
        setMembers(prev => prev.filter(member => member.id !== id));
        toast.success("Đã xóa độc giả thành công.", { id: loadToast });
        router.refresh();
        return; // Success, no need to parse JSON body
      }

      // Step 2: Handle API errors (status 400, 500, etc.)
      // Always try to get error message from server but fall back to default
      let errorMessage = "Không thể xóa độc giả.";
      try {
        const data = await res.json();
        errorMessage = data.error || errorMessage;
      } catch (e) {
        // Fallback for empty or non-JSON error bodies
        if (res.status === 400) errorMessage = "Không thể xóa vì độc giả đang mượn sách hoặc quá hạn.";
      }

      toast.error(errorMessage, { id: loadToast });
    } catch (error) {
      console.error(error);
      toast.error("Lỗi kết nối máy chủ hoặc sự cố mạng.", { id: loadToast });
    }
  };

  const handleUnlock = async (member) => {
    const { id, name } = member;
    const confirmed = await confirmPremium(
      `Phải đảm bảo xác nhận ${name} đã hoàng thành thủ tục mở khóa tài khoản với phòng chăm sóc sinh viên.`,
      "🔐 Xác nhận Mở khóa"
    );
    if (!confirmed) return;
    
    const loadToast = toast.loading("Đang mở khóa tài khoản...");
    try {
      const res = await fetch('/api/admin/unlock-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, adminId: user?.uid })
      });
      
      if (res.ok) {
        toast.success(`Đã mở khóa tài khoản cho ${name}`, { id: loadToast });
        fetchMembers(); // Tải lại danh sách
      } else {
        const data = await res.json();
        toast.error(data.error || "Mở khóa thất bại", { id: loadToast });
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi kết nối máy chủ", { id: loadToast });
    }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Độc Giả (Hợp Nhất)</h1>
      </div>

      {/* 🔍 Search Bar - Premium Glassmorphism */}
      <div style={{ 
        background: 'rgba(255,255,255,0.02)', 
        padding: '1.5rem', 
        borderRadius: '16px', 
        marginBottom: '2rem', 
        display: 'flex', 
        gap: '1.5rem', 
        alignItems: 'center',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <input 
          type="text" 
          placeholder="Tìm độc giả theo tên, email, sđt hoặc mã..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          style={{ 
            flex: 1, 
            padding: '0.9rem 1.2rem', 
            borderRadius: '12px', 
            background: 'rgba(0,0,0,0.3)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            color: '#fff',
            fontSize: '0.95rem',
            outline: 'none',
            transition: '0.3s'
          }} 
          onFocus={e => e.target.style.borderColor = '#bb86fc'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
          Đang hiển thị {members.filter(m => 
            m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (m.username && m.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
            m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.phone && m.phone.includes(searchTerm)) ||
            (m.memberCode && m.memberCode.toLowerCase().includes(searchTerm.toLowerCase()))
          ).length} kết quả
        </div>
      </div>

      {/* History Modal */}
      {selectedMember && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={() => setSelectedMember(null)}>
          <div style={{ background: '#1e1e1e', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem' }}>Lịch sử mượn trả: {selectedMember.name}</h2>
              <button onClick={() => setSelectedMember(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              {historyLoading ? (
                <p style={{ textAlign: 'center', opacity: 0.5 }}>Đang tải lịch sử...</p>
              ) : memberHistory.length === 0 ? (
                <p style={{ textAlign: 'center', opacity: 0.3, padding: '2rem' }}>Độc giả này chưa mượn cuốn sách nào.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ opacity: 0.5, fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '0.8rem' }}>Tên sách</th>
                      <th style={{ padding: '0.8rem' }}>Ngày mượn</th>
                      <th style={{ padding: '0.8rem' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberHistory.map(record => (
                      (record.books || []).map(book => (
                        <tr key={book.uid || `${record.id}-${book.bookId}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '0.8rem' }}>{book.bookTitle}</td>
                          <td style={{ padding: '0.8rem', opacity: 0.6 }}>
                            {(() => {
                              const d = record.borrowDate;
                              if (!d) return '—';
                              if (typeof d.toDate === 'function') return d.toDate().toLocaleDateString('vi-VN');
                              if (d.seconds) return new Date(d.seconds * 1000).toLocaleDateString('vi-VN');
                              if (d._seconds) return new Date(d._seconds * 1000).toLocaleDateString('vi-VN');
                              const dt = new Date(d);
                              return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('vi-VN');
                            })()}
                          </td>
                          <td style={{ padding: '0.8rem' }}>
                            <span style={{ 
                              padding: '1px 6px', borderRadius: '4px', fontSize: '0.75rem', 
                              background: (book.status === 'RETURNED' || book.status === 'RETURNED_OVERDUE') ? 'rgba(255,255,255,0.05)' : 'rgba(39,201,63,0.12)',
                              color: (book.status === 'RETURNED' || book.status === 'RETURNED_OVERDUE') ? 'rgba(255,255,255,0.4)' : '#27c93f'
                            }}>
                              {(book.status === 'RETURNED' || book.status === 'RETURNED_OVERDUE') ? 'Đã trả' : 'Đang mượn'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
        {loading ? (
          <p style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>Đang tải danh sách...</p>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', width: '30%' }}>Thành viên</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', width: '15%' }}>Định danh</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', width: '35%' }}>Liên hệ</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', width: '20%' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', opacity: 0.3 }}>Chưa có độc giả nào.</td>
                  </tr>
                ) : (
                  members
                    .filter(m => 
                      m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (m.username && m.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
                      m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (m.phone && m.phone.includes(searchTerm)) ||
                      (m.memberCode && m.memberCode.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map(member => (
                    <tr key={member.id} style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: member.isLocked ? 'rgba(255, 95, 86, 0.1)' : 'transparent'
                    }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span style={{ fontWeight: '600', color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {member.isLocked && <span title="Tài khoản bị khóa" style={{ color: '#ff5f56' }}>🔒</span>}
                            {member.name}
                          </span>
                          <span style={{ fontSize: '0.85rem', color: 'rgba(255,193,7,0.7)', fontWeight: '500' }}>
                            {member.username ? `@${member.username}` : '@chua_co_id'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                         <div style={{ fontFamily: 'monospace', color: '#bb86fc', fontSize: '0.95rem', fontWeight: '600' }}>
                           {member.memberCode || `DG-${(member.uid || member.id).slice(-5).toUpperCase()}`}
                         </div>
                      </td>
                      <td style={{ padding: '1rem', maxWidth: '0' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflow: 'hidden' }}>
                          <span 
                            title={member.email}
                            style={{ 
                              color: 'rgba(255,255,255,0.8)', 
                              fontSize: '0.9rem', 
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {member.email}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>{member.phone || 'SĐT: —'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {member.isLocked ? (
                            <button onClick={() => handleUnlock(member)} style={{ background: 'rgba(39, 201, 63, 0.15)', color: '#27c93f', border: '1px solid rgba(39, 201, 63, 0.3)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700' }}>Mở khóa</button>
                          ) : (
                            <button onClick={() => viewHistory(member)} style={{ background: 'rgba(187, 134, 252, 0.1)', color: '#bb86fc', border: '1px solid rgba(187, 134, 252, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>Lịch sử</button>
                          )}
                          <button onClick={() => handleResetPassword(member.email)} style={{ background: 'rgba(255, 193, 7, 0.1)', color: '#ffc107', border: '1px solid rgba(255, 193, 7, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>Reset MK</button>
                          <button onClick={() => handleDelete(member)} style={{ background: 'rgba(255, 95, 86, 0.05)', color: '#ff5f56', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>Xoá</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

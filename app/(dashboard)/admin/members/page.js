"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ManageMembers() {
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  
  // History view state
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberHistory, setMemberHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMember.name || !newMember.email) return;

    setSubmitting(true);
    const loadToast = toast.loading("Đang thêm độc giả...");
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember)
      });

      if (res.ok) {
        setNewMember({ name: '', email: '', phone: '' });
        setShowForm(false);
        fetchMembers();
        toast.success("Thêm độc giả mới thành công!", { id: loadToast });
      } else {
        const data = await res.json();
        toast.error(data.error || "Lỗi khi thêm độc giả", { id: loadToast });
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi kết nối server.", { id: loadToast });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Bạn có chắc chắn muốn xóa độc giả này không? Hành động này không thể hoàn tác.")) return;
    
    const loadToast = toast.loading("Đàng xóa độc giả...");
    try {
      const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
      
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

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Độc Giả</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Hủy" : "Thêm Độc Giả Mới"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Đăng ký Độc giả mới</h3>
          <form onSubmit={handleAddMember} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', opacity: 0.6 }}>Họ Tên</label>
              <input 
                type="text" 
                placeholder="Ví dụ: Nguyễn Văn A" 
                value={newMember.name}
                onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', opacity: 0.6 }}>Email</label>
              <input 
                type="email" 
                placeholder="email@example.com" 
                value={newMember.email}
                onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                required
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', opacity: 0.6 }}>Số điện thoại</label>
              <input 
                type="text" 
                placeholder="09xx..." 
                value={newMember.phone}
                onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ gridColumn: 'span 2', padding: '1rem' }}>Lưu thông tin</button>
          </form>
        </div>
      )}

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
                    {memberHistory.map(rec => (
                      <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '0.8rem' }}>{rec.bookTitle}</td>
                        <td style={{ padding: '0.8rem', opacity: 0.6 }}>{rec.borrowDate?.toDate ? rec.borrowDate.toDate().toLocaleDateString('vi-VN') : '—'}</td>
                        <td style={{ padding: '0.8rem' }}>
                          <span style={{ 
                            padding: '1px 6px', borderRadius: '4px', fontSize: '0.75rem', 
                            background: rec.status === 'RETURNED' ? 'rgba(255,255,255,0.05)' : 'rgba(39,201,63,0.12)',
                            color: rec.status === 'RETURNED' ? 'rgba(255,255,255,0.4)' : '#27c93f'
                          }}>
                            {rec.status === 'RETURNED' ? 'Đã trả' : 'Đang mượn'}
                          </span>
                        </td>
                      </tr>
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
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Họ Tên</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Email</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>SĐT</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', opacity: 0.3 }}>Chưa có độc giả nào.</td>
                  </tr>
                ) : (
                  members.map(member => (
                    <tr key={member.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{member.name}</td>
                      <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>{member.email}</td>
                      <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>{member.phone || '—'}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => viewHistory(member)} style={{ background: 'rgba(187, 134, 252, 0.1)', color: '#bb86fc', border: '1px solid rgba(187, 134, 252, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>Lịch sử</button>
                          <button onClick={() => handleDelete(member.id)} style={{ background: 'rgba(255, 95, 86, 0.05)', color: '#ff5f56', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>Xoá</button>
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

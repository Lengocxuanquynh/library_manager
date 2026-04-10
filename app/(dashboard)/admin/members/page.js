"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";

export default function ManageMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/members');
      const data = await res.json();
      setMembers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMember.name || !newMember.email) return;

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
      } else {
        alert("Lỗi khi thêm hội viên qua API");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa hội viên này không?")) {
      await fetch(`/api/members/${id}`, { method: 'DELETE' });
      fetchMembers();
    }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Hội Viên</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Hủy" : "Thêm Hội Viên"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Thêm Hội Viên (Offline)</h3>
          <form onSubmit={handleAddMember} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
            <input 
              type="text" 
              placeholder="Họ Tên" 
              value={newMember.name}
              onChange={(e) => setNewMember({...newMember, name: e.target.value})}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              required
            />
            <input 
              type="email" 
              placeholder="Email" 
              value={newMember.email}
              onChange={(e) => setNewMember({...newMember, email: e.target.value})}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              required
            />
            <input 
              type="text" 
              placeholder="Số điện thoại" 
              value={newMember.phone}
              onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', gridColumn: 'span 2' }}
            />
            <button type="submit" className="btn-primary" style={{ gridColumn: 'span 2' }}>Lưu Hội Viên</button>
          </form>
        </div>
      )}

      <div className={styles.tableCard} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.5rem' }}>
        {loading ? (
          <p>Đang tải danh sách...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Họ Tên</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Email</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>SĐT</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }}>Chưa có hội viên nào.</td>
                </tr>
              ) : (
                members.map(member => (
                  <tr key={member.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{member.name}</td>
                    <td style={{ padding: '1rem' }}>{member.email}</td>
                    <td style={{ padding: '1rem' }}>{member.phone || 'N/A'}</td>
                    <td style={{ padding: '1rem' }}>
                      <button onClick={() => handleDelete(member.id)} style={{ background: 'rgba(255, 95, 86, 0.1)', color: '#ff5f56', border: '1px solid rgba(255, 95, 86, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer' }}>Xoá</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

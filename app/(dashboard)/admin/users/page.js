"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import styles from "../../dashboard.module.css";

export default function ManageSystemUsers() {
  const { user } = useAuth();
  const { confirmPremium } = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const confirmMsg = newRole === 'admin'
      ? `Bạn có chắc muốn nâng thư quyền Admin cho người dùng này?`
      : `Bạn có chắc muốn gỡ quyền Admin của người dùng này?`;

    const confirmed = await confirmPremium(confirmMsg, "🛡️ Cập nhật Quyền hạn");
    if (confirmed) {
      try {
        const res = await fetch(`/api/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole })
        });
        if (res.ok) {
          fetchUsers();
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Tài Khoản Hệ Thống</h1>
      </div>

      <div className={styles.tableCard} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.5rem', marginTop: '1rem' }}>
        {loading ? (
          <p>Đang tải dữ liệu...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Tên</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Email</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Vai Trò</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }}>Chưa có tài khoản nào.</td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{u.name}</td>
                    <td style={{ padding: '1rem' }}>{u.email}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        background: u.role === 'admin' ? 'rgba(187, 134, 252, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        color: u.role === 'admin' ? '#bb86fc' : '#aaa',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem'
                      }}>
                        {u.role === 'admin' ? 'Admin' : 'Thành viên'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {u.id !== user.uid && (
                        <button
                          onClick={() => handleUpdateRole(u.id, u.role)}
                          className="btn-outline"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                        >
                          {u.role === 'admin' ? 'Gỡ quyền Admin' : 'Cấp quyền Admin'}
                        </button>
                      )}
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

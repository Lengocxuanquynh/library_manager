"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "../../dashboard.module.css";

export default function AdminSettings() {
  const { user, role } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user?.displayName) {
      setName(user.displayName);
    }
  }, [user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`/api/users/${user.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Cập nhật hồ sơ thành công!' });
        // The AuthProvider will automatically sync the new name
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Có lỗi xảy ra' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Lỗi kết nối máy chủ' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Cài Đặt Hệ Thống</h1>
      </div>

      <div className={styles.grid}>
        {/* Profile Card */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ 
            width: '100px', 
            height: '100px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, #6e8efb, #a777e3)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '1.5rem',
            boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
          }}>
            {name ? name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{name || "Admin"}</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>{user?.email}</p>
          <span style={{ 
            background: 'rgba(110, 142, 251, 0.2)', 
            color: '#6e8efb', 
            padding: '0.4rem 1rem', 
            borderRadius: '20px', 
            fontSize: '0.85rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {role}
          </span>
        </div>

        {/* Settings Form */}
        <div className={styles.card} style={{ gridColumn: 'span 2' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>Chỉnh Sửa Hồ Sơ</h3>
          
          <form onSubmit={handleUpdate} style={{ display: 'grid', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Họ và Tên</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập họ tên của bạn"
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  borderRadius: '10px', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  background: 'rgba(0,0,0,0.2)', 
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Email (Không thể thay đổi)</label>
              <input 
                type="email" 
                value={user?.email || ""}
                disabled
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  borderRadius: '10px', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  background: 'rgba(255,255,255,0.05)', 
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '1rem',
                  cursor: 'not-allowed'
                }}
              />
            </div>

            {message.text && (
              <div style={{ 
                padding: '1rem', 
                borderRadius: '8px', 
                background: message.type === 'success' ? 'rgba(39, 201, 63, 0.1)' : 'rgba(255, 95, 86, 0.1)',
                color: message.type === 'success' ? '#27c93f' : '#ff5f56',
                fontSize: '0.9rem'
              }}>
                {message.text}
              </div>
            )}

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading}
              style={{ padding: '1rem', fontSize: '1rem', marginTop: '1rem' }}
            >
              {loading ? "Đang lưu..." : "Lưu Thay Đổi"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

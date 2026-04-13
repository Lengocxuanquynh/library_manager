"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "../../dashboard.module.css";
import Link from "next/link";
import { updateUserProfile } from "@/services/auth";

export default function UserSettings() {
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
      await updateUserProfile(user.uid, { name });
      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Lỗi cập nhật hồ sơ' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Cài Đặt Tài Khoản</h1>
        <Link href="/user" className="btn-outline">Quay lại Hồ Sơ</Link>
      </div>

      <div className={styles.grid}>
        {/* Profile Summary */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ 
            width: '90px', 
            height: '90px', 
            borderRadius: '50%', 
            background: 'rgba(255,255,255,0.05)', 
            border: '2px solid rgba(255,255,255,0.1)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '2.2rem',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '1.2rem'
          }}>
            {name ? name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>{name || "Độc giả"}</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '1.2rem' }}>{user?.email}</p>
          <div style={{ padding: '0.3rem 0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
            Hạng: <strong>Thành viên Thường</strong>
          </div>
        </div>

        {/* Update Form */}
        <div className={styles.card} style={{ gridColumn: 'span 2' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Thông Tin Cá Nhân</h3>
          
          <form onSubmit={handleUpdate} style={{ display: 'grid', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Họ và Tên</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '0.9rem', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    background: 'rgba(255,255,255,0.05)', 
                    color: 'white'
                  }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Email</label>
                <input 
                  type="email" 
                  value={user?.email || ""}
                  disabled
                  style={{ 
                    width: '100%', 
                    padding: '0.9rem', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(255,255,255,0.02)', 
                    background: 'rgba(255,255,255,0.02)', 
                    color: 'rgba(255,255,255,0.3)',
                    cursor: 'not-allowed'
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(255,189,46,0.05)', borderRadius: '8px', borderLeft: '3px solid #ffbd2e' }}>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,189,46,0.8)', margin: 0 }}>
                <strong>Lưu ý:</strong> Để thay đổi Email hoặc Mật khẩu, vui lòng liên hệ Ban quản trị thư viện.
              </p>
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
              style={{ padding: '1rem', width: 'fit-content', minWidth: '150px' }}
            >
              {loading ? "Đang lưu..." : "Cập Nhật Hồ Sơ"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
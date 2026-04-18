"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';

export default function MagicTools() {
  const { user, role: authRole, loading: authLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [daysToAdjust, setDaysToAdjust] = useState(-1);
  const [statusInfo, setStatusInfo] = useState(null);

  const role = (authRole === 'admin' || user?.email === 'admin@library.vn') ? 'admin' : 'user';
  const userId = user?.uid;

  const fetchStatus = async () => {
    if (!userId) return;
    try {
      const res = await fetch('/api/test/magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GET_LATEST_STATUS', userId })
      });
      if (res.ok) {
        const data = await res.json();
        setStatusInfo(data);
      }
    } catch (err) {
      console.error("Fetch status failed:", err);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 30000); // 30s refresh
      return () => clearInterval(interval);
    }
  }, [isOpen, userId]);

  if (authLoading || !user) return null;

  const performMagic = async (action, payload = {}) => {
    setLoading(true);
    const toastId = toast.loading("💫 Đang thực hiện phép thuật...");
    try {
      const isMock = typeof window !== "undefined" && localStorage.getItem("DEV_MOCK_EMAIL") === "true";
      const res = await fetch('/api/test/magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, isMock, ...payload })
      });

      if (res.ok) {
        toast.success("✨ Phép thuật thành công!", { id: toastId });
        // Tự động reload để thấy kết quả
        window.location.reload();
      } else {
        const err = await res.json();
        toast.error(err.error || "Phép thuật thất bại", { id: toastId });
      }
    } catch (error) {
      toast.error("Lỗi triệu hồi phép thuật", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const triggerScan = async () => {
    setLoading(true);
    const toastId = toast.loading("🔮 Đang cưỡng chế quét hệ thống...");
    try {
      const res = await fetch('/api/admin/notify-overdue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: userId })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Quét xong! Khóa ${data.summary.lockedAccounts} acc, gửi ${data.summary.remindedOverdue} mail.`, { id: toastId });
        window.location.reload();
      } else {
        toast.error("Quét thất bại (Cần quyền Admin)", { id: toastId });
      }
    } catch (error) {
      toast.error("Lỗi hệ thống", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '2rem', left: '2rem', zIndex: 9999 }}>
      {/* NÚT KÍCH HOẠT (QUẢ CẦU) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '60px', height: '60px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #a435f0, #6200ee)',
          color: 'white', border: 'none', cursor: 'pointer',
          boxShadow: '0 10px 30px rgba(98, 0, 238, 0.4)',
          fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: isOpen ? 'rotate(180deg) scale(0.9)' : 'scale(1)',
          animation: 'magic-pulse 2s infinite'
        }}
        title="Túi Phép Thuật (Chỉ dành cho Test)"
      >
        {isOpen ? '✕' : '🔮'}
      </button>

      <style jsx>{`
        @keyframes magic-pulse {
          0% { box-shadow: 0 0 0 0 rgba(164, 53, 240, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(164, 53, 240, 0); }
          100% { box-shadow: 0 0 0 0 rgba(164, 53, 240, 0); }
        }
      `}</style>

      {/* BẢNG ĐIỀU KHIỂN */}
      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '75px', left: 0,
          width: '320px', background: '#1a1a1a', borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          animation: 'magic-slide-up 0.3s ease-out'
        }}>
          <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#bb86fc', fontWeight: '800' }}>✨ Magic Testing Hub</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                Công cụ dành cho {role === 'admin' ? 'Quản trị viên' : 'Độc giả'}
            </p>
          </div>

          {statusInfo && (
             <div style={{
               margin: '0.75rem 1rem 0',
               padding: '0.75rem',
               background: 'rgba(0,0,0,0.4)',
               borderRadius: '12px',
               border: '1px solid rgba(187, 134, 252, 0.1)',
               fontSize: '0.7rem'
             }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                 <span style={{ opacity: 0.5 }}>Hệ thống:</span>
                 <span style={{ color: '#03dac6', fontWeight: '600' }}>{new Date().toLocaleDateString('vi-VN')}</span>
               </div>
               {statusInfo.dueDate ? (
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                   <span style={{ opacity: 0.5 }}>Hạn gần nhất:</span>
                   <span style={{ 
                     color: statusInfo.status === 'OVERDUE' ? '#ff5f56' : '#27c93f', 
                     fontWeight: '700' 
                   }}>
                     {new Date(statusInfo.dueDate).toLocaleDateString('vi-VN')}
                     {statusInfo.status === 'OVERDUE' ? ' (Trễ)' : ''}
                   </span>
                 </div>
               ) : (
                 <div style={{ textAlign: 'center', opacity: 0.3, fontStyle: 'italic' }}>Chưa có phiếu mượn nào</div>
               )}
             </div>
           )}

          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '400px', overflowY: 'auto' }}>
            
            {/* NHÓM 1: THỜI GIAN (Dành cho cả 2 nhưng thao túng record của người đang login) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.3, letterSpacing: '1px' }}>⏳ THAO TÚNG THỜI GIAN (USER)</span>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <MagicBtn 
                  label="📘 Gần hạn" 
                  hint="Set hạn còn 1 ngày + Mail."
                  onClick={() => performMagic('NEAR_DUE')} 
                />
                <MagicBtn 
                  label="📙 Trễ hạn" 
                  hint="Set trễ 5 ngày + Mail."
                  onClick={() => performMagic('OVERDUE_LIGHT')} 
                />
                <MagicBtn 
                  label="📕 Trễ nặng" 
                  hint="Set trễ trên 15 ngày + Mail + Khóa."
                  onClick={() => performMagic('OVERDUE_SEVERE')} 
                />
                <MagicBtn 
                  label="⏰ Nhảy 3th" 
                  hint="Test reset quota / mở khóa treo."
                  onClick={() => performMagic('JUMP_3_MONTHS')} 
                />
              </div>

              {/* BỘ ĐIỀU CHỈNH NGÀY CỘNG DỒN */}
              <div style={{ 
                marginTop: '0.2rem',
                padding: '0.8rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#000', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button 
                    onClick={() => setDaysToAdjust(prev => prev - 7)}
                    style={{ padding: '0.5rem 0.8rem', background: 'transparent', color: '#ff5f56', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                    title="-7 ngày"
                  >
                    ≪
                  </button>
                  <button 
                    onClick={() => setDaysToAdjust(prev => prev - 1)}
                    style={{ padding: '0.5rem 0.8rem', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                  >
                    −
                  </button>
                  <div style={{ minWidth: '60px', textAlign: 'center', fontSize: '0.9rem', fontWeight: '800', color: '#bb86fc' }}>
                    {daysToAdjust > 0 ? `+${daysToAdjust}` : daysToAdjust}
                  </div>
                  <button 
                    onClick={() => setDaysToAdjust(prev => prev + 1)}
                    style={{ padding: '0.5rem 0.8rem', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                  >
                    +
                  </button>
                  <button 
                    onClick={() => setDaysToAdjust(prev => prev + 7)}
                    style={{ padding: '0.5rem 0.8rem', background: 'transparent', color: '#27c93f', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                    title="+7 ngày"
                  >
                    ≫
                  </button>
                </div>
                <button
                  onClick={() => performMagic('ADJUST_DATE', { days: daysToAdjust })}
                  disabled={daysToAdjust === 0 || loading}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: '8px',
                    background: 'rgba(187, 134, 252, 0.15)',
                    color: '#bb86fc',
                    border: '1px solid rgba(187, 134, 252, 0.3)',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: daysToAdjust === 0 ? 0.4 : 1
                  }}
                  onMouseOver={(e) => { if (daysToAdjust !== 0) e.target.style.background = 'rgba(187, 134, 252, 0.25)'; }}
                  onMouseOut={(e) => { if (daysToAdjust !== 0) e.target.style.background = 'rgba(187, 134, 252, 0.15)'; }}
                >
                  Xác nhận
                </button>
              </div>
            </div>

            {/* NHÓM 2: QUYỀN NĂNG ADMIN (Thao tác nhanh cho user) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.3, letterSpacing: '1px', color: '#bb86fc' }}>🛡️ ADMIN POWER (AUTO-FLOW)</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <MagicBtn 
                  label="✅ Duyệt & Nhận" 
                  hint="Duyệt yêu cầu PENDING và tự động xác nhận lấy sách ngay lập tức."
                  primary
                  onClick={() => performMagic('APPROVE_LATEST')} 
                />
                <MagicBtn 
                  label="📦 Trả sách" 
                  hint="Tự động Trả toàn bộ sách trong đơn đang mượn."
                  primary
                  onClick={() => performMagic('RETURN_LATEST')} 
                />
                <MagicBtn 
                  label="🧹 Tẩy trắng" 
                  hint="Factory Reset: Xóa sạch lịch sử, record, thông báo. Làm lại từ đầu!"
                  primary
                  onClick={() => performMagic('RESET_USER')} 
                />
              </div>
            </div>

            {/* NHÓM 3: TRẠNG THÁI USER */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.3, letterSpacing: '1px' }}>🌱 TRẠNG THÁI USER</span>
              <MagicBtn 
                label="✨ Hồi phục: Sạch bóng lỗi" 
                hint="Mở khóa thẻ, xóa vết đen, hồi đủ 3 lượt gia hạn ngay lập tức."
                fullWidth 
                onClick={() => performMagic('HEAL_USER')} 
              />
            </div>

            {/* NHÓM 4: HÀNH ĐỘNG HỆ THỐNG (CHỈ ADMIN) */}
            {role === 'admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.3, color: '#ff5f56' }}>🔥 QUYỀN NĂNG ADMIN (DANGEROUS)</span>
                <MagicBtn 
                  label="🚀 Warp: Cả thư viện trễ hạn" 
                  hint="Biến TOÀN BỘ sách đang mượn của mọi người thành trễ hạn 20 ngày."
                  fullWidth 
                  onClick={() => performMagic('WARP_ALL_OVERDUE')} 
                />
                <MagicBtn 
                  label="🧽 Wipe: Xóa sạch phiếu mượn" 
                  hint="Xóa toàn bộ records để làm sạch hệ thống."
                  fullWidth 
                  onClick={() => performMagic('WIPE_RECORDS')} 
                />
                <MagicBtn 
                  label="🏗️ Spawn: Tạo dữ liệu mẫu" 
                  hint="Sinh ra một số sách và thành viên mẫu để demo."
                  fullWidth 
                  onClick={() => performMagic('SPAWN_MOCK')} 
                />
              </div>
            )}

            {/* TRIGGER SCAN (Dành cho cả 2 tiện test mail) */}
            <button
                onClick={triggerScan}
                style={{
                  width: '100%', padding: '0.8rem', borderRadius: '12px',
                  background: 'linear-gradient(90deg, #bb86fc, #6200ee)',
                  color: 'white', border: 'none', cursor: 'pointer',
                  fontWeight: '800', fontSize: '0.85rem', marginTop: '0.5rem'
                }}
                title="Ép hệ thống quét và xử lý Email/Khóa thẻ ngay lập tức."
              >
                🔮 Kích hoạt: Quét Hệ Thống
              </button>
          </div>

          <div style={{ padding: '0.75rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
             <button 
               onClick={() => setIsOpen(false)}
               style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', cursor: 'pointer' }}>
               Thôi không quậy nữa (Đóng)
             </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes magic-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function MagicBtn({ label, hint, onClick, fullWidth, primary }) {
  return (
    <div style={{ width: fullWidth ? '100%' : 'auto', display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={onClick}
        title={hint}
        style={{
          width: '100%',
          padding: '0.6rem 0.4rem',
          borderRadius: '10px',
          background: primary ? 'rgba(39, 201, 63, 0.1)' : 'rgba(255,255,255,0.05)',
          color: primary ? '#27c93f' : '#fff',
          border: `1px solid ${primary ? 'rgba(39,201,63,0.2)' : 'rgba(255,255,255,0.08)'}`,
          fontSize: '0.8rem',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = primary ? 'rgba(39, 201, 63, 0.2)' : 'rgba(255,255,255,0.1)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = primary ? 'rgba(39, 201, 63, 0.1)' : 'rgba(255,255,255,0.05)';
        }}
      >
        {label}
      </button>
      <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', marginTop: '2px', padding: '0 4px', lineHeight: 1.2 }}>
        {hint}
      </span>
    </div>
  );
}

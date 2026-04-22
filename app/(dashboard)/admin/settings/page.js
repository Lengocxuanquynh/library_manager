"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "../../dashboard.module.css";
import { toast } from "sonner";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminSettings() {
  const { user } = useAuth();
  const [config, setConfig] = useState({ excludeSundays: true, holidays: [] });
  const [configLoading, setConfigLoading] = useState(false);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

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

  const handleUpdateConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        toast.success("Cấu hình lịch nghỉ đã được lưu thành công!");
      }
    } catch (error) {
      toast.error("Lỗi cập nhật cấu hình");
    } finally {
      setConfigLoading(false);
    }
  };

  const toggleHoliday = (dateStr) => {
    const isHoliday = config.holidays.includes(dateStr);
    let updatedHolidays;
    if (isHoliday) {
      updatedHolidays = config.holidays.filter(h => h !== dateStr);
    } else {
      updatedHolidays = [...config.holidays, dateStr];
    }
    setConfig({ ...config, holidays: updatedHolidays.sort() });
  };

  // Calendar Logic
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentViewDate(new Date(year, month + 1, 1));

  const days = [];
  // Padding for first day
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className={styles.headerArea} style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className={styles.pageTitle} style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Quản Lý Lịch Nghỉ Thư Viện</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem' }}>Thiết lập ngày nghỉ lễ và cấu hình phạt trễ hạn tự động</p>
      </div>

      <div className={styles.card} style={{ padding: '2.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        
        {/* Sunday Toggle Section */}
        <div style={{ 
          background: 'rgba(187, 134, 252, 0.05)', 
          padding: '2rem', 
          borderRadius: '20px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '3rem',
          border: '1px solid rgba(187, 134, 252, 0.15)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#bb86fc' }}>Mặc định nghỉ Chủ nhật hàng tuần</h3>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: 'rgba(255,255,255,0.4)', maxWidth: '500px' }}>
              Khi bật, hệ thống sẽ tự động bỏ qua các ngày Chủ nhật trong bộ đếm 14 ngày của độc giả. Độc giả sẽ không bị tính phạt vào ngày này.
            </p>
          </div>
          <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '60px', height: '32px' }}>
            <input 
              type="checkbox" 
              checked={config.excludeSundays} 
              onChange={(e) => setConfig({ ...config, excludeSundays: e.target.checked })}
              style={{ opacity: 0, width: 0, height: 0 }} 
            />
            <span style={{ 
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: config.excludeSundays ? '#bb86fc' : '#333', transition: '0.4s', borderRadius: '34px',
              boxShadow: config.excludeSundays ? '0 0 15px rgba(187,134,252,0.4)' : 'none'
            }}>
              <span style={{
                position: 'absolute', content: '""', height: '24px', width: '24px', left: config.excludeSundays ? '32px' : '4px', bottom: '4px',
                backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
              }}></span>
            </span>
          </label>
        </div>

        {/* Visual Calendar Section */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>📅 Chọn ngày nghỉ lễ đặc biệt (Tích để chọn)</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>◀</button>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', minWidth: '150px', textAlign: 'center' }}>
                Tháng {month + 1}, {year}
              </span>
              <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>▶</button>
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: '0.5rem', 
            background: 'rgba(0,0,0,0.2)', 
            padding: '1rem', 
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, idx) => (
              <div key={day} style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold', color: idx === 0 ? '#ff5f56' : 'rgba(255,255,255,0.4)' }}>{day}</div>
            ))}
            {days.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;
              
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isHoliday = config.holidays.includes(dateStr);
              const isSunday = idx % 7 === 0;

              return (
                <div 
                  key={dateStr}
                  onClick={() => toggleHoliday(dateStr)}
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: isHoliday ? 'bold' : 'normal',
                    background: isHoliday ? '#ff5f56' : 'rgba(255,255,255,0.03)',
                    color: isHoliday ? '#fff' : (isSunday ? '#ff5f56' : '#fff'),
                    border: '1px solid',
                    borderColor: isHoliday ? '#ff5f56' : 'rgba(255,255,255,0.05)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative'
                  }}
                  onMouseOver={(e) => {
                    if (!isHoliday) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseOut={(e) => {
                    if (!isHoliday) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                >
                  {day}
                  {isHoliday && (
                    <span style={{ position: 'absolute', bottom: '4px', fontSize: '0.6rem' }}>NGHỈ</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend & Summary */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '3rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', background: '#ff5f56', borderRadius: '3px' }}></div>
            <span>Ngày lễ đã chọn (Không tính phạt)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px' }}></div>
            <span>Ngày làm việc bình thường</span>
          </div>
          <div style={{ marginLeft: 'auto', color: '#bb86fc', fontWeight: 'bold' }}>
            Tổng cộng: {config.holidays.length} ngày lễ đã thiết lập
          </div>
        </div>

        <button 
          onClick={handleUpdateConfig}
          disabled={configLoading}
          style={{ 
            width: '100%', 
            padding: '1.2rem', 
            borderRadius: '16px', 
            background: 'linear-gradient(135deg, #bb86fc, #9965f4)', 
            color: '#000', 
            fontWeight: '900', 
            border: 'none', 
            cursor: 'pointer',
            boxShadow: '0 8px 25px rgba(187,134,252,0.4)',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontSize: '1rem',
            transition: 'transform 0.2s'
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {configLoading ? "Đang xử lý..." : "🚀 LƯU CẤU HÌNH LỊCH NGHỈ TOÀN HỆ THỐNG"}
        </button>
      </div>
    </div>
  );
}

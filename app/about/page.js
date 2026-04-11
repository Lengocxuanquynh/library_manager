"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AboutPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div style={{ 
      minHeight: '80vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '4rem 2rem',
      background: 'radial-gradient(ellipse at top, #1e1e24, #121212)',
      color: '#ffffff',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Decorative background elements */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%', width: '300px', height: '300px',
        background: 'rgba(187, 134, 252, 0.15)', filter: 'blur(100px)', borderRadius: '50%', zIndex: 0
      }}></div>
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-5%', width: '400px', height: '400px',
        background: 'rgba(3, 218, 198, 0.1)', filter: 'blur(120px)', borderRadius: '50%', zIndex: 0
      }}></div>

      <div style={{
        maxWidth: '900px',
        width: '100%',
        zIndex: 1,
        transform: mounted ? 'translateY(0)' : 'translateY(30px)',
        opacity: mounted ? 1 : 0,
        transition: 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)'
      }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ 
            fontSize: 'clamp(2.5rem, 5vw, 4rem)', 
            fontWeight: '900', 
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #bb86fc, #7928ca)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-1px'
          }}>
            Về Chúng Tôi
          </h1>
          <p style={{ 
            fontSize: '1.2rem', 
            lineHeight: '1.8', 
            color: 'rgba(255,255,255,0.7)', 
            maxWidth: '700px', 
            margin: '0 auto' 
          }}>
            Chào mừng bạn đến với <strong>Hệ Thống Thư Viện Chuyển Đổi Số</strong>. Sứ mệnh của chúng tôi là mang nguồn tri thức vô tận đến gần hơn với mọi người qua những trải nghiệm công nghệ hiện đại, tiện lợi và thông minh nhất.
          </p>
        </div>

        {/* Vision & Mission Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '2rem',
          marginBottom: '4rem'
        }}>
          {[{
              title: "Tầm Nhìn",
              desc: "Trở thành nền tảng quản lý và chia sẻ sách hàng đầu, nơi người dùng có thể dễ dàng tiếp cận mọi thể loại sách với giao diện siêu mượt và tốc độ nhanh chóng.",
              icon: "🔭",
              delay: '0.1s'
            },
            {
              title: "Sứ Mệnh",
              desc: "Số hóa thư viện truyền thống bằng việc ứng dụng Cloud computing (Firebase) & Framework hiện đại (Next.js) giúp xoá nhòa rào cản mượn/trả sách.",
              icon: "🎯",
              delay: '0.2s'
            },
            {
              title: "Giá Trị Cốt Lõi",
              desc: "Trải nghiệm Đơn Giản, Tốc độ Nhanh Chóng và Dữ liệu Chính Xác. Chúng tôi đặt người dùng ở vị trí trung tâm trong mọi quyết định thiết kế.",
              icon: "⭐",
              delay: '0.3s'
            }
          ].map((item, idx) => (
            <div key={idx} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '20px',
              padding: '2.5rem 2rem',
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              opacity: mounted ? 1 : 0,
              transition: `all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) ${item.delay}`,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-10px)';
              e.currentTarget.style.border = '1px solid rgba(187, 134, 252, 0.3)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(187, 134, 252, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
            }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>{item.icon}</div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '1rem', color: '#fff' }}>{item.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.7', fontSize: '1rem' }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div style={{ 
          textAlign: 'center',
          transform: mounted ? 'scale(1)' : 'scale(0.95)',
          opacity: mounted ? 1 : 0,
          transition: 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.5s',
          padding: '2rem',
          background: 'linear-gradient(135deg, rgba(187, 134, 252, 0.1), rgba(3, 218, 198, 0.05))',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1.5rem' }}>Bạn đã sẵn sàng khám phá?</h2>
          <Link 
            href="/user/books" 
            style={{
              display: 'inline-block',
              padding: '1rem 2.5rem',
              fontSize: '1.1rem',
              fontWeight: '700',
              color: '#121212',
              background: 'linear-gradient(135deg, #bb86fc, #9965f4)',
              borderRadius: '99px',
              textDecoration: 'none',
              boxShadow: '0 8px 25px rgba(187, 134, 252, 0.4)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(187, 134, 252, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(187, 134, 252, 0.4)';
            }}
          >
            Đến Thư Viện Ngay
          </Link>
        </div>
      </div>
    </div>
  );
}

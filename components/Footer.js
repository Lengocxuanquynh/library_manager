"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // Hide footer on dashboard routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/user")) {
    return null;
  }

  return (
    <footer style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', padding: '4rem 0 2rem 0', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
        <div>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)', fontSize: '1.2rem' }}>Thông Tin Liên Hệ</h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📞</span> +84 123 456 789
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📍</span> 123 Đường Sách, Q1, TP. HCM
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📧</span> admin@gmail.com
          </p>
        </div>
        <div>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)', fontSize: '1.2rem' }}>Liên Kết Nhanh</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <Link href="/about" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Về chúng tôi (About)</Link>
            <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Chính sách bảo mật (Privacy)</Link>
            <Link href="/terms" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Điều khoản dịch vụ (Terms)</Link>
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)', fontSize: '1.2rem' }}>Thư Viện Số</h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>Hệ thống quản lý thư viện hiện đại giúp người đọc dễ dàng mượn, trả và tìm kiếm tài liệu học tập một cách nhanh chóng.</p>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
        <p>© 2026 Library Management. All rights reserved.</p>
      </div>
    </footer>
  );
}

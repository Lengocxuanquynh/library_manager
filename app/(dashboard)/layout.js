"use client";

import { useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import Link from "next/link";
import { logoutUser } from "../../services/auth";
import { useRouter, usePathname } from "next/navigation";
import styles from "./dashboard.module.css";

export default function DashboardLayout({ children }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (loading) {
    return <div className={styles.loading}>Đang tải bảng điều khiển...</div>;
  }

  if (!user) {
    return null; // Will redirect via AuthProvider
  }

  const handleLogout = async () => {
    await logoutUser();
    router.push("/login");
  };

  const toggleMobileSidebar = () => setIsMobileOpen(!isMobileOpen);

  const navLinks = role === "admin" ? [
    { href: "/admin", label: "Dashboard (Tổng quan)" },
    { href: "/admin/books", label: "📦 Tổng Kho Sách" },
    { href: "/admin/transactions", label: "Quản lý Phiếu Mượn" },
    { href: "/admin/members", label: "Quản lý Độc giả" },
    { href: "/admin/stats", label: "Thống kê" },
    { href: "/admin/posts", label: "Tin Tức & Blog" },
  ] : [
    { href: "/user", label: "Trang Cá Nhân Độc Giả" },
    { href: "/user/books", label: "Danh mục Sách" },
    { href: "/user/settings", label: "Cài Đặt" },
  ];

  return (
    <div className={styles.layout}>
      <header className={styles.mobileToggle}>
        <span className={styles.logoText}>Thư Viện</span>
        <button onClick={toggleMobileSidebar} className={styles.toggleBtn}>
          {isMobileOpen ? "✕ Đóng" : "☰ Menu"}
        </button>
      </header>

      <aside className={`${styles.sidebar} ${isMobileOpen ? styles.mobileOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <h2>{role === "admin" ? "Trang Quản Trị" : "Trang Độc Giả"}</h2>
        </div>
        <nav className={styles.navMenu}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navItem} ${pathname === link.href ? styles.active : ""}`}
              onClick={() => setIsMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link
            href="/"
            className={styles.navItem}
            onClick={() => setIsMobileOpen(false)}
            style={{ textAlign: 'center', marginBottom: '0.5rem', opacity: 0.7 }}
          >
            ← Về Trang Chủ
          </Link>
          <button onClick={handleLogout} className={styles.logoutBtn}>Đăng Xuất</button>
        </div>
      </aside>
      <main className={styles.mainContent}>
        <div className={styles.contentContainer}>
          {children}
        </div>
      </main>
    </div>
  );
}

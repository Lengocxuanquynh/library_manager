"use client";

import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { logoutUser } from "@/services/auth";
import { useRouter, usePathname } from "next/navigation";
import styles from "./dashboard.module.css";

export default function DashboardLayout({ children }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

  const navLinks = role === "admin" ? [
    { href: "/admin", label: "Tổng Quan" },
    { href: "/admin/posts", label: "Quản Lý Bài Viết" },
    { href: "/admin/books", label: "Quản Lý Sách" },
    { href: "/admin/members", label: "Hội Viên" },
    { href: "/admin/transactions", label: "Mượn Trả" },
    { href: "/admin/users", label: "Tài Khoản Hệ Thống" },
    { href: "/admin/settings", label: "Cài Đặt" },
  ] : [
    { href: "/user", label: "Hồ Sơ Cá Nhân" },
    { href: "/user/books", label: "Sách Đang Mượn" },
    { href: "/user/settings", label: "Cài Đặt" },
  ];

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>{role === "admin" ? "Trang Quản Trị" : "Trang Độc Giả"}</h2>
          <p className={styles.userEmail}>{user.email}</p>
        </div>
        <nav className={styles.navMenu}>
          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={`${styles.navItem} ${pathname === link.href ? styles.active : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
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

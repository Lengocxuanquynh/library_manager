"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { logoutUser } from "../services/auth";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Hide navbar on dashboard routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/user")) {
    return null;
  }

  const handleLogout = async () => {
    await logoutUser();
    router.push("/");
  };

  return (
    <header className="navbar glass">
      <div className="container nav-content">
        <Link href="/" className="logo">Thư Viện</Link>
        <nav className="nav-links">
          <Link href="/blog">Tin Tức</Link>
          
          {!loading && (
            <>
              {user ? (
                <>
                  <Link href={role === "admin" ? "/admin" : "/user"} className="nav-item">
                    Chào, {user.displayName || "Thành viên"}
                  </Link>
                  <button onClick={handleLogout} className="btn-outline" style={{ background: 'transparent', cursor: 'pointer' }}>
                    Đăng Xuất
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-outline">Đăng Nhập</Link>
                  <Link href="/register" className="btn-primary">Đăng Ký</Link>
                </>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Link from "next/link";

export const metadata = {
  title: "LibraryFlow - Hệ Thống Quản Lý Thư Viện Hiện Đại",
  description: "Mượn, đọc và quản lý thư viện dễ dàng với nền tảng công nghệ số.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <header className="navbar glass">
            <div className="container nav-content">
              <Link href="/" className="logo">Thư Viện</Link>
              <nav className="nav-links">
                <Link href="/blog">Tin Tức</Link>
                <Link href="/login" className="btn-outline">Đăng Nhập</Link>
                <Link href="/register" className="btn-primary">Đăng Ký</Link>
              </nav>
            </div>
          </header>
          <main className="main-content">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

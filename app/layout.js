import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Hệ Thống Quản Lý Thư Viện Hiện Đại",
  description: "Mượn, đọc và quản lý thư viện dễ dàng với nền tảng công nghệ số.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          <Navbar />
          <main className="main-content" style={{ minHeight: 'calc(100vh - 300px)' }}>
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}

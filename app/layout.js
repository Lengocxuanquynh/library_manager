import "./globals.css";
import { AuthProvider } from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Hệ Thống Quản Lý Thư Viện Hiện Đại",
  description: "Mượn, đọc và quản lý thư viện dễ dàng với nền tảng công nghệ số.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

import { CartProvider } from "@/components/CartProvider";
import FloatingCart from "@/components/FloatingCart";
import { Toaster } from "sonner";
import DevEmailToggle from "@/components/DevEmailToggle";
import MagicTools from "@/components/MagicTools";
import { ConfirmProvider } from "@/components/ConfirmProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ConfirmProvider>
            <CartProvider>
              <Navbar />
              <main className="main-content" style={{ minHeight: 'calc(100vh - 300px)' }}>
                {children}
              </main>
              <Footer />
              <FloatingCart />
              <MagicTools />
            </CartProvider>
          </ConfirmProvider>
        </AuthProvider>
        <Toaster 
          position="top-right" 
          containerStyle={{ zIndex: 10000 }}
          richColors 
          closeButton
          theme="dark"
          toastOptions={{
            style: {
              background: 'transparent', // CSS [data-sonner-toast] will handle the rest
              border: 'none',
            },
            className: 'premium-toast',
          }}
        />
        {process.env.NODE_ENV === "development" && <DevEmailToggle />}
      </body>
    </html>
  );
}

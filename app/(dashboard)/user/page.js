"use client";

import { useAuth } from "@/components/AuthProvider";
import styles from "../dashboard.module.css";
import Link from "next/link";

export default function UserDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Xin chào, {user?.displayName || "Độc giả"}</h1>
        <Link href="/" className="btn-outline">Về Trang Chủ</Link>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Thông Tin Cá Nhân</h3>
          <div style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            <p><strong>Họ Tên:</strong> {user?.displayName}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Mã Độc Giả:</strong> {user?.uid}</p>
          </div>
        </div>
        
        <div className={styles.card}>
          <h3>Sách Đang Mượn</h3>
          <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.5)' }}>
            Bạn chưa mượn cuốn sách nào. Hãy khám phá thư viện ngay!
          </p>
          <Link href="/user/books" className="btn-primary" style={{ marginTop: '1.5rem' }}>Xem Danh Mục</Link>
        </div>
      </div>
    </div>
  );
}

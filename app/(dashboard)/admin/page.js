"use client";

import { useEffect, useState } from "react";
import { getBooks, getMembers, getPosts, getTransactions } from "@/services/db";
import styles from "../dashboard.module.css";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    books: 0,
    members: 0,
    posts: 0,
    transactions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [books, members, posts, transactions] = await Promise.all([
          getBooks(),
          getMembers(),
          getPosts(),
          getTransactions()
        ]);
        
        setStats({
          books: books.length,
          members: members.length,
          posts: posts.length,
          transactions: transactions.length
        });
      } catch (error) {
        console.error("Failed to load dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Tổng Quan Hệ Thống</h1>
        <Link href="/admin/posts" className="btn-primary">Viết Bài Mới</Link>
      </div>

      {loading ? (
        <p>Đang tải dữ liệu...</p>
      ) : (
        <div className={styles.grid}>
          <div className={styles.card}>
            <h3>Tổng Số Sách</h3>
            <p style={{ fontSize: "2.5rem", fontWeight: "800", color: "var(--primary)", marginTop: '1rem' }}>
              {stats.books}
            </p>
          </div>
          <div className={styles.card}>
            <h3>Hội Viên Hoạt Động</h3>
            <p style={{ fontSize: "2.5rem", fontWeight: "800", color: "#03dac6", marginTop: '1rem' }}>
              {stats.members}
            </p>
          </div>
          <div className={styles.card}>
            <h3>Bài Viết Blog</h3>
            <p style={{ fontSize: "2.5rem", fontWeight: "800", color: "#ffbd2e", marginTop: '1rem' }}>
              {stats.posts}
            </p>
          </div>
          <div className={styles.card}>
            <h3>Giao Dịch</h3>
            <p style={{ fontSize: "2.5rem", fontWeight: "800", color: "#ff5f56", marginTop: '1rem' }}>
              {stats.transactions}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

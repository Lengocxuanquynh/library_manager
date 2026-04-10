"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./BookList.module.css"; // Reuse similar grid styles

export default function HomeNews() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        setPosts(data.slice(0, 3)); // 3 articles max for homepage
      } catch (error) {
        console.error("Lỗi khi tải tin tức:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  if (loading) {
    return <div className={styles.booksContainer}><p>Đang tải tin tức...</p></div>;
  }

  if (posts.length === 0) return null;

  return (
    <div className={`container ${styles.booksContainer}`} style={{ marginTop: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Tin Tức Nổi Bật</h2>
        <Link href="/blog" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' }}>Xem tất cả &rarr;</Link>
      </div>
      <div className={styles.booksGrid}>
        {posts.map(post => (
          <Link href={`/blog/${post.slug}`} key={post.id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className={styles.bookCard} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                width: '100%', 
                height: '180px', 
                backgroundImage: `url(${post.coverImage || 'https://via.placeholder.com/400x200?text=News'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}></div>
              <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  {post.tags?.[0] || 'Tin Tức'}
                </span>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.8rem', lineHeight: 1.4 }}>{post.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.6, flex: 1 }}>{post.excerpt}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

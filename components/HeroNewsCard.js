"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../app/home.module.css";

export default function HeroNewsCard() {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLatestPost() {
      try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        if (data && data.length > 0) {
          setPost(data[0]);
        }
      } catch (error) {
        console.error("Lỗi tải tin nổi bật:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLatestPost();
  }, []);

  if (loading) {
    return (
      <div className={styles.cardBody} style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
        <div className={styles.skeletonLine}></div>
        <div className={styles.skeletonLine} style={{ width: '70%' }}></div>
        <div className={styles.skeletonImage}></div>
        <div className={styles.skeletonLine}></div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <Link href={`/blog/${post.slug || '#'}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div className={styles.cardBody} style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', transition: 'transform 0.3s ease', cursor: 'pointer' }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
          Tin Tức Mới Nhất
        </span>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.8rem', lineHeight: '1.4' }}>
          {post.title}
        </h3>
        <div style={{ 
          width: '100%', 
          height: '120px', 
          borderRadius: '8px', 
          backgroundImage: `url(${post.coverImage || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800'})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center', 
          marginBottom: '1rem' 
        }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(post.author || 'Admin')}&background=random)`, backgroundSize: 'cover' }}></div>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
            {post.author || 'Ban Biên Tập'}
          </span>
        </div>
      </div>
    </Link>
  );
}

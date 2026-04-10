import { getPosts } from "@/services/db";
import Link from "next/link";
import styles from "./blog.module.css";

// Generate static layout elements for SEO optimization
export const metadata = {
  title: "Blog - Thư Viện Kiến Thức",
  description: "Đọc các thông tin cập nhật mới nhất, hướng dẫn hệ thống quản lý thư viện.",
};

// Next.js App Router defaults to SSG for static routes when fetching data without dynamic functions
export default async function BlogPage() {
  let posts = [];
  try {
    posts = await getPosts();
  } catch (error) {
    console.error("Failed to load blog posts for SSG", error);
  }

  return (
    <div className={styles.blogContainer}>
      <header className={styles.blogHeader}>
        <h1>Trung Tâm Kiến Thức Thư Viện</h1>
        <p>Khám phá mẹo, hướng dẫn, và nguồn tài liệu miễn phí.</p>
      </header>

      <div className={styles.postsGrid}>
        {posts.length === 0 ? (
          <p className={styles.noPosts}>Chưa có bài viết nào được xuất bản.</p>
        ) : (
          posts.map(post => (
            <Link key={post.id} href={`/blog/${post.slug || post.id}`} className={styles.postCard} style={{ display: 'flex', flexDirection: 'column', height: '100%', textDecoration: 'none', color: 'inherit', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden' }}>
              <div className={styles.postImageWrapper} style={{ width: '100%', height: '200px', backgroundImage: `url(${post.coverImage || post.thumbnail || 'https://via.placeholder.com/600x300?text=News'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
              <div className={styles.postContent} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h2 className={styles.postTitle} style={{ fontSize: '1.2rem', marginBottom: '0.8rem' }}>{post.title}</h2>
                <p className={styles.postExcerpt} style={{ color: 'rgba(255,255,255,0.6)', flex: 1, marginBottom: '1rem', lineHeight: 1.5 }}>
                  {post.excerpt || (post.content ? post.content.replace(/<[^>]+>/g, '').substring(0, 100) + '...' : 'Không có nội dung')}
                </p>
                <div className={styles.readMore} style={{ color: 'var(--primary)', fontWeight: '500' }}>Đọc tiếp bài viết →</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

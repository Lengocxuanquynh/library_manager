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
            <Link key={post.id} href={`/blog/${post.slug || post.id}`} className={styles.postCard}>
              {post.thumbnail && (
                <div className={styles.postImageWrapper}>
                  <img src={post.thumbnail} alt={post.title} className={styles.postImage} />
                </div>
              )}
              <div className={styles.postContent}>
                <h2 className={styles.postTitle}>{post.title}</h2>
                <p className={styles.postExcerpt}>
                  {post.content ? post.content.substring(0, 100) + '...' : 'Không có đoạn trích'}
                </p>
                <div className={styles.readMore}>Đọc tiếp bài viết →</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

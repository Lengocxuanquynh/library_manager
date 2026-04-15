import { getPosts, getPostBySlug } from "../../../../services/db";
import Link from "next/link";
import styles from "../blog.module.css";
import { notFound } from "next/navigation";

// SSG: Generate static paths for known slugs
export async function generateStaticParams() {
  try {
    const posts = await getPosts();
    return posts.map((post) => ({
      slug: post.slug || post.id,
    }));
  } catch (error) {
    console.error("Failed to generate static params", error);
    return [];
  }
}

// Generate Dynamic SEO Metadata
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return { title: 'Không Tìm Thấy Bài Viết' };
  }

  return {
    title: `${post.title} - Tạp chí LibraryFlow`,
    description: post.excerpt || (post.content ? post.content.replace(/<[^>]+>/g, '').substring(0, 150) : "Thông tin quản lý thư viện."),
    openGraph: {
      images: post.coverImage ? [post.coverImage] : (post.thumbnail ? [post.thumbnail] : []),
    },
  };
}

export default async function BlogPost({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className={styles.blogContainer}>
      <Link href="/blog" className={styles.backLink}>
        &larr; Quay lại danh sách bài viết
      </Link>
      
      <header className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>{post.title}</h1>
        <div className={styles.articleMeta}>
          Đăng ngày {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString('vi-VN') : 'Không rõ ngày'}
        </div>
      </header>

      {(post.coverImage || post.thumbnail) && (
        <div className={styles.articleHeroImage}>
          <img src={post.coverImage || post.thumbnail} alt={post.title} />
        </div>
      )}

      <div 
        className={styles.articleContent}
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}

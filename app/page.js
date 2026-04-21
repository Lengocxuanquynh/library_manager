import Link from "next/link";
import styles from "./home.module.css";
import BookList from "../components/BookList";
import HomeNews from "../components/HomeNews";
import HeroNewsCard from "../components/HeroNewsCard";

export const metadata = {
  title: "Hệ Thống Quản Lý Thư Viện Hiện Đại",
  description: "Mượn, đọc và quản lý tài sản thư viện dễ dàng với nền tảng công nghệ.",
};

export default function Home() {
  return (
    <>
      <div className={styles.heroContainer}>
        <div className={`container ${styles.heroContent}`}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>
              Khám phá kỷ nguyên mới của <span className={styles.highlight}>Quản Lý Thư Viện</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Tối ưu hóa quy trình mượn trả, khám phá kho tài liệu số khổng lồ,
              và đọc các bài viết mới nhất trên trang blog để cập nhật thông tin dữ liệu.
            </p>
            <div className={styles.heroActions} suppressHydrationWarning={true}>
              <Link href="/register" className="btn-primary">Bắt Đầu Ngay</Link>
              <Link href="/blog" className="btn-outline">Đọc Tin Tức</Link>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.glassCard}>
              <div className={styles.cardHeader}>
                <div className={styles.dots}>
                  <span className={styles.dot}></span>
                  <span className={styles.dot}></span>
                  <span className={styles.dot}></span>
                </div>
              </div>
              <HeroNewsCard />
            </div>
          </div>
        </div>
      </div>

      {/* News Section */}
      <HomeNews />

      {/* Book List Section */}
      <BookList />
    </>
  );
}

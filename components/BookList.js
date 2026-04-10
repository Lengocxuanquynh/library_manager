"use client";

import { useEffect, useState } from "react";
import styles from "./BookList.module.css";

export default function BookList() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBooks() {
      try {
        const res = await fetch('/api/books');
        const data = await res.json();
        setBooks(data);
      } catch (error) {
        console.error("Lỗi khi tải sách:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBooks();
  }, []);

  if (loading) {
    return <div className={styles.booksContainer}><p>Đang tải danh sách sách...</p></div>;
  }

  return (
    <div className={`container ${styles.booksContainer}`}>
      <h2 className={styles.sectionTitle}>Sách Mới Cập Nhật</h2>
      <div className={styles.booksGrid}>
        {books.map(book => (
          <div key={book.id} className={styles.bookCard}>
            <div style={{ height: '180px', width: '100%', marginBottom: '1rem', borderRadius: '6px', backgroundImage: `url(${book.coverImage || 'https://via.placeholder.com/200x300?text=Book'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
            <h3 className={styles.bookTitle} style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>{book.title}</h3>
            <p className={styles.bookAuthor} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>{book.author}</p>
            <span className={styles.bookCategory} style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', marginBottom: '0.8rem', display: 'inline-block' }}>{book.category}</span>
            <div className={`${styles.bookStatus} ${book.status === 'Available' ? styles.statusAvailable : styles.statusBorrowed}`} style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
              {book.status === 'Available' ? 'Có Sẵn' : 'Đã Mượn'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

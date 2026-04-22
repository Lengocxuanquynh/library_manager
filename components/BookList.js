"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import styles from "./BookList.module.css";

export default function BookList() {
  const { user, role } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [formalCategories, setFormalCategories] = useState([]);
  const [borrowing, setBorrowing] = useState(false);

  const [borrowResult, setBorrowResult] = useState(null); // { type: 'success' | 'error', message }
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    async function fetchData() {
      try {
        const [booksRes, catsRes] = await Promise.all([
          fetch('/api/books'),
          fetch('/api/categories')
        ]);
        const booksData = await booksRes.json();
        setBooks(Array.isArray(booksData) ? booksData : []);
        const catsData = await catsRes.json();
        setFormalCategories(Array.isArray(catsData) ? catsData : []);
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);


  const handleBorrow = async (book) => {
    if (!user) return;
    setBorrowing(true);
    setBorrowResult(null);
    try {
      const res = await fetch('/api/borrow-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          bookId: book.id,
          userName: user.displayName || user.email,
          bookTitle: book.title
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBorrowResult({ type: 'success', message: 'Đã gửi yêu cầu mượn sách. Vui lòng chờ Admin duyệt!' });
      } else {
        setBorrowResult({ type: 'error', message: data.error || 'Có lỗi xảy ra' });
      }
    } catch (error) {
      setBorrowResult({ type: 'error', message: 'Lỗi kết nối server' });
    } finally {
      setBorrowing(false);
    }
  };

  const closeModal = () => {
    setSelectedBook(null);
    setBorrowResult(null);
  };

  if (loading) {
    return <div className={styles.booksContainer}><p>Đang tải danh sách sách...</p></div>;
  }

  // Merge formal categories with existing book categories for backup and ensure uniqueness
  const bookCategories = books.map(b => b.category || "Khác").filter(Boolean);
  const managedNames = formalCategories.map(c => c.name).filter(Boolean);
  const categories = [
    "Tất cả", 
    ...new Set([...managedNames, ...bookCategories])
  ];


  const filteredBooks = books.filter(b => 
    selectedCategory === "Tất cả" || (b.category || "Khác") === selectedCategory
  );

  const dashboardLink = role === 'admin' ? '/admin' : '/user';

  return (
    <div className={`container ${styles.booksContainer}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Sách Mới Cập Nhật</h2>
        {user && (
          <Link 
            href={dashboardLink}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              background: 'rgba(187,134,252,0.12)',
              color: '#bb86fc',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '0.9rem',
              border: '1px solid rgba(187,134,252,0.2)',
              transition: 'all 0.2s'
            }}
          >
            {role === 'admin' ? 'Trang Quản Trị' : 'Trang Cá Nhân'}
          </Link>
        )}
      </div>

      {/* Category Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.8rem', 
        overflowX: 'auto', 
        paddingBottom: '1.5rem', 
        paddingLeft: '1rem',
        paddingRight: '1rem',
        justifyContent: 'flex-start',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }}
            style={{
              padding: '0.7rem 1.6rem',
              borderRadius: '99px',
              border: 'none',
              background: selectedCategory === cat 
                ? 'linear-gradient(135deg, #bb86fc, #9965f4)' 
                : 'rgba(255,255,255,0.06)',
              color: selectedCategory === cat ? '#000' : 'rgba(255,255,255,0.7)',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: selectedCategory === cat 
                ? '0 6px 20px rgba(153, 101, 244, 0.4), 0 0 10px rgba(187, 134, 252, 0.2)' 
                : 'none',
              fontSize: '0.9rem',
              letterSpacing: '0.3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {cat}
          </button>
        ))}

      </div>

      <div className={styles.booksGrid}>
        {filteredBooks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(book => (
          <div 
            key={book.id} 
            className={styles.bookCard} 
            onClick={() => { setSelectedBook(book); setBorrowResult(null); }}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ height: '180px', width: '100%', marginBottom: '1rem', borderRadius: '6px', backgroundImage: `url(${book.coverImage || 'https://via.placeholder.com/200x300?text=Book'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
            <h3 className={styles.bookTitle} style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>{book.title}</h3>
            <p className={styles.bookAuthor} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>{book.author}</p>
            <span className={styles.bookCategory} style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', marginBottom: '0.8rem', display: 'inline-block' }}>{book.category}</span>
            <div className={`${styles.bookStatus} ${(book.quantity > 0) ? styles.statusAvailable : styles.statusBorrowed}`} style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
              {(book.quantity > 0) ? 'Có Sẵn' : 'Hết Sách'}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {filteredBooks.length > itemsPerPage && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2.5rem', marginBottom: '1rem' }}>
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(curr => curr - 1)}
            style={{
              padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.3 : 1
            }}
          >
            ← Trang trước
          </button>
          <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>Trang {currentPage} / {Math.ceil(filteredBooks.length / itemsPerPage)}</span>
          <button 
            disabled={currentPage >= Math.ceil(filteredBooks.length / itemsPerPage)}
            onClick={() => setCurrentPage(curr => curr + 1)}
            style={{
              padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: '#fff', cursor: currentPage >= Math.ceil(filteredBooks.length / itemsPerPage) ? 'not-allowed' : 'pointer',
              opacity: currentPage >= Math.ceil(filteredBooks.length / itemsPerPage) ? 0.3 : 1
            }}
          >
            Trang sau →
          </button>
        </div>
      )}

      {/* Book Details Modal */}
      {selectedBook && (
        <div 
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#181818', maxWidth: '850px', width: '100%', borderRadius: '28px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
          >
            <button onClick={closeModal} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: '45px', height: '45px', borderRadius: '50%', cursor: 'pointer', zIndex: 10, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>✕</button>
            
            <div style={{ display: 'flex', flexDirection: 'row', gap: '2.5rem', padding: '3rem', overflowY: 'auto' }} className="modal-content-responsive">
              <div style={{ flexShrink: 0, width: '260px', height: '390px', borderRadius: '16px', backgroundImage: `url(${selectedBook.coverImage || 'https://via.placeholder.com/200x300?text=Book'})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}></div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', textAlign: 'left', flex: 1 }}>
                <span style={{ color: '#bb86fc', fontWeight: '700', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{selectedBook.category || "General"}</span>
                <h2 style={{ fontSize: '2.8rem', fontWeight: '900', margin: 0, lineHeight: 1.1, color: '#fff' }}>{selectedBook.title}</h2>
                <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Tác giả: <span style={{ color: '#fff', fontWeight: '500' }}>{selectedBook.author}</span></p>
                
                <div style={{ margin: '1rem 0', height: '1px', background: 'linear-gradient(to right, rgba(255,255,255,0.2), transparent)' }}></div>

                {/* Quantity info */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{
                    padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600',
                    background: (selectedBook.quantity > 0) ? 'rgba(39,201,63,0.15)' : 'rgba(255,95,86,0.15)',
                    color: (selectedBook.quantity > 0) ? '#27c93f' : '#ff5f56'
                  }}>
                    {(selectedBook.quantity > 0) ? `Còn ${selectedBook.quantity} bản` : 'Hết sách'}
                  </span>
                </div>
                
                <h4 style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem' }}>Tóm tắt nội dung</h4>
                <p style={{ lineHeight: 1.8, color: 'rgba(255,255,255,0.65)', fontSize: '1.05rem', margin: 0 }}>
                  {selectedBook.description || "Cuốn sách tuyệt vời này hiện đang có mặt tại thư viện của chúng tôi. Hãy khám phá đầy đủ kiến thức và trải nghiệm mượn sách trực tuyến nhanh chóng."}
                </p>

                {/* Borrow Result Message */}
                {borrowResult && (
                  <div style={{
                    padding: '0.8rem 1rem', borderRadius: '10px',
                    background: borrowResult.type === 'success' ? 'rgba(39,201,63,0.12)' : 'rgba(255,95,86,0.12)',
                    border: `1px solid ${borrowResult.type === 'success' ? 'rgba(39,201,63,0.3)' : 'rgba(255,95,86,0.3)'}`,
                    color: borrowResult.type === 'success' ? '#27c93f' : '#ff5f56',
                    fontSize: '0.9rem', fontWeight: '500'
                  }}>
                    {borrowResult.message}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {user ? (
                    <>
                      {(selectedBook.quantity > 0) && !borrowResult?.type && (
                        <button 
                          onClick={() => handleBorrow(selectedBook)}
                          disabled={borrowing}
                          style={{
                            padding: '0.9rem 2rem', fontSize: '1rem', borderRadius: '12px',
                            border: 'none', fontWeight: '700', cursor: borrowing ? 'not-allowed' : 'pointer',
                            background: borrowing ? 'rgba(187,134,252,0.3)' : 'linear-gradient(135deg, #bb86fc, #9965f4)',
                            color: '#fff', transition: 'all 0.2s'
                          }}
                        >
                          {borrowing ? "Đang gửi..." : "Mượn Sách"}
                        </button>
                      )}
                      <Link 
                        href={dashboardLink}
                        onClick={closeModal}
                        style={{
                          padding: '0.9rem 2rem', fontSize: '1rem', borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                          color: '#fff', textDecoration: 'none', fontWeight: '500',
                          display: 'inline-flex', alignItems: 'center'
                        }}
                      >
                        {role === 'admin' ? 'Trang Quản Trị' : 'Trang Cá Nhân'}
                      </Link>
                    </>
                  ) : (
                    <Link 
                      href="/login"
                      onClick={closeModal}
                      className="btn-primary" 
                      style={{ padding: '1rem 2rem', fontSize: '1.05rem', borderRadius: '12px' }}
                    >
                      Đăng Nhập Để Mượn Sách
                    </Link>
                  )}
                </div>
              </div>
            </div>
            
            <style jsx>{`
              @media (max-width: 768px) {
                .modal-content-responsive {
                  flex-direction: column !important;
                  align-items: center;
                  padding: 2rem !important;
                  padding-top: 4rem !important;
                }
                div[style*="width: 260px"] {
                  width: 180px !important;
                  height: 270px !important;
                }
                h2 {
                  font-size: 2rem !important;
                  text-align: center;
                }
                p {
                  text-align: center;
                }
                div[style*="display: flex; gap: 1rem"] {
                  justify-content: center;
                }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import styles from "./BookList.module.css";

export default function BookList() {
  const { user, role } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [borrowResult, setBorrowResult] = useState(null); // { type: 'success' | 'error', message }

  useEffect(() => {
    async function fetchBooks() {
      try {
        const res = await fetch('/api/books');
        const data = await res.json();
        setBooks(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Lỗi khi tải sách:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBooks();
  }, []);

  const handleBorrow = (book) => {
    if (!user) {
      router.push("/login");
      return;
    }
    setShowConfirmModal(true);
  };

  const executeBorrow = async () => {
    if (!selectedBook || !user) return;
    
    setBorrowLoading(true);
    setBorrowResult(null);
    try {
      const res = await fetch('/api/borrow-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selectedBook.id,
          userId: user.uid,
          userName: user.displayName || user.email,
          bookTitle: selectedBook.title
        })
      });
      const result = await res.json();
      
      if (res.ok) {
        setBorrowResult({ type: 'success', message: result.message || "Yêu cầu đã được gửi!" });
        // Instead of immediate alert/redirect, let the message show in the modal
        // or keep user's alert if they prefer it. 
        // User's branch had alert and redirect. I'll keep that but via a timeout or similar if I use borrowResult.
        // Actually, user's request "suit my branch" -> they had alert.
        alert(result.message || "Yêu cầu đã được gửi!");
        setShowConfirmModal(false);
        setSelectedBook(null);
        router.push("/user");
      } else {
        setBorrowResult({ type: 'error', message: result.error || "Có lỗi xảy ra khi gửi yêu cầu." });
        alert(result.error || "Có lỗi xảy ra khi gửi yêu cầu.");
      }
    } catch (error) {
      console.error(error);
      setBorrowResult({ type: 'error', message: "Lỗi kết nối server." });
      alert("Lỗi kết nối server.");
    } finally {
      setBorrowLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedBook(null);
    setBorrowResult(null);
    setShowConfirmModal(false);
  };

  if (loading) {
    return <div className={styles.booksContainer}><p>Đang tải danh sách sách...</p></div>;
  }

  // Extract unique categories
  const categories = ["Tất cả", ...new Set(books.map(b => b.category || "Khác").filter(Boolean))];

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
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '0.7rem 1.5rem',
              borderRadius: '99px',
              border: 'none',
              background: selectedCategory === cat ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
              color: selectedCategory === cat ? '#000' : 'rgba(255,255,255,0.8)',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: selectedCategory === cat ? '0 4px 15px rgba(187, 134, 252, 0.4)' : 'none',
              fontSize: '0.95rem'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className={styles.booksGrid}>
        {filteredBooks.map(book => (
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

                {/* Action Buttons */}
                <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {user ? (
                    <>
                      <button 
                        onClick={() => handleBorrow(selectedBook)}
                        disabled={borrowLoading || selectedBook.quantity <= 0}
                        className="btn-primary" 
                        style={{ padding: '1rem 2.5rem', fontSize: '1.05rem', borderRadius: '12px', opacity: (borrowLoading || selectedBook.quantity <= 0) ? 0.6 : 1, cursor: (borrowLoading || selectedBook.quantity <= 0) ? 'not-allowed' : 'pointer' }}
                      >
                        {borrowLoading ? "Đang xử lý..." : selectedBook.quantity > 0 ? "Gửi Yêu Cầu Mượn Sách" : "Hết Sách"}
                      </button>
                      <Link 
                        href={dashboardLink}
                        onClick={closeModal}
                        style={{
                          padding: '1rem 2rem', fontSize: '1.05rem', borderRadius: '12px',
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
                      style={{ padding: '1rem 2.5rem', fontSize: '1.05rem', borderRadius: '12px' }}
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

      {showConfirmModal && selectedBook && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(15px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'rgba(30, 30, 30, 0.85)', maxWidth: '450px', width: '100%', borderRadius: '32px', padding: '2.5rem', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', textAlign: 'center', backdropFilter: 'blur(20px)' }}>
            <div style={{ width: '70px', height: '70px', background: 'rgba(187, 134, 252, 0.15)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--primary)', fontSize: '2rem' }}>
              📚
            </div>
            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '1rem', color: '#fff' }}>Xác nhận mượn sách</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: '2.5rem', fontSize: '1.05rem' }}>
              Bạn có chắc chắn muốn gửi yêu cầu mượn cuốn sách <br/>
              <strong style={{ color: '#fff', fontSize: '1.1rem' }}>"{selectedBook.title}"</strong> không?
            </p>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setShowConfirmModal(false)}
                disabled={borrowLoading}
                style={{ flex: 1, padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={executeBorrow}
                disabled={borrowLoading}
                className="btn-primary"
                style={{ flex: 1, padding: '1rem', borderRadius: '16px', fontWeight: '700', fontSize: '1rem' }}
              >
                {borrowLoading ? "Đang gửi..." : "Đồng ý mượn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

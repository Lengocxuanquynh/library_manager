"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "../../dashboard.module.css";
import { useRouter } from "next/navigation";

export default function BookCatalog() {
  const { user } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const res = await fetch('/api/books');
      const data = await res.json();
      setBooks(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBorrow = async (book) => {
    if (!user) return;
    
    if (confirm(`Bạn muốn gửi yêu cầu mượn cuốn "${book.title}"?`)) {
      setLoading(true);
      try {
        const res = await fetch('/api/borrow-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: book.id,
            userId: user.uid,
            userName: user.displayName || user.email,
            bookTitle: book.title
          })
        });
        const result = await res.json();
        
        if (res.ok) {
          alert(result.message || "Yêu cầu đã được gửi!");
          router.push("/user");
        } else {
          alert(result.error || "Có lỗi xảy ra khi gửi yêu cầu.");
          setLoading(false);
        }
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    }
  };

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(search.toLowerCase()) || 
    b.author?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Danh Mục Sách</h1>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <input 
          type="text" 
          placeholder="Tìm kiếm sách theo tên hoặc tác giả..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: '500px', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '1rem' }}
        />
      </div>

      <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {loading ? (
          <p>Đang tải dữ liệu...</p>
        ) : filteredBooks.length === 0 ? (
          <p>Không tìm thấy sách nào khớp với tìm kiếm.</p>
        ) : (
          filteredBooks.map(book => {
            const isAvailable = (book.quantity || 0) > 0;
            return (
              <div key={book.id} className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem' }}>
                <div style={{ height: '200px', width: '100%', borderRadius: '8px', backgroundImage: `url(${book.coverImage || 'https://via.placeholder.com/200x300?text=Book'})`, backgroundSize: 'cover', backgroundPosition: 'center', marginBottom: '0.5rem' }}></div>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{book.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', margin: 0 }}><strong>Tác Giả:</strong> {book.author}</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', margin: 0 }}><strong>Số lượng còn:</strong> {book.quantity || 0}</p>
                <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                  <span style={{ 
                    display: 'inline-block',
                    background: isAvailable ? 'rgba(39, 201, 63, 0.2)' : 'rgba(255, 95, 86, 0.2)',
                    color: isAvailable ? '#27c93f' : '#ff5f56',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    marginBottom: '1rem'
                   }}>
                    {isAvailable ? 'Còn Sách' : 'Hết Sách'}
                  </span>
                  {isAvailable && (
                    <button 
                      onClick={() => handleBorrow(book)} 
                      className="btn-primary" 
                      style={{ width: '100%', padding: '0.8rem' }}
                    >
                      Đăng Ký Mượn
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

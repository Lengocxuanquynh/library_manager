"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthProvider";
import { useCart } from "../../../../components/CartProvider";
import styles from "../../dashboard.module.css";
import { useRouter } from "next/navigation";

export default function BookCatalog() {
  const { user } = useAuth();
  const { addToCart, cart } = useCart();
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [formalCategories, setFormalCategories] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
      console.error(error);
    } finally {
      setLoading(false);
    }
  };


  const handleBorrow = (book, e) => {
    if (e) e.stopPropagation(); // Prevents opening modal when clicking borrow
    if (!user) return;
    addToCart(book);
    setSelectedBook(null); // Optional: close modal when added
  };

  // Merge formal categories with existing book categories for backup
  const bookCategories = [...new Set(books.map(b => b.category || "Khác").filter(Boolean))];
  const managedNames = formalCategories.map(c => c.name);
  const categories = [
    "Tất cả", 
    ...managedNames,
    ...bookCategories.filter(name => !managedNames.includes(name))
  ];


  const filteredBooks = books.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(search.toLowerCase()) || 
                         b.author?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "Tất cả" || (b.category || "Khác") === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Danh Mục Sách</h1>
      </div>

      <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <input 
          type="text" 
          placeholder="Tìm kiếm sách theo tên hoặc tác giả..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: '500px', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '1rem' }}
        />

        {/* Category Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '0.8rem', 
          overflowX: 'auto', 
          paddingBottom: '0.5rem', 
          paddingLeft: '0.2rem',
          paddingRight: '1.5rem',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch'
        }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '0.65rem 1.4rem',
                borderRadius: '99px',
                border: 'none',
                background: selectedCategory === cat 
                  ? 'linear-gradient(135deg, #bb86fc, #9965f4)' 
                  : 'rgba(255,255,255,0.06)',
                color: selectedCategory === cat ? '#000' : 'rgba(255,255,255,0.7)',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.3s ease',
                boxShadow: selectedCategory === cat 
                  ? '0 6px 18px rgba(153, 101, 244, 0.4)' 
                  : 'none',
                fontSize: '0.9rem',
                flexShrink: 0
              }}
            >
              {cat}
            </button>
          ))}

        </div>
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
              <div 
                key={book.id} 
                className={styles.card} 
                onClick={() => setSelectedBook(book)}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', cursor: 'pointer' }}
              >
                <div style={{ height: '220px', width: '100%', borderRadius: '8px', backgroundImage: `url(${book.coverImage || 'https://via.placeholder.com/200x300?text=Book'})`, backgroundSize: 'cover', backgroundPosition: 'center', marginBottom: '0.5rem' }}></div>
                <h3 style={{ fontSize: '1.2rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', margin: 0 }}><strong>Tác Giả:</strong> {book.author}</p>
                
                <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                  <span style={{ 
                    display: 'inline-block',
                    background: isAvailable ? 'rgba(39, 201, 63, 0.2)' : 'rgba(255, 95, 86, 0.2)',
                    color: isAvailable ? '#27c93f' : '#ff5f56',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                   }}>
                    {isAvailable ? `Còn ${book.quantity} cuốn` : 'Hết Sách'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Book Details Modal */}
      {selectedBook && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ backgroundColor: '#1e1e1e', maxWidth: '800px', width: '100%', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', position: 'relative' }}>
            <button onClick={() => setSelectedBook(null)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', zIndex: 10 }}>✕</button>
            
            <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem', padding: '2.5rem', overflowY: 'auto' }}>
              <div style={{ flexShrink: 0, width: '240px', height: '360px', borderRadius: '12px', backgroundImage: `url(${selectedBook.coverImage || 'https://via.placeholder.com/200x300?text=Book'})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}></div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <span style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '0.9rem', textTransform: 'uppercase' }}>{selectedBook.category || "Chưa phân loại"}</span>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0 }}>{selectedBook.title}</h2>
                <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>Tác giả: <span style={{ color: '#fff' }}>{selectedBook.author}</span></p>
                
                <div style={{ margin: '1rem 0', height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                
                <h4 style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>Giới thiệu nội dung</h4>
                <p style={{ lineHeight: 1.8, color: 'rgba(255,255,255,0.7)', fontSize: '1rem' }}>
                  {selectedBook.description || "Cuốn sách này hiện chưa có mô tả chi tiết từ quản trị viên. Vui lòng liên hệ quầy hỗ trợ để biết thêm thông tin."}
                </p>

                <div style={{ marginTop: '2rem' }}>
                  <button 
                    onClick={(e) => handleBorrow(selectedBook, e)}
                    disabled={(selectedBook.quantity || 0) <= 0 || cart.some(b => b.id === selectedBook.id)}
                    className="btn-primary" 
                    style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', width: 'fit-content', background: cart.some(b => b.id === selectedBook.id) ? 'rgba(39, 201, 63, 0.3)' : undefined }}
                  >
                    {(selectedBook.quantity || 0) <= 0 
                      ? "Tạm hết sách" 
                      : cart.some(b => b.id === selectedBook.id) 
                        ? "Đã có trong giỏ" 
                        : "Thêm vào giỏ hàng"}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Added mobile responsiveness check within Modal */}
            <style jsx>{`
              @media (max-width: 600px) {
                div[style*="flexDirection: row"] {
                  flex-direction: column !important;
                  align-items: center;
                  padding: 1.5rem !important;
                }
                div[style*="width: 240px"] {
                  width: 160px !important;
                  height: 240px !important;
                }
                h2 {
                  font-size: 1.8rem !important;
                  text-align: center;
                }
                p {
                  text-align: center;
                }
                button[className="btn-primary"] {
                  width: 100% !important;
                }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}

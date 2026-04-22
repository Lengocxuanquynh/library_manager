"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import styles from "../../dashboard.module.css";
import { useRouter } from "next/navigation";
import { toggleAuthorFavorite } from "@/services/db";
import { toast } from "sonner";
import UserTour from "@/components/UserTour";
import { completeUserTour } from "@/services/auth";

export default function BookCatalog() {
  const { user } = useAuth();
  const { addToCart, cart } = useCart();
  const router = useRouter();
  
  // State
  const [books, setBooks] = useState([]);
  const [formalCategories, setFormalCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("TRANG CHỦ"); // TRANG CHỦ, TÁC GIẢ, THỂ LOẠI, THƯ VIỆN
  const [filterAuthor, setFilterAuthor] = useState("Tất cả");
  const [filterCategory, setFilterCategory] = useState("Tất cả");
  const [manualTour, setManualTour] = useState(false);


  // Nav Dropdowns state
  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    fetchData();
    if (user) fetchUserProfile();

    // Kiểm tra nếu đang tiếp tục Tour từ Dashboard
    if (localStorage.getItem('tour_ongoing') === 'true') {
      setManualTour(true);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [booksRes, catsRes] = await Promise.all([
        fetch('/api/books'),
        fetch('/api/categories')
      ]);
      const booksData = await booksRes.json();
      setBooks(booksData);
      const catsData = await catsRes.json();
      setFormalCategories(catsData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const res = await fetch(`/api/user/profile/${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
      }
    } catch (err) {
      console.error("Fetch profile failed", err);
    }
  };

  const handleToggleStar = async (authorName, e) => {
    if (e) e.stopPropagation();
    if (!user) return toast.error("Vui lòng đăng nhập");
    
    try {
      const newFavs = await toggleAuthorFavorite(user.uid, authorName);
      setUserProfile(prev => ({ ...prev, favoriteAuthors: newFavs }));
      toast.success(newFavs.includes(authorName) ? `Đã gắn sao tác giả ${authorName}` : `Đã bỏ gắn sao tác giả ${authorName}`);
    } catch (err) {
      toast.error("Lỗi khi xử lý");
    }
  };

  // Data Aggregation
  const authors = useMemo(() => ["Tất cả", ...new Set(books.map(b => b.author).filter(Boolean))], [books]);
  const categories = useMemo(() => ["Tất cả", ...new Set(books.map(b => b.category).filter(Boolean))], [books]);


  const filteredBooks = useMemo(() => {
    const filtered = books.filter(b => {
      const matchesSearch = b.title.toLowerCase().includes(search.toLowerCase()) || 
                           b.author?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = filterCategory === "Tất cả" || b.category === filterCategory;
      const matchesAuthor = filterAuthor === "Tất cả" || b.author === filterAuthor;

      
      // Logic cho Tab Yêu thích
      if (activeTab === "THƯ VIỆN") {
          return matchesSearch && matchesCategory && matchesAuthor && userProfile?.favoriteAuthors?.includes(b.author);
      }

      return matchesSearch && matchesCategory && matchesAuthor;
    });

    // Sắp xếp: Còn sách lên trên, Hết sách (quantity=0) xuống dưới
    return [...filtered].sort((a, b) => {
      const aStock = (a.quantity || 0) > 0 ? 1 : 0;
      const bStock = (b.quantity || 0) > 0 ? 1 : 0;
      return bStock - aStock; 
    });
  }, [books, search, filterCategory, filterAuthor, activeTab, userProfile]);

  const handleSelectFromModal = (type, value) => {
    if (type === 'author') {
        setFilterAuthor(value);
        setActiveTab("TRANG CHỦ"); // Quay về trang chính để thấy kết quả lọc
    } else if (type === 'category') {
        setFilterCategory(value);
        setActiveTab("TRANG CHỦ");
    }
    setSelectedBook(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', color: '#fff' }}>
      
      {/* Anime-Style Sub Navbar */}
      <nav style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 100, 
        backgroundColor: '#0a0a0a', 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '0 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '60px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', height: '100%' }}>
            <span 
                onClick={() => { setActiveTab("TRANG CHỦ"); setFilterAuthor("Tất cả"); setFilterCategory("Tất cả"); }} 
                style={{ fontWeight: '800', cursor: 'pointer', color: activeTab === "TRANG CHỦ" ? 'var(--primary)' : '#fff', transition: '0.3s' }}
            >
                TRANG CHỦ
            </span>

            {/* Dropdown Tác Giả */}
            <div 
                onMouseEnter={() => setActiveDropdown('author')} 
                onMouseLeave={() => setActiveDropdown(null)}
                style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
                <span style={{ color: filterAuthor !== "Tất cả" ? 'var(--primary)' : '#fff' }}>TÁC GIẢ ▾</span>
                {activeDropdown === 'author' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: '#111', border: '1px solid #333', borderRadius: '0 0 8px 8px', width: '250px', maxHeight: '400px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
                        {authors.map(a => (
                            <div 
                                key={a} 
                                onClick={() => { setFilterAuthor(a); setActiveDropdown(null); }}
                                style={{ padding: '0.8rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', transition: '0.2s', backgroundColor: filterAuthor === a ? '#222' : 'transparent' }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#222'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = filterAuthor === a ? '#222' : 'transparent'}
                            >
                                <span style={{ fontSize: '0.9rem' }}>{a}</span>
                                {a !== "Tất cả" && (
                                    <span 
                                        onClick={(e) => handleToggleStar(a, e)}
                                        style={{ color: userProfile?.favoriteAuthors?.includes(a) ? '#ffcc00' : 'rgba(255,255,255,0.2)', fontSize: '1.2rem' }}
                                    >
                                        ★
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Dropdown Thể Loại */}
            <div 
                onMouseEnter={() => setActiveDropdown('category')} 
                onMouseLeave={() => setActiveDropdown(null)}
                style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
                <span style={{ color: filterCategory !== "Tất cả" ? 'var(--primary)' : '#fff' }}>THỂ LOẠI ▾</span>
                {activeDropdown === 'category' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: '#111', border: '1px solid #333', borderRadius: '0 0 8px 8px', width: '200px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
                        {categories.map(c => (
                            <div 
                                key={c} 
                                onClick={() => { setFilterCategory(c); setActiveDropdown(null); }}
                                style={{ padding: '0.8rem 1.2rem', borderBottom: '1px solid #222', fontSize: '0.9rem', backgroundColor: filterCategory === c ? '#222' : 'transparent' }}
                            >
                                {c}
                            </div>
                        ))}
                    </div>
                )}
            </div>


            <span 
                onClick={() => setActiveTab("THƯ VIỆN")} 
                style={{ cursor: 'pointer', color: activeTab === "THƯ VIỆN" ? '#ffcc00' : '#fff', position: 'relative' }}
            >
                THƯ VIỆN ⭐
                {userProfile?.favoriteAuthors?.length > 0 && (
                    <span style={{ position: 'absolute', top: '-8px', right: '-12px', background: '#ffcc00', color: '#000', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {userProfile.favoriteAuthors.length}
                    </span>
                )}
            </span>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
            <input 
                type="text" 
                placeholder="Tìm tên sách..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '250px', padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid #333', backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.85rem' }}
            />
        </div>
      </nav>

      {/* Hero / Filter Status Buffer */}
      <div style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 className={styles.pageTitle} style={{ margin: 0 }}>{activeTab === "THƯ VIỆN" ? "Tác giả tôi theo dõi" : "Danh Mục Sách"}</h1>
            {(filterAuthor !== "Tất cả" || filterCategory !== "Tất cả" || search !== "") && (
                <button 
                  onClick={() => { setFilterAuthor("Tất cả"); setFilterCategory("Tất cả"); setSearch(""); setActiveTab("TRANG CHỦ"); }}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Xóa toàn bộ lọc ✕
                </button>
            )}
        </div>

        <div id="tour-book-grid" className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem' }}>
            {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', gridColumn: '1/-1' }}>
                <div className={styles.loader} style={{ margin: '0 auto' }}></div>
                <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.5)' }}>Đang chuẩn bị kho sách...</p>
            </div>
            ) : filteredBooks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', gridColumn: '1/-1', background: 'rgba(255,255,255,0.02)', borderRadius: '20px' }}>
                <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.5)' }}>Không tìm thấy sách nào khớp với lựa chọn của bạn.</p>
            </div>
            ) : (
            filteredBooks.map((book, index) => {
                const isAvailable = (book.quantity || 0) > 0;
                const isFan = userProfile?.favoriteAuthors?.includes(book.author);
                return (
                <div 
                    key={book.id} 
                    id={index === 0 ? "tour-book-card" : undefined}
                    className={styles.card} 
                    onClick={() => setSelectedBook(book)}
                    style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.8rem', 
                        padding: '0', 
                        cursor: 'pointer', 
                        overflow: 'hidden',
                        position: 'relative',
                        transition: 'transform 0.3s',
                        opacity: isAvailable ? 1 : 0.6,
                        filter: isAvailable ? 'none' : 'grayscale(0.8)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-10px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ 
                        height: '300px', 
                        width: '100%', 
                        backgroundImage: `url(${book.coverImage || 'https://via.placeholder.com/200x300?text=Book'})`, 
                        backgroundSize: 'cover', 
                        backgroundPosition: 'center',
                        position: 'relative'
                    }}>
                        {/* THE LOAI BADGE ON CARD */}
                        <div style={{ 
                            position: 'absolute', 
                            top: '10px', 
                            right: '10px', 
                            backgroundColor: 'rgba(187, 134, 252, 0.9)', 
                            color: '#000', 
                            padding: '3px 10px', 
                            borderRadius: '4px', 
                            fontSize: '0.65rem', 
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                            zIndex: 2
                        }}>
                            {book.category}
                        </div>

                        {isFan && (
                            <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: '#ffcc00', color: '#000', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 2 }}>STARred ★</div>
                        )}
                        <div style={{ 
                            position: 'absolute', 
                            bottom: 0, 
                            left: 0, 
                            right: 0, 
                            padding: '1.5rem 1rem 0.5rem', 
                            background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.3rem'
                         }}>
                            <h3 style={{ fontSize: '1rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', margin: 0 }}>{book.author}</p>
                            {!isAvailable && (
                                <div style={{ 
                                    backgroundColor: 'rgba(255, 95, 86, 0.8)', 
                                    color: '#fff', 
                                    fontSize: '0.6rem', 
                                    padding: '2px 6px', 
                                    borderRadius: '4px', 
                                    fontWeight: '900', 
                                    width: 'fit-content',
                                    marginTop: '0.3rem'
                                }}>
                                    HẾT SÁCH
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                );
            })
            )}
        </div>
      </div>

      {/* PREMIUM DETAIL MODAL (ANIME STYLE) */}
      {selectedBook && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ 
            backgroundColor: '#161616', 
            maxWidth: '1000px', 
            width: '100%', 
            borderRadius: '16px', 
            overflow: 'hidden', 
            border: '1px solid rgba(255,255,255,0.08)', 
            display: 'flex', 
            flexDirection: 'column', 
            maxHeight: '90vh', 
            position: 'relative',
            boxShadow: '0 30px 60px rgba(0,0,0,0.6)'
          }}>
            <button onClick={() => setSelectedBook(null)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '45px', height: '45px', borderRadius: '50%', cursor: 'pointer', zIndex: 10, fontSize: '1.2rem', transition: '0.2s' }}>✕</button>
            
            <div style={{ display: 'flex', gap: '3rem', padding: '3rem', overflowY: 'auto' }}>
              <div style={{ 
                flexShrink: 0, 
                width: '320px', 
                height: '480px', 
                borderRadius: '8px', 
                backgroundImage: `url(${selectedBook.coverImage || 'https://via.placeholder.com/200x300?text=Book'})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center', 
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}></div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
                        <span 
                            onClick={() => handleSelectFromModal('category', selectedBook.category)}
                            style={{ 
                                backgroundColor: 'rgba(187, 134, 252, 0.15)', 
                                color: '#bb86fc', 
                                padding: '4px 12px', 
                                borderRadius: '6px', 
                                border: '1px solid rgba(187, 134, 252, 0.3)',
                                fontWeight: '800', 
                                fontSize: '0.85rem', 
                                letterSpacing: '1px', 
                                textTransform: 'uppercase', 
                                cursor: 'pointer',
                                transition: '0.3s'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(187, 134, 252, 0.25)'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(187, 134, 252, 0.15)'}
                        >
                            {selectedBook.category || "CÔNG NGHỆ"}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>• ID: {selectedBook.id.slice(0,6)}</span>
                    </div>
                    <h2 style={{ fontSize: '3.5rem', fontWeight: '900', margin: '0 0 0.5rem', lineHeight: 1.1 }}>{selectedBook.title}</h2>
                    <p style={{ fontSize: '1.3rem', color: 'rgba(255,255,255,0.5)' }}>
                        Tác giả: <span onClick={() => handleSelectFromModal('author', selectedBook.author)} style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '4px' }}>{selectedBook.author}</span>
                        {userProfile?.favoriteAuthors?.includes(selectedBook.author) && <span style={{ color: '#ffcc00', marginLeft: '10px' }}>★</span>}
                    </p>
                </div>
                
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }}></div>
                
                <div>
                    <h4 style={{ margin: '0 0 0.8rem', color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem' }}>Giới thiệu nội dung</h4>
                    <p style={{ lineHeight: 1.8, color: 'rgba(255,255,255,0.6)', fontSize: '1rem', fontStyle: 'italic' }}>
                        {selectedBook.description || "Cuốn sách này hiện chưa có mô tả chi tiết từ quản trị viên. Vui lòng liên hệ quầy hỗ trợ để biết thêm thông tin về tác phẩm này."}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: 'auto' }}>
                    <button 
                        id="tour-add-to-cart"
                        onClick={() => {
                            addToCart(selectedBook);
                            setSelectedBook(null); // Đóng modal để người dùng thấy giỏ hàng trượt ra
                        }}
                        style={{ 
                            padding: '1.2rem 3rem', 
                            fontSize: '1.1rem', 
                            fontWeight: '700',
                            borderRadius: '12px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #bb86fc, #9965f4)',
                            color: '#000',
                            cursor: 'pointer',
                            flex: 1,
                            transition: '0.3s'
                        }}
                    >
                        THÊM VÀO GIỎ HÀNG
                    </button>

                    <button 
                        onClick={() => handleToggleStar(selectedBook.author)}
                        style={{ 
                            width: '60px', 
                            height: '60px', 
                            borderRadius: '12px', 
                            background: 'rgba(255,255,255,0.05)', 
                            border: userProfile?.favoriteAuthors?.includes(selectedBook.author) ? '1px solid #ffcc00' : '1px solid rgba(255,255,255,0.1)', 
                            color: userProfile?.favoriteAuthors?.includes(selectedBook.author) ? '#ffcc00' : '#fff',
                            fontSize: '1.5rem',
                            cursor: 'pointer'
                        }}
                        title="Theo dõi tác giả"
                    >
                        {userProfile?.favoriteAuthors?.includes(selectedBook.author) ? '★' : '☆'}
                    </button>
                </div>
              </div>
            </div>

            <style jsx>{`
              @media (max-width: 900px) {
                div[style*="flexDirection: row"] { flex-direction: column !important; padding: 2rem !important; }
                div[style*="width: 320px"] { width: 100% !important; height: 300px !important; }
                h2 { font-size: 2rem !important; }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* INTERACTIVE TOUR PART 2 */}
      <UserTour 
        isOpen={manualTour}
        onComplete={() => {
          completeUserTour(user?.uid);
          setManualTour(false);
          localStorage.removeItem('tour_ongoing');
        }}
        steps={[
          {
            targetId: 'tour-book-grid',
            title: 'Kho Sách Đa Dạng 📚',
            description: 'Đây là nơi trưng bày tất cả sách của thư viện. Bạn có thể sử dụng thanh tìm kiếm hoặc bộ lọc Tác giả/Thể loại ở trên để tìm cuốn sách ưng ý.'
          },
          {
            targetId: 'tour-book-card',
            title: 'Xem Chi Tiết 📖',
            description: 'Nhấn vào bất kỳ cuốn sách nào để xem mô tả chi tiết, tác giả và thể loại của tác phẩm đó.'
          },
          {
            targetId: 'tour-add-to-cart',
            title: 'Thêm Vào Giỏ Hàng 🛒',
            description: 'Khi đã ưng ý, hãy nhấn nút này để đưa sách vào giỏ mượn tạm thời của bạn.'
          },
          {
            targetId: 'tour-cart-btn',
            title: 'Gửi Yêu Cầu Mượn 🚀',
            description: 'Cuối cùng, hãy nhấn vào biểu tượng Giỏ hàng này để kiểm tra lại danh sách và gửi yêu cầu mượn đến Admin. Chúc bạn có những giây phút đọc sách tuyệt vời!'
          }
        ]}
      />
    </div>
  );
}

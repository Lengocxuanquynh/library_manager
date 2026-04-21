"use client";

import { useEffect, useState, Suspense } from "react";
import styles from "../../dashboard.module.css";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import PremiumSelect from "@/components/PremiumSelect";
import { useConfirm } from "@/components/ConfirmProvider";

function InventoryHubContent() {
  const { confirmPremium } = useConfirm();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || "inventory";

  // Hub States
  const [activeTab, setActiveTab] = useState(initialTab); // 'inventory' | 'authors' | 'categories'
  
  // Inventory (Books) States
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBookId, setEditingBookId] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Author States
  const [authors, setAuthors] = useState([]);
  const [newAuthorName, setNewAuthorName] = useState("");
  const [editingAuthorId, setEditingAuthorId] = useState(null);
  const [syncingAuthors, setSyncingAuthors] = useState(false);

  // Category States
  const [categories, setCategories] = useState([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', description: '' });

  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [authorSearchTerm, setAuthorSearchTerm] = useState("");
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const itemsPerPage = 8;

  // Form Data for Books
  const [bookFormData, setBookFormData] = useState({
    title: '',
    author: '',
    category: '',
    quantity: 1,
    coverImage: '',
    description: '',
    isbn: '',
    publisher: '',
    year: '',
    price: 0,
    status: 'Available',
    damagedCount: 0
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBooks(),
        fetchCategories(),
        fetchAuthors()
      ]);
    } catch (error) {
      console.error("Error fetching hub data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBooks = async () => {
    const res = await fetch('/api/books');
    const data = await res.json();
    setBooks(Array.isArray(data) ? data : []);
  };

  const fetchCategories = async () => {
    const res = await fetch('/api/categories');
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
  };

  const fetchAuthors = async () => {
    const res = await fetch('/api/authors');
    const data = await res.json();
    setAuthors(Array.isArray(data) ? data : []);
  };

  // ========================
  // BOOK HANDLERS
  // ========================
  const handleBookImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await uploadToCloudinary(file);
      setBookFormData({ ...bookFormData, coverImage: imageUrl });
      toast.success("Đã tải ảnh lên");
    } catch (error) {
      toast.error("Lỗi tải ảnh");
    } finally {
      setUploading(false);
    }
  };

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    const url = editingBookId ? `/api/books/${editingBookId}` : '/api/books';
    const method = editingBookId ? 'PATCH' : 'POST';

    const finalData = {
      ...bookFormData,
      quantity: parseInt(bookFormData.quantity) || 0,
      status: parseInt(bookFormData.quantity) > 0 ? 'Available' : 'Out of Stock'
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });

      if (res.ok) {
        toast.success(editingBookId ? "Cập nhật sách thành công" : "Thêm sách mới thành công");
        resetBookForm();
        fetchBooks();
        fetchAuthors(); // Might have added a new author
        fetchCategories(); // Might have added a new category
      } else {
        toast.error("Lỗi khi lưu sách");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditBook = (book) => {
    setBookFormData({
      title: book.title || '',
      author: book.author || '',
      category: book.category || '',
      quantity: book.quantity || 0,
      coverImage: book.coverImage || '',
      description: book.description || '',
      isbn: book.isbn || '',
      publisher: book.publisher || '',
      year: book.year || '',
      price: book.price || 0,
      status: book.status || 'Available',
      damagedCount: book.damagedCount || 0
    });
    setEditingBookId(book.id);
    setShowBookForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetBookForm = () => {
    setBookFormData({ title: '', author: '', category: '', quantity: 1, coverImage: '', description: '', isbn: '', publisher: '', year: '', price: 0, status: 'Available', damagedCount: 0 });
    setEditingBookId(null);
    setShowBookForm(false);
  };

  const handleDeleteBook = async (id) => {
    if (!await confirmPremium("Xác nhận xóa cuốn sách này?", "🗑️ Xóa đầu sách")) return;
    const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
    const data = await res.json();
    
    if (res.ok && data.success) {
      fetchBooks();
      toast.success("Đã xóa sách");
    } else {
      toast.error(data.error || "Không thể xóa sách.");
    }
  };

  // ========================
  // AUTHOR HANDLERS
  // ========================
  const handleAuthorSubmit = async (e) => {
    e.preventDefault();
    if (!newAuthorName.trim()) return;

    const url = editingAuthorId ? `/api/authors/${editingAuthorId}` : '/api/authors';
    const method = editingAuthorId ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAuthorName.trim() })
      });
      
      const data = await res.json();

      if (res.ok) {
        toast.success(editingAuthorId ? "Đã cập nhật tác giả" : "Đã thêm tác giả");
        resetAuthorForm();
        fetchAuthors();
      } else {
        toast.error(data.error || "Lỗi thao tác tác giả");
      }
    } catch (error) {
      toast.error("Lỗi kết nối máy chủ");
    }
  };

  const handleEditAuthor = (author) => {
    setNewAuthorName(author.name);
    setEditingAuthorId(author.id);
  };

  const resetAuthorForm = () => {
    setNewAuthorName("");
    setEditingAuthorId(null);
  };

  const handleDeleteAuthor = async (id, force = false) => {
    if (!force) {
      if (!await confirmPremium("Xác nhận xóa tác giả này?", "🖋️ Xóa tác giả")) return;
    }
    
    const url = `/api/authors/${id}${force ? '?force=true' : ''}`;
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
      fetchAuthors();
      toast.success(data.message || "Đã xóa tác giả");
    } else {
      if (data.code === 'HAS_BOOKS') {
        // Hỏi xác nhận lần 2 cho xóa hàng loạt
        const confirmed = await confirmPremium(
          `${data.error} LƯU Ý: Hành động này không thể hoàn tác.`,
          "🔥 Xác nhận xóa Hàng loạt"
        );
        if (confirmed) handleDeleteAuthor(id, true);
      } else {
        toast.error(data.error || "Không thể xóa tác giả.");
      }
    }
  };


  const handleSyncAuthors = async () => {
    setSyncingAuthors(true);
    const tid = toast.loading("Đang phân tích và đồng bộ tác giả...");
    try {
      // Chuẩn hóa tên từ kho sách để so sánh
      const currentBookAuthors = [...new Set(books.map(b => b.author).filter(Boolean))];
      let addedCount = 0;
      let skippedCount = 0;

      for (const name of currentBookAuthors) {
        const res = await fetch('/api/authors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        
        if (res.ok) {
          addedCount++;
        } else if (res.status === 400) {
          // Thường là do đã tồn tại
          skippedCount++;
        }
      }
      
      fetchAuthors();
      toast.success(`Đã đồng bộ xong: +${addedCount} mới, ${skippedCount} đã tồn tại.`, { id: tid });
    } catch (error) {
      toast.error("Lỗi đồng bộ dữ liệu", { id: tid });
    } finally {
      setSyncingAuthors(false);
    }
  };

  // ========================
  // CATEGORY HANDLERS
  // ========================
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const url = editingCategoryId ? `/api/categories/${editingCategoryId}` : '/api/categories';
    const method = editingCategoryId ? 'PATCH' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryFormData)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(editingCategoryId ? "Cập nhật thành công" : "Thêm mới thành công");
        resetCategoryForm();
        fetchCategories();
      } else {
        toast.error(data.error || "Lỗi thao tác thể loại");
      }
    } catch (error) {
      toast.error("Lỗi kết nối máy chủ");
    }
  };

  const handleEditCategory = (cat) => {
    setCategoryFormData({ name: cat.name, description: cat.description || '' });
    setEditingCategoryId(cat.id);
    setShowCategoryForm(true);
  };

  const resetCategoryForm = () => {
    setCategoryFormData({ name: '', description: '' });
    setEditingCategoryId(null);
    setShowCategoryForm(false);
  };

  const handleDeleteCategory = async (id, force = false) => {
    if (!force) {
      if (!await confirmPremium("Xóa thể loại này?", "📂 Xóa thể loại")) return;
    }
    
    const url = `/api/categories/${id}${force ? '?force=true' : ''}`;
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
      fetchCategories();
      toast.success(data.message || "Đã xóa thể loại");
    } else {
      if (data.code === 'HAS_BOOKS') {
        const confirmed = await confirmPremium(
          `${data.error} Bạn chắc chứ? Toàn bộ sách trong danh mục này sẽ bị xóa sạch.`,
          "🔥 Xác nhận xóa Hàng loạt"
        );
        if (confirmed) handleDeleteCategory(id, true);
      } else {
        toast.error(data.error || "Không thể xóa thể loại.");
      }
    }
  };


  // ========================
  // RENDER HELPERS
  // ========================
  const filteredBooks = books
    .filter(book => {
      const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (book.isbn && book.isbn.includes(searchTerm));
      const matchesCategory = selectedCategoryFilter === "ALL" || book.category === selectedCategoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const aStock = (a.quantity || 0) > 0 ? 1 : 0;
      const bStock = (b.quantity || 0) > 0 ? 1 : 0;
      return bStock - aStock; // 1 (còn hàng) lên trên 0 (hết hàng)
    });

  return (
    <div className="inventory-hub">
      <style jsx>{`
        .tab-button {
          padding: 1rem 2rem;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.5);
          font-weight: 700;
          cursor: pointer;
          position: relative;
          transition: 0.3s;
          font-size: 0.9rem;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .tab-button.active {
          color: #bb86fc;
        }
        .tab-button.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 20%;
          right: 20%;
          height: 3px;
          background: #bb86fc;
          border-radius: 10px;
          box-shadow: 0 0 10px rgba(187, 134, 252, 0.5);
        }
        .tab-container {
          display: flex;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          margin-bottom: 2rem;
        }
        .fade-in {
            animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Tổng Kho Tài Nguyên Sách</h1>
      </div>

      <div className="tab-container">
        <button className={`tab-button ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>📦 Kho Sách</button>
        <button className={`tab-button ${activeTab === 'authors' ? 'active' : ''}`} onClick={() => setActiveTab('authors')}>✒️ Tác Giả</button>
        <button className={`tab-button ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>📂 Thể Loại</button>
      </div>

      <div className="hub-content fade-in" key={activeTab}>
        
        {/* ================= INVENTORY TAB ================= */}
        {activeTab === 'inventory' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Quản Lý Đầu Sách</h2>
                <button className="btn-primary" onClick={() => setShowBookForm(!showBookForm)}>
                    {showBookForm ? "Đóng Form" : "+ Đăng Ký Sách Mới"}
                </button>
            </div>

            {showBookForm && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '20px', marginBottom: '2.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                   <form onSubmit={handleBookSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.6 }}>Tiêu đề sách</label>
                                <input type="text" value={bookFormData.title} onChange={e => setBookFormData({...bookFormData, title: e.target.value})} placeholder="Ví dụ: Đắc Nhân Tâm" required style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.6 }}>Tác giả</label>
                                <input type="text" value={bookFormData.author} onChange={e => setBookFormData({...bookFormData, author: e.target.value})} list="hub-authors" placeholder="Chọn hoặc nhập tên..." required style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff' }} />
                                <datalist id="hub-authors">
                                    {authors.map(a => <option key={a.id} value={a.name} />)}
                                </datalist>
                            </div>
                            <div>
                                <PremiumSelect 
                                    label="Thể loại"
                                    value={bookFormData.category}
                                    options={categories}
                                    onChange={(val) => setBookFormData({...bookFormData, category: val})}
                                    placeholder="Chọn thể loại..."
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.6 }}>Số lượng</label>
                                <input type="number" value={bookFormData.quantity} onChange={e => setBookFormData({...bookFormData, quantity: e.target.value})} min="0" required style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.6 }}>Giá niêm yết (VNĐ)</label>
                                <input type="number" value={bookFormData.price} onChange={e => setBookFormData({...bookFormData, price: e.target.value})} min="0" required style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '2rem' }}>
                            <div style={{ width: '150px' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.6 }}>Ảnh bìa</label>
                                <div style={{ height: '200px', background: '#1a1a1a', borderRadius: '12px', border: '2px dashed #333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                                    {bookFormData.coverImage ? <img src={bookFormData.coverImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ opacity: 0.2 }}>No Cover</span>}
                                    {uploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>...</div>}
                                </div>
                                <input type="file" id="hub-cover" onChange={handleBookImageUpload} style={{ display: 'none' }} />
                                <label htmlFor="hub-cover" className="btn-outline" style={{ display: 'block', marginTop: '1rem', textAlign: 'center', padding: '0.5rem' }}>Upload</label>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.6 }}>Mô tả chi tiết</label>
                                <textarea value={bookFormData.description} onChange={e => setBookFormData({...bookFormData, description: e.target.value})} style={{ width: '100%', height: '200px', padding: '1rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff', resize: 'none' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="submit" className="btn-primary" style={{ padding: '1rem 3rem' }}>{editingBookId ? "Lưu thay đổi" : "Thêm sách"}</button>
                            <button type="button" className="btn-outline" onClick={resetBookForm}>Hủy</button>
                        </div>
                   </form>
                </div>
            )}

            {/* Search & Filter */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.2rem 1.5rem', borderRadius: '16px', marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                <input type="text" placeholder="Tìm kiếm sách, tác giả, ISBN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ flex: 1, padding: '0.8rem 1.2rem', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid #333', color: '#fff', outline: 'none' }} />
                <div style={{ width: '250px' }}>
                    <PremiumSelect 
                        value={selectedCategoryFilter === "ALL" ? "" : selectedCategoryFilter}
                        options={categories}
                        onChange={(val) => setSelectedCategoryFilter(val || "ALL")}
                        placeholder="Tất cả thể loại"
                    />
                </div>
            </div>

            {loading ? <p style={{ textAlign: 'center', opacity: 0.5 }}>Đang tải kho sách...</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.2rem' }}>
                    {filteredBooks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(book => (
                        <div key={book.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', gap: '1rem', padding: '1.2rem' }}>
                                <img src={book.coverImage || 'https://via.placeholder.com/80x110'} style={{ width: '80px', height: '110px', objectFit: 'cover', borderRadius: '8px' }} />
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '1rem', margin: '0 0 0.3rem', color: '#fff' }}>{book.title}</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>{book.author}</p>
                                    <div style={{ marginTop: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(187,134,252,0.1)', color: '#bb86fc', borderRadius: '4px' }}>{book.category}</span>
                                        <span style={{ 
                                          fontSize: '0.7rem', 
                                          padding: '0.2rem 0.5rem', 
                                          background: (book.quantity - (book.damagedCount || 0)) > 0 ? 'rgba(39,201,63,0.1)' : 'rgba(255,95,86,0.1)', 
                                          color: (book.quantity - (book.damagedCount || 0)) > 0 ? '#27c93f' : '#ff5f56', 
                                          borderRadius: '4px',
                                          fontWeight: (book.quantity - (book.damagedCount || 0)) <= 0 ? 'bold' : 'normal'
                                        }}>
                                          {(book.quantity - (book.damagedCount || 0))} khả dụng / {book.quantity} tổng
                                        </span>
                                        {book.damagedCount > 0 && (
                                          <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(255,165,0,0.1)', color: '#ffa502', borderRadius: '4px', border: '1px solid rgba(255,165,0,0.2)' }}>
                                            ⚠️ {book.damagedCount} hỏng
                                          </span>
                                        )}
                                        <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', color: '#ffb020', borderRadius: '4px', fontWeight: 'bold' }}>
                                          💰 {(book.price ?? 0).toLocaleString('vi-VN')} đ
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <button onClick={() => handleEditBook(book)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: 'none', color: '#bb86fc', cursor: 'pointer', fontSize: '0.85rem' }}>Sửa</button>
                                <button onClick={() => handleDeleteBook(book.id)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: 'none', color: '#ff5f56', cursor: 'pointer', fontSize: '0.85rem' }}>Xóa</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {filteredBooks.length > itemsPerPage && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="btn-outline">← Trước</button>
                    <span>Trang {currentPage}</span>
                    <button disabled={currentPage * itemsPerPage >= filteredBooks.length} onClick={() => setCurrentPage(c => c + 1)} className="btn-outline">Sau →</button>
                </div>
            )}
          </div>
        )}

        {/* ================= AUTHORS TAB ================= */}
        {activeTab === 'authors' && (
           <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ margin: '0 0 1.5rem' }}>{editingAuthorId ? "Sửa Tác Giả" : "Thêm Tác Giả"}</h3>
                    <form onSubmit={handleAuthorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input type="text" placeholder="Tên tác giả..." value={newAuthorName} onChange={e => setNewAuthorName(e.target.value)} style={{ padding: '0.9rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff' }} required />
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                          <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editingAuthorId ? "Cập nhật" : "Lưu Tác Giả"}</button>
                          {editingAuthorId && <button type="button" className="btn-outline" onClick={resetAuthorForm}>Hủy</button>}
                        </div>
                    </form>
                    <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ fontSize: '0.85rem', opacity: 0.5 }}>Chức năng đặc biệt:</p>
                        <button className="btn-outline" onClick={handleSyncAuthors} disabled={syncingAuthors} style={{ width: '100%', borderColor: '#bb86fc', color: '#bb86fc' }}>
                            {syncingAuthors ? "Đang xử lý..." : "🔄 Đồng bộ từ Kho Sách"}
                        </button>
                    </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0 }}>Danh Mục Tác Giả</h3>
                        <input 
                            type="text" 
                            placeholder="Tìm tác giả..." 
                            value={authorSearchTerm} 
                            onChange={e => setAuthorSearchTerm(e.target.value)} 
                            style={{ padding: '0.6rem 1rem', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem', width: '200px' }} 
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                        {authors
                          .filter(a => a.name.toLowerCase().includes(authorSearchTerm.toLowerCase()))
                          .map(a => (
                            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '0.95rem' }}>{a.name}</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleEditAuthor(a)} style={{ background: 'transparent', border: 'none', color: '#bb86fc', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>SỬA</button>
                                    <button onClick={() => handleDeleteAuthor(a.id)} style={{ background: 'transparent', border: 'none', color: '#ff5f56', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>×</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
           </div>
        )}

        {/* ================= CATEGORIES TAB ================= */}
        {activeTab === 'categories' && (
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 style={{ margin: '0 0 1.5rem' }}>{editingCategoryId ? "Sửa Thể Loại" : "Thêm Thể Loại"}</h3>
                    <form onSubmit={handleCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input type="text" placeholder="Tên thể loại..." value={categoryFormData.name} onChange={e => setCategoryFormData({...categoryFormData, name: e.target.value})} style={{ padding: '0.9rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff' }} required />
                        <textarea placeholder="Mô tả ngắn..." value={categoryFormData.description} onChange={e => setCategoryFormData({...categoryFormData, description: e.target.value})} style={{ padding: '0.9rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid #333', color: '#fff', height: '120px', resize: 'none' }} />
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Lưu</button>
                            {editingCategoryId && <button type="button" className="btn-outline" onClick={resetCategoryForm}>Hủy</button>}
                        </div>
                    </form>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1.5rem', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ opacity: 0.5 }}>🔍</span>
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm nhanh thể loại..." 
                            value={categorySearchTerm} 
                            onChange={e => setCategorySearchTerm(e.target.value)} 
                            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '0.9rem' }} 
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.2rem' }}>
                        {categories
                          .filter(c => c.name.toLowerCase().includes(categorySearchTerm.toLowerCase()) || (c.description && c.description.toLowerCase().includes(categorySearchTerm.toLowerCase())))
                          .map(cat => (
                        <div key={cat.id} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.5rem' }}>{cat.name}</div>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 1.5rem' }}>{cat.description || "Không có mô tả"}</p>
                            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                                <button onClick={() => handleEditCategory(cat)} style={{ background: 'none', border: 'none', color: '#bb86fc', cursor: 'pointer', fontWeight: '600' }}>Sửa</button>
                                <button onClick={() => handleDeleteCategory(cat.id)} style={{ background: 'none', border: 'none', color: '#ff5f56', cursor: 'pointer', fontWeight: '600' }}>Xóa</button>
                            </div>
                        </div>
                    ))}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

export default function InventoryHub() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải trung tâm điều hành...</div>}>
      <InventoryHubContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useState, Suspense } from "react";
import styles from "../../dashboard.module.css";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useSearchParams } from "next/navigation";

function ManageBooksContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || "ALL";

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState(initialCategory);



  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    category: '',
    quantity: 1,
    coverImage: '',
    description: '',
    isbn: '',
    publisher: '',
    year: '',
    status: 'Available'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchBooks();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setAvailableCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };


  const fetchBooks = async () => {
    try {
      const res = await fetch('/api/books');
      const data = await res.json();
      setBooks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const imageUrl = await uploadToCloudinary(file);
      setFormData({ ...formData, coverImage: imageUrl });
    } catch (error) {
      alert("Lỗi tải ảnh. Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId ? `/api/books/${editingId}` : '/api/books';
    const method = editingId ? 'PATCH' : 'POST';

    // Auto-status based on quantity
    const finalData = {
      ...formData,
      quantity: parseInt(formData.quantity) || 0,
      status: parseInt(formData.quantity) > 0 ? 'Available' : 'Out of Stock'
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });

      if (res.ok) {
        resetForm();
        fetchBooks();
      } else {
        alert("Có lỗi xảy ra khi lưu thông tin sách.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (book) => {
    setFormData({
      title: book.title || '',
      author: book.author || '',
      category: book.category || '',
      quantity: book.quantity || 0,
      coverImage: book.coverImage || '',
      description: book.description || '',
      isbn: book.isbn || '',
      publisher: book.publisher || '',
      year: book.year || '',
      status: book.status || 'Available'
    });
    setEditingId(book.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({ title: '', author: '', category: '', quantity: 1, coverImage: '', description: '', isbn: '', publisher: '', year: '', status: 'Available' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa cuốn sách này không?")) {
      await fetch(`/api/books/${id}`, { method: 'DELETE' });
      fetchBooks();
    }
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (book.isbn && book.isbn.includes(searchTerm));
    
    const matchesCategory = selectedFilter === "ALL" || book.category === selectedFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Merge formal categories with existing book categories for backup/filter
  const bookCategories = [...new Set(books.map(b => b.category || "Khác").filter(Boolean))];
  const managedNames = availableCategories.map(c => c.name);
  const filterTabs = [
    { id: 'ALL', name: 'Tất cả thể loại' },
    ...availableCategories.map(c => ({ id: c.id, name: c.name })),
    ...bookCategories.filter(name => !managedNames.includes(name)).map(name => ({ id: name, name }))
  ];



  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Kho Sách</h1>
        <button className="btn-primary" onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>
          {showForm ? "Đóng Form" : "Thêm Sách Mới"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '16px', marginBottom: '2.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>{editingId ? "Cập Nhật Thông Tin Sách" : "Đăng Ký Sách Mới"}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Tiêu đề sách</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đắc Nhân Tâm"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Mã ISBN</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 978-604-..."
                  value={formData.isbn}
                  onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Nhà xuất bản</label>
                <input
                  type="text"
                  placeholder="Ví dụ: NXB Trẻ"
                  value={formData.publisher}
                  onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Năm xuất bản</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 2024"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Tác giả</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Dale Carnegie"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Thể loại / Hạng mục</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', cursor: 'pointer' }}
                >
                  <option value="" style={{ background: '#2a2a2d' }}>Chọn thể loại...</option>
                  <option value="Chưa phân loại" style={{ background: '#2a2a2d' }}>Chưa phân loại</option>
                  {availableCategories.map(cat => (
                    <option key={cat.id} value={cat.name} style={{ background: '#2a2a2d' }}>{cat.name}</option>
                  ))}
                  {/* Handle legacy categories not in the new system */}
                  {formData.category && formData.category !== "Chưa phân loại" && !availableCategories.find(c => c.name === formData.category) && (
                    <option value={formData.category} style={{ background: '#2a2a2d' }}>{formData.category} (Cũ)</option>
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Số lượng trong kho</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                  min="0"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '2rem', alignItems: 'start' }}>
              <div style={{ textAlign: 'center' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Ảnh bìa</label>
                <div style={{ 
                  width: '140px', 
                  height: '200px', 
                  background: 'rgba(255,255,255,0.05)', 
                  borderRadius: '12px', 
                  border: '2px dashed rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  marginBottom: '1rem',
                  position: 'relative'
                }}>
                  {formData.coverImage ? (
                    <img src={formData.coverImage} alt="Cover Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '1rem', opacity: 0.2, color: 'rgba(255,255,255,0.3)' }}>No Cover</span>
                  )}
                  {uploading && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                      Đang tải...
                    </div>
                  )}
                </div>
                <input type="file" id="book-cover" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="book-cover" className="btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-block', textAlign: 'center' }}> Tải ảnh từ máy </label>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7, textAlign: 'center' }}>hoặc URL:</div>
                  <input
                    type="text"
                    placeholder="Nhập link ảnh..."
                    value={formData.coverImage}
                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.8rem', textAlign: 'center' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Mô tả tóm tắt</label>
                <textarea
                  placeholder="Nhập giới thiệu ngắn về cuốn sách..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', minHeight: '160px', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary" style={{ padding: '1rem 2.5rem' }}>{editingId ? "Lưu Thay Đổi" : "Đăng Ký Sách"}</button>
              <button type="button" className="btn-outline" onClick={resetForm} style={{ padding: '1rem 2.5rem' }}>Hủy bỏ</button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '1.5rem', 
        marginBottom: '2.5rem', 
        background: 'rgba(255,255,255,0.02)', 
        padding: '1.5rem', 
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Tìm theo tên, tác giả hoặc ISBN..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ 
                width: '100%', 
                padding: '0.9rem 1rem', 
                paddingLeft: '3rem',
                borderRadius: '12px', 
                background: 'rgba(255,255,255,0.04)', 
                border: '1px solid rgba(255,255,255,0.08)', 
                color: 'white',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(187,134,252,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            <span style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3, fontSize: '1.2rem' }}>🔍</span>
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.5 }}>
            Tìm thấy <strong>{filteredBooks.length}</strong> cuốn sách
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '600', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '1px' }}>Lọc theo thể loại</div>
          <div style={{ 
            display: 'flex', 
            gap: '0.8rem', 
            overflowX: 'auto', 
            paddingBottom: '0.5rem',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}>
            <style jsx>{`
              div::-webkit-scrollbar { display: none; }
            `}</style>
            {filterTabs.map(tab => {
              const isActive = (tab.id === 'ALL' && selectedFilter === 'ALL') || (selectedFilter === tab.name);
              return (
                <button
                  key={tab.id}
                  onClick={() => { setSelectedFilter(tab.name === 'Tất cả thể loại' ? 'ALL' : tab.name); setCurrentPage(1); }}
                  style={{
                    padding: '0.6rem 1.4rem',
                    borderRadius: '99px',
                    border: 'none',
                    background: isActive 
                      ? 'linear-gradient(135deg, #bb86fc, #9965f4)' 
                      : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#000' : 'rgba(255,255,255,0.7)',
                    fontWeight: '700',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.3s ease',
                    boxShadow: isActive ? '0 4px 15px rgba(153, 101, 244, 0.4)' : 'none',
                    fontSize: '0.85rem',
                    flexShrink: 0
                  }}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Book Stats Bar */}

      {!loading && books.length > 0 && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem 1.5rem', flex: '1', minWidth: '140px' }}>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.3rem' }}>Tổng sách</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#bb86fc' }}>{books.length}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem 1.5rem', flex: '1', minWidth: '140px' }}>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.3rem' }}>Tổng bản sách</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#03dac6' }}>{books.reduce((s, b) => s + (b.quantity || 0), 0)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem 1.5rem', flex: '1', minWidth: '140px' }}>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.3rem' }}>Còn sách</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#27c93f' }}>{books.filter(b => (b.quantity || 0) > 0).length}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem 1.5rem', flex: '1', minWidth: '140px' }}>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.3rem' }}>Hết sách</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ff5f56' }}>{books.filter(b => (b.quantity || 0) <= 0).length}</div>
          </div>
        </div>
      )}

      {/* Book Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.5)' }}>

          Đang tải danh sách sách...
        </div>
      ) : books.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>

          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Chưa có cuốn sách nào trong hệ thống.</p>
          <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Nhấn "Thêm Sách Mới" để bắt đầu.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.2rem' }}>
            {filteredBooks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(book => (

              <div key={book.id} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              overflow: 'hidden',
              transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
              cursor: 'default'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(187,134,252,0.3)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', gap: '1rem', padding: '1.2rem' }}>
                {/* Book Cover */}
                <div style={{
                  width: '80px',
                  height: '110px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, rgba(187,134,252,0.15), rgba(3,218,198,0.1))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {book.coverImage ? (
                    <img src={book.coverImage} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '0.7rem', opacity: 0.3, color: 'rgba(255,255,255,0.3)' }}>N/A</span>
                  )}
                </div>

                {/* Book Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.3rem', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{book.title}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.6rem' }}>{book.author}</p>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {book.category && (
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(187,134,252,0.15)', color: '#bb86fc', borderRadius: '4px' }}>
                        {book.category}
                      </span>
                    )}
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      background: (book.quantity > 0) ? 'rgba(39, 201, 63, 0.12)' : 'rgba(255, 95, 86, 0.12)',
                      color: (book.quantity > 0) ? '#27c93f' : '#ff5f56',
                      borderRadius: '4px',
                      fontWeight: '600'
                    }}>
                      {(book.quantity > 0) ? `${book.quantity} bản` : 'Hết sách'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
                <button
                  onClick={() => handleEdit(book)}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    background: 'transparent',
                    border: 'none',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    color: '#bb86fc',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(187,134,252,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Chỉnh sửa
                </button>
                <button
                  onClick={() => handleDelete(book.id)}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    background: 'transparent',
                    border: 'none',
                    color: '#ff5f56',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,95,86,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Xoá
                </button>
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
              className="btn-outline"
              style={{ opacity: currentPage === 1 ? 0.3 : 1 }}
            >
              ← Trang trước
            </button>
            <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>Trang {currentPage} / {Math.ceil(filteredBooks.length / itemsPerPage)}</span>
            <button 
              disabled={currentPage >= Math.ceil(filteredBooks.length / itemsPerPage)}
              onClick={() => setCurrentPage(curr => curr + 1)}
              className="btn-outline"
              style={{ opacity: currentPage >= Math.ceil(filteredBooks.length / itemsPerPage) ? 0.3 : 1 }}
            >
              Trang sau →
            </button>
          </div>
        )}

      </>
      )}
    </div>
  );
}

export default function ManageBooks() {
  return (
    <Suspense fallback={<div className={styles.container}><p>Đang tải...</p></div>}>
      <ManageBooksContent />
    </Suspense>
  );
}


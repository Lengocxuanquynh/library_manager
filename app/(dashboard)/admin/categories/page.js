"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";
import { useNotification } from "@/components/NotificationProvider";
import { useRouter } from "next/navigation";

export default function ManageCategories() {
  const router = useRouter();
  const { showToast, confirmAction } = useNotification();
  const [categories, setCategories] = useState([]);

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [viewingBooksCategory, setViewingBooksCategory] = useState(null);
  const selectedCategoryBooks = viewingBooksCategory ? books.filter(b => b.category === viewingBooksCategory) : [];





  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const [catRes, bookRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/books')
      ]);
      const catData = await catRes.json();
      const bookData = await bookRes.json();
      const formalCats = Array.isArray(catData) ? catData : [];
      const allBooks = Array.isArray(bookData) ? bookData : [];
      
      setCategories(formalCats);
      setBooks(allBooks);

      // --- Tự động đồng bộ ---
      const bookCats = [...new Set(allBooks.map(b => b.category).filter(cat => cat && cat !== "Chưa phân loại" && cat !== "Khác"))];
      const existingNames = formalCats.map(c => c.name);
      const newCats = bookCats.filter(name => !existingNames.includes(name));

      if (newCats.length > 0) {
        console.log(`Đang tự động đồng bộ ${newCats.length} thể loại mới...`);
        for (const name of newCats) {
          await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: 'Tự động đồng bộ từ dữ liệu sách' })
          });
        }
        // Tải lại danh sách sau khi đồng bộ âm thầm
        const finalRes = await fetch('/api/categories');
        const finalData = await finalRes.json();
        setCategories(Array.isArray(finalData) ? finalData : []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }

  }


  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (cat) => {
    setFormData({ name: cat.name, description: cat.description || '' });
    setEditingId(cat.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    confirmAction("Bạn có chắc chắn muốn xóa thể loại này?", async () => {
      try {
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchCategories();
          showToast("Đã xóa thể loại thành công.", "success");
        }
      } catch (error) {
        console.error(error);
        showToast("Lỗi khi xóa thể loại.", "error");
      }
    });
  };


  const handleSubmit = async (e) => {

    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    const url = editingId ? `/api/categories/${editingId}` : '/api/categories';
    const method = editingId ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        resetForm();
        fetchCategories();
        showToast(editingId ? "Cập nhật thành công!" : "Thêm mới thành công!", "success");
      } else {
        showToast("Có lỗi xảy ra", "error");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Thể Loại</h1>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <button 
            className="btn-primary" 
            onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
          >
            {showForm ? "Đóng" : "+ Thêm Thể Loại"}
          </button>
        </div>
      </div>



      {showForm && (
        <div style={{ 
          background: 'rgba(255,255,255,0.05)', 
          padding: '2rem', 
          borderRadius: '16px', 
          marginBottom: '2rem',
          border: '1px solid rgba(255,255,255,0.1)' 
        }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>
            {editingId ? "Cập Nhật Thể Loại" : "Thêm Thể Loại Mới"}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7, fontSize: '0.9rem' }}>Tên thể loại</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ví dụ: Văn học, Khoa học..."
                required
                style={{ 
                  width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', 
                  background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', 
                  color: '#fff', outline: 'none' 
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7, fontSize: '0.9rem' }}>Mô tả (tùy chọn)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả ngắn về thể loại này..."
                style={{ 
                  width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', 
                  background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', 
                  color: '#fff', outline: 'none', minHeight: '80px', fontFamily: 'inherit'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                type="submit" 
                disabled={submitting} 
                className="btn-primary" 
                style={{ padding: '0.8rem 2rem' }}
              >
                {submitting ? "Đang xử lý..." : editingId ? "Cập Nhật" : "Lưu Thể Loại"}
              </button>
              <button 
                type="button" 
                onClick={resetForm} 
                className="btn-outline" 
                style={{ padding: '0.8rem 2rem' }}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Đang tải...</p>
        ) : categories.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '3rem', opacity: 0.3 }}>Chưa có thể loại nào.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.2rem' }}>
            {categories.map(cat => (
              <div 
                key={cat.id} 
                onClick={() => setViewingBooksCategory(cat.name)}
                style={{ 
                  background: 'rgba(255,255,255,0.04)', 
                  padding: '1.5rem', 
                  borderRadius: '14px', 
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.8rem',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(187,134,252,0.4)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.3rem' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>{cat.name}</div>
                      <span 
                        style={{ 
                          fontSize: '0.7rem', 
                          padding: '0.1rem 0.6rem', 
                          background: 'rgba(187,134,252,0.15)', 
                          color: '#bb86fc', 
                          borderRadius: '12px',
                          fontWeight: '600',
                          border: '1px solid rgba(187,134,252,0.2)'
                        }}
                      >
                        {books.filter(b => b.category === cat.name).length} sách
                      </span>
                    </div>



                    {cat.description && (
                      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.4' }}>
                        {cat.description}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.8rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEdit(cat); }} 
                    style={{ background: 'none', border: 'none', color: '#bb86fc', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                  >
                    Chỉnh sửa
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }} 
                    style={{ background: 'none', border: 'none', color: '#ff5f56', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                  >
                    Xóa
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* category Book modal */}
      {viewingBooksCategory && (
        <div 
          onClick={() => setViewingBooksCategory(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#181818', maxWidth: '600px', width: '100%', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}
          >
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Sách thuộc: <span style={{ color: '#bb86fc' }}>{viewingBooksCategory}</span></h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', opacity: 0.5 }}>Tổng cộng {selectedCategoryBooks.length} cuốn</p>
              </div>
              <button 
                onClick={() => setViewingBooksCategory(null)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
            
            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
              {selectedCategoryBooks.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.3 }}>Chưa có sách nào thuộc thể loại này.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedCategoryBooks.map(book => (
                    <div key={book.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#fff' }}>{book.title}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{book.author}</div>
                      </div>
                      <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: (book.quantity > 0) ? 'rgba(39,201,63,0.1)' : 'rgba(255,95,86,0.1)', color: (book.quantity > 0) ? '#27c93f' : '#ff5f56', borderRadius: '4px' }}>
                        {(book.quantity > 0) ? 'Còn hàng' : 'Hết sách'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={{ padding: '1.5rem 2rem', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
              <button 
                onClick={() => {
                  router.push(`/admin/books?category=${encodeURIComponent(viewingBooksCategory)}`);
                  setViewingBooksCategory(null);
                }}
                className="btn-outline" 
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
              >
                Quản lý chi tiết →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}


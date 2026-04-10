"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";

export default function ManageBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newBook, setNewBook] = useState({ title: '', author: '', category: '', status: 'Available', coverImage: '', quantity: 1, description: '' });

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

  const handleDelete = async (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa cuốn sách này không?")) {
      await fetch(`/api/books/${id}`, { method: 'DELETE' });
      fetchBooks();
    }
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    if (!newBook.title || !newBook.author) return;

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBook,
          quantity: parseInt(newBook.quantity) || 0
        })
      });

      if (res.ok) {
        setNewBook({ title: '', author: '', category: '', status: 'Available', coverImage: '', quantity: 1, description: '' });
        setShowForm(false);
        fetchBooks();
      } else {
        alert("Lỗi khi thêm sách qua API");
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Sách</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Hủy" : "Thêm Sách Mới"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Thêm Sách Mới</h3>
          <form onSubmit={handleAddBook} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
            <input
              type="text"
              placeholder="Tiêu đề sách"
              value={newBook.title}
              onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              required
            />
            <input
              type="text"
              placeholder="Tác giả"
              value={newBook.author}
              onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              required
            />
            <input
              type="text"
              placeholder="Hạng mục (Thể loại)"
              value={newBook.category}
              onChange={(e) => setNewBook({ ...newBook, category: e.target.value })}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
            <input
              type="number"
              placeholder="Số lượng"
              value={newBook.quantity}
              onChange={(e) => setNewBook({ ...newBook, quantity: e.target.value })}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              min="0"
              required
            />
            <input
              type="url"
              placeholder="Đường dẫn ảnh bìa (Link Image)"
              value={newBook.coverImage || ''}
              onChange={(e) => setNewBook({ ...newBook, coverImage: e.target.value })}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', gridColumn: 'span 2' }}
            />
            <textarea
              placeholder="Mô tả tóm tắt nội dung sách..."
              value={newBook.description || ''}
              onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', gridColumn: 'span 2', minHeight: '100px', fontFamily: 'inherit' }}
            />
            <button type="submit" className="btn-primary" style={{ gridColumn: 'span 2' }}>Lưu Sách</button>
          </form>
        </div>
      )}

      <div className={styles.tableCard} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.5rem' }}>
        {loading ? (
          <p>Đang tải danh sách...</p>
        ) : (
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', width: '60px' }}>Ảnh</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Tiêu Đề</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Tác Giả</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Số Lượng</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Trạng Thái</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {books.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '1rem', textAlign: 'center' }}>Không tìm thấy cuốn sách nào trong kho.</td>
                  </tr>
                ) : (
                  books.map(book => (
                    <tr key={book.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ width: '40px', height: '60px', backgroundImage: `url(${book.coverImage || 'https://via.placeholder.com/40x60'})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '4px' }}></div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{book.title}</td>
                      <td style={{ padding: '1rem' }}>{book.author}</td>
                      <td style={{ padding: '1rem' }}>{book.quantity || 0}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          background: (book.quantity > 0) ? 'rgba(39, 201, 63, 0.2)' : 'rgba(255, 95, 86, 0.2)',
                          color: (book.quantity > 0) ? '#27c93f' : '#ff5f56',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem'
                        }}>
                          {(book.quantity > 0) ? 'Còn Sách' : 'Hết Sách'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button onClick={() => handleDelete(book.id)} style={{ background: 'rgba(255, 95, 86, 0.1)', color: '#ff5f56', border: '1px solid rgba(255, 95, 86, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer' }}>Xoá</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

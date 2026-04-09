"use client";

import { useEffect, useState } from "react";
import { getBooks, deleteBook } from "@/services/db";
import styles from "../../dashboard.module.css";

export default function ManageBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const data = await getBooks();
      setBooks(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa cuốn sách này không?")) {
      await deleteBook(id);
      fetchBooks();
    }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Sách</h1>
        <button className="btn-primary">Thêm Sách Mới</button>
      </div>

      <div className={styles.tableCard} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.5rem' }}>
        {loading ? (
          <p>Đang tải danh sách...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Tiêu Đề</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Tác Giả</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hạng Mục</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Trạng Thái</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {books.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '1rem', textAlign: 'center' }}>Không tìm thấy cuốn sách nào trong kho.</td>
                </tr>
              ) : (
                books.map(book => (
                  <tr key={book.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{book.title}</td>
                    <td style={{ padding: '1rem' }}>{book.author}</td>
                    <td style={{ padding: '1rem' }}>{book.category}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        background: book.status === 'Available' ? 'rgba(39, 201, 63, 0.2)' : 'rgba(255, 189, 46, 0.2)',
                        color: book.status === 'Available' ? '#27c93f' : '#ffbd2e',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem'
                       }}>
                        {book.status || 'Chưa rõ'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button className="btn-outline" style={{ marginRight: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Sửa</button>
                      <button onClick={() => handleDelete(book.id)} style={{ background: 'rgba(255, 95, 86, 0.1)', color: '#ff5f56', border: '1px solid rgba(255, 95, 86, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer' }}>Xoá</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";

export default function ManagePosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    coverImage: '',
    author: 'Admin'
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      setPosts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId ? `/api/posts/${editingId}` : '/api/posts';
    const method = editingId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      setFormData({ title: '', slug: '', excerpt: '', content: '', coverImage: '', author: 'Admin' });
      setShowForm(false);
      setEditingId(null);
      fetchPosts();
    }
  };

  const handleEdit = (post) => {
    setFormData({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage || '',
      author: post.author || 'Admin'
    });
    setEditingId(post.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Xác nhận xóa bài viết này?")) {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      fetchPosts();
    }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Bài Viết</h1>
        <button 
          className="btn-primary" 
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) setEditingId(null);
          }}
        >
          {showForm ? "Đóng Form" : "Viết Bài Mới"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '16px', marginBottom: '2.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>{editingId ? "Chỉnh Sửa Bài Viết" : "Tạo Bài Viết Mới"}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.2rem' }}>
              <input 
                type="text" 
                placeholder="Tiêu đề bài viết" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                required
              />
              <input 
                type="text" 
                placeholder="Slug (ví dụ: bai-viet-moi)" 
                value={formData.slug}
                onChange={(e) => setFormData({...formData, slug: e.target.value})}
                style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                required
              />
            </div>
            
            <input 
              type="url" 
              placeholder="Link ảnh bìa (Cover Image URL)" 
              value={formData.coverImage}
              onChange={(e) => setFormData({...formData, coverImage: e.target.value})}
              style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
            />

            <textarea 
              placeholder="Đoạn trích ngắn (Excerpt)" 
              value={formData.excerpt}
              onChange={(e) => setFormData({...formData, excerpt: e.target.value})}
              style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', minHeight: '80px' }}
            />

            <textarea 
              placeholder="Nội dung bài viết (Hỗ trợ HTML)" 
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', minHeight: '300px', fontFamily: 'monospace' }}
              required
            />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn-primary" style={{ padding: '1rem 2rem' }}>
                {editingId ? "Cập Nhật Bài Viết" : "Xuất Bản Bài Viết"}
              </button>
              <button 
                type="button" 
                className="btn-outline" 
                onClick={() => { setShowForm(false); setEditingId(null); }}
                style={{ padding: '1rem 2rem' }}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.tableCard} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1.5rem' }}>
        {loading ? (
          <p>Đang tải danh sách bài viết...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>Ảnh</th>
                <th style={{ padding: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>Tiêu Đề</th>
                <th style={{ padding: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>Slug</th>
                <th style={{ padding: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>Tác Giả</th>
                <th style={{ padding: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Chưa có bài viết nào được tạo.</td>
                </tr>
              ) : (
                posts.map(post => (
                  <tr key={post.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ 
                        width: '60px', 
                        height: '40px', 
                        borderRadius: '6px', 
                        backgroundImage: `url(${post.coverImage || 'https://via.placeholder.com/60x40'})`, 
                        backgroundSize: 'cover', 
                        backgroundPosition: 'center' 
                      }}></div>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '600', color: '#fff' }}>{post.title}</td>
                    <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>{post.slug}</td>
                    <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>{post.author || 'Admin'}</td>
                    <td style={{ padding: '1rem' }}>
                      <button 
                        onClick={() => handleEdit(post)} 
                        className="btn-outline" 
                        style={{ marginRight: '0.8rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        Sửa
                      </button>
                      <button 
                        onClick={() => handleDelete(post.id)} 
                        style={{ 
                          background: 'rgba(255, 95, 86, 0.1)', 
                          color: '#ff5f56', 
                          border: '1px solid rgba(255, 95, 86, 0.2)', 
                          padding: '0.5rem 1rem', 
                          borderRadius: '8px', 
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        Xoá
                      </button>
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

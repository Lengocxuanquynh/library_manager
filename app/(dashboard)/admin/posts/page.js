"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";
import { slugify } from "../../../../lib/utils";
import { uploadToCloudinary } from "../../../../lib/cloudinary";

export default function ManagePosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    coverImage: '',
    author: 'Admin',
    tags: ''
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setFormData({
      ...formData,
      title,
      slug: editingId ? formData.slug : slugify(title)
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const imageUrl = await uploadToCloudinary(file);
      setFormData({ ...formData, coverImage: imageUrl });
    } catch (error) {
      alert("Lỗi tải ảnh lên. Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId ? `/api/posts/${editingId}` : '/api/posts';
    const method = editingId ? 'PATCH' : 'POST';

    // Process tags string to array
    const postData = {
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
    };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    });

    if (res.ok) {
      resetForm();
      fetchPosts();
    }
  };

  const resetForm = () => {
    setFormData({ title: '', slug: '', excerpt: '', content: '', coverImage: '', author: 'Admin', tags: '' });
    setShowForm(false);
    setEditingId(null);
    setPreviewMode(false);
  };

  const handleEdit = (post) => {
    setFormData({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverImage: post.coverImage || '',
      author: post.author || 'Admin',
      tags: Array.isArray(post.tags) ? post.tags.join(', ') : ''
    });
    setEditingId(post.id);
    setShowForm(true);
    setPreviewMode(false);
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
            if (showForm) resetForm();
            else setShowForm(true);
          }}
        >
          {showForm ? "Đóng Form" : "Viết Bài Mới"}
        </button>
      </div>

      {/* 🔍 Search Bar - Premium Glassmorphism */}
      <div style={{ 
        background: 'rgba(255,255,255,0.02)', 
        padding: '1.5rem', 
        borderRadius: '16px', 
        marginBottom: '2rem', 
        display: 'flex', 
        gap: '1.5rem', 
        alignItems: 'center',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <input 
          type="text" 
          placeholder="Tìm bài viết theo tiêu đề, tác giả..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          style={{ 
            flex: 1, 
            padding: '0.9rem 1.2rem', 
            borderRadius: '12px', 
            background: 'rgba(0,0,0,0.3)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            color: '#fff',
            fontSize: '0.95rem',
            outline: 'none',
            transition: '0.3s'
          }} 
          onFocus={e => e.target.style.borderColor = '#bb86fc'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '16px', marginBottom: '2.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem' }}>{editingId ? "Chỉnh Sửa Bài Viết" : "Tạo Bài Viết Mới"}</h2>
            <button 
              type="button" 
              onClick={() => setPreviewMode(!previewMode)}
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
            >
              {previewMode ? "Quay lại Sửa" : "Xem Trước"}
            </button>
          </div>

          {!previewMode ? (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Tiêu đề</label>
                  <input 
                    type="text" 
                    placeholder="Nhập tiêu đề bài viết..." 
                    value={formData.title}
                    onChange={handleTitleChange}
                    style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Đường dẫn (Slug)</label>
                  <input 
                    type="text" 
                    placeholder="slug-bai-viet" 
                    value={formData.slug}
                    onChange={(e) => setFormData({...formData, slug: e.target.value})}
                    style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                    required
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Ảnh bìa</label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      id="image-upload"
                      style={{ display: 'none' }}
                    />
                    <label 
                      htmlFor="image-upload" 
                      style={{ padding: '0.8rem 1.2rem', background: '#bb86fc', color: '#000', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      {uploading ? "Đang tải..." : "Tải ảnh lên"}
                    </label>
                    {formData.coverImage && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formData.coverImage}</span>
                        <button type="button" onClick={() => setFormData({...formData, coverImage: ''})} style={{ background: 'none', border: 'none', color: '#ff5f56', cursor: 'pointer' }}>×</button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Thẻ (Tags) - Phân cách bằng dấu phẩy</label>
                  <input 
                    type="text" 
                    placeholder="tin tuc, su kien, sach moi" 
                    value={formData.tags}
                    onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Đoạn trích (Excerpt)</label>
                <textarea 
                  placeholder="Mô tả ngắn gọn về bài viết..." 
                  value={formData.excerpt}
                  onChange={(e) => setFormData({...formData, excerpt: e.target.value})}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', minHeight: '80px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Nội dung chi tiết</label>
                <textarea 
                  placeholder="Nhập nội dung bài bài viết... (Có thể sử dụng thẻ HTML)" 
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', minHeight: '350px', fontFamily: 'monospace', lineHeight: '1.6' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn-primary" style={{ padding: '1rem 2.5rem' }}>
                  {editingId ? "Lưu Thay Đổi" : "Xuất Bản Ngay"}
                </button>
                <button 
                  type="button" 
                  className="btn-outline" 
                  onClick={resetForm}
                  style={{ padding: '1rem 2.5rem' }}
                >
                  Hủy bỏ
                </button>
              </div>
            </form>
          ) : (
            <div style={{ background: '#1a1a1c', padding: '2rem', borderRadius: '12px' }}>
              {formData.coverImage && (
                <img src={formData.coverImage} alt="Preview" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '2rem' }} />
              )}
              <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{formData.title || "Chưa có tiêu đề"}</h1>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', opacity: 0.6 }}>
                <span>Tác giả: {formData.author}</span>
                <span>•</span>
                <span>Slug: {formData.slug}</span>
              </div>
              <div style={{ fontSize: '1.2rem', color: '#aaa', fontStyle: 'italic', marginBottom: '2rem', borderLeft: '4px solid #bb86fc', paddingLeft: '1.5rem' }}>
                {formData.excerpt}
              </div>
              <div 
                className="preview-content"
                dangerouslySetInnerHTML={{ __html: formData.content }} 
                style={{ lineHeight: '1.8', fontSize: '1.1rem' }}
              />
            </div>
          )}
        </div>
      )}

      <div className={styles.tableCard} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1.5rem' }}>
        {loading ? (
          <p>Đang tải danh sách bài viết...</p>
        ) : (
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>Ảnh</th>
                  <th style={{ padding: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>Tiêu Đề</th>
                  <th style={{ padding: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>Tác Giả & Ngày</th>
                  <th style={{ padding: '1.2rem', color: 'rgba(255,255,255,0.6)' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      Chưa có bài viết nào được tạo. Hãy bắt đầu viết ngay!
                    </td>
                  </tr>
                ) : (
                  posts
                    .filter(p => 
                      p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (p.author && p.author.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map(post => (
                    <tr key={post.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1.2rem' }}>
                        <div style={{ 
                          width: '80px', 
                          height: '50px', 
                          borderRadius: '8px', 
                          backgroundImage: `url(${post.coverImage || 'https://via.placeholder.com/80x50'})`, 
                          backgroundSize: 'cover', 
                          backgroundPosition: 'center',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}></div>
                      </td>
                      <td style={{ padding: '1.2rem' }}>
                        <div style={{ fontWeight: '600', color: '#fff', marginBottom: '0.3rem' }}>{post.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#bb86fc', opacity: 0.8 }}>/{post.slug}</div>
                      </td>
                      <td style={{ padding: '1.2rem' }}>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>{post.author || 'Admin'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                          {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString('vi-VN') : 'Vừa xong'}
                        </div>
                      </td>
                      <td style={{ padding: '1.2rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                            onClick={() => handleEdit(post)} 
                            className="btn-outline" 
                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                          >
                            Chỉnh sửa
                          </button>
                          <button 
                            onClick={() => handleDelete(post.id)} 
                            style={{ 
                              background: 'rgba(255, 95, 86, 0.1)', 
                              color: '#ff5f56', 
                              border: '1px solid rgba(255, 95, 86, 0.2)', 
                              padding: '0.4rem 1rem', 
                              borderRadius: '8px', 
                              cursor: 'pointer',
                              fontSize: '0.85rem'
                            }}
                          >
                            Xoá
                          </button>
                        </div>
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

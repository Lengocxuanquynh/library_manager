"use client";

import { useEffect, useState } from "react";
import styles from "../../dashboard.module.css";

export default function ManageTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [newTx, setNewTx] = useState({ memberId: '', bookId: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, memRes, bookRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/members'),
        fetch('/api/books')
      ]);
      const [txData, memData, bookData] = await Promise.all([
        txRes.json(),
        memRes.json(),
        bookRes.json()
      ]);
      setTransactions(txData);
      setMembers(memData);
      setBooks(bookRes.ok ? bookData : []); 
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBorrow = async (e) => {
    e.preventDefault();
    if (!newTx.memberId || !newTx.bookId) return;

    const selectedMember = members.find(m => m.id === newTx.memberId);
    const selectedBook = books.find(b => b.id === newTx.bookId);

    if (selectedMember && selectedBook) {
      const res = await fetch('/api/transactions/borrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selectedBook.id,
          memberId: selectedMember.id,
          memberName: selectedMember.name,
          bookTitle: selectedBook.title
        })
      });
      if (!res.ok) {
        console.error("Lỗi API mượn sách");
        return;
      }
      setNewTx({ memberId: '', bookId: '' });
      setShowForm(false);
      fetchData(); // Refresh all to get updated status
    }
  };

  const handleReturn = async (txId, bookId) => {
    if (confirm("Xác nhận trả cuốn sách này?")) {
      const res = await fetch('/api/transactions/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId, bookId })
      });
      if (!res.ok) {
        console.error("Lỗi API trả sách");
        return;
      }
      fetchData();
    }
  };

  const availableBooks = books.filter(b => b.status === "Available");

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Phiếu Mượn</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Hủy" : "Tạo Phiếu Mượn"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Tạo Phiếu Mượn Sách</h3>
          <form onSubmit={handleBorrow} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
            
            <select 
              value={newTx.memberId}
              onChange={(e) => setNewTx({...newTx, memberId: e.target.value})}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              required
            >
              <option value="">-- Chọn Hội Viên --</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
              ))}
            </select>

            <select 
              value={newTx.bookId}
              onChange={(e) => setNewTx({...newTx, bookId: e.target.value})}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              required
            >
              <option value="">-- Chọn Sách --</option>
              {availableBooks.length === 0 && <option value="" disabled>Không có sách nào đang trống</option>}
              {availableBooks.map(b => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>

            <button type="submit" className="btn-primary" style={{ gridColumn: 'span 2' }}>Tạo Phiếu</button>
          </form>
        </div>
      )}

      <div className={styles.tableCard} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.5rem' }}>
        {loading ? (
          <p>Đang tải danh sách phiếu mượn...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Người Mượn</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Sách</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Mượn</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Trạng Thái</th>
                <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '1rem', textAlign: 'center' }}>Chưa có giao dịch nào.</td>
                </tr>
              ) : (
                transactions.map(tx => {
                  const dateBorrow = tx.borrowDate?.toDate ? tx.borrowDate.toDate().toLocaleDateString('vi-VN') : 'N/A';
                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{tx.memberName}</td>
                      <td style={{ padding: '1rem' }}>{tx.bookTitle}</td>
                      <td style={{ padding: '1rem' }}>{dateBorrow}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          background: tx.status === 'Active' ? 'rgba(39, 201, 63, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                          color: tx.status === 'Active' ? '#27c93f' : '#aaa',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem'
                         }}>
                          {tx.status === 'Active' ? 'Đang Mượn' : 'Đã Trả'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {tx.status === 'Active' ? (
                          <button onClick={() => handleReturn(tx.id, tx.bookId)} style={{ background: 'rgba(39, 201, 63, 0.1)', color: '#27c93f', border: '1px solid rgba(39, 201, 63, 0.2)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer' }}>Trả Sách</button>
                        ) : (
                          <span style={{ color: '#666', fontSize: '0.9rem' }}>Hoàn tất</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

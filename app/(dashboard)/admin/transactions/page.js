"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "../../dashboard.module.css";

export default function ManageLoans() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'records'

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [reqRes, recRes] = await Promise.all([
        fetch(`/api/admin/borrow-requests?status=PENDING&adminId=${user.uid}`),
        fetch(`/api/admin/borrow-records?adminId=${user.uid}`)
      ]);

      const requestsData = await reqRes.json();
      setRequests(Array.isArray(requestsData) ? requestsData : []);

      const recordsData = await recRes.json();
      setRecords(Array.isArray(recordsData) ? recordsData : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (req) => {
    if (confirm(`Duyệt cho ${req.userName} mượn cuốn "${req.bookTitle}"?`)) {
      try {
        const res = await fetch('/api/admin/approve-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: req.id,
            userId: req.userId,
            bookId: req.bookId,
            userName: req.userName,
            bookTitle: req.bookTitle,
            adminId: user.uid
          })
        });
        if (res.ok) {
          alert("Đã duyệt thành công!");
          fetchData();
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleReject = async (requestId) => {
    if (confirm("Từ chối yêu cầu này?")) {
      try {
        const res = await fetch('/api/admin/reject-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, adminId: user.uid })
        });
        if (res.ok) {
          fetchData();
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleReturn = async (recordId, bookId) => {
    if (confirm("Xác nhận trả sách?")) {
      try {
        const res = await fetch('/api/return-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId, bookId, adminId: user.uid })
        });
        if (res.ok) {
          fetchData();
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Quản Lý Mượn Trả</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab('requests')}
          >
            Yêu Cầu Chờ Duyệt ({requests.length})
          </button>
          <button
            className={activeTab === 'records' ? 'btn-primary' : 'btn-outline'}
            onClick={() => setActiveTab('records')}
          >
            Sách Đang Mượn & Lịch Sử
          </button>
        </div>
      </div>

      <div className={styles.tableCard} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.5rem', marginTop: '1rem' }}>
        {loading ? (
          <p>Đang tải dữ liệu...</p>
        ) : activeTab === 'requests' ? (
          /* PENDING REQUESTS TABLE */
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hội Viên</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Sách Yêu Cầu</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Gửi</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }}>Không có yêu cầu nào đang chờ.</td>
                  </tr>
                ) : (
                  requests.map(req => (
                    <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{req.userName}</td>
                      <td style={{ padding: '1rem' }}>{req.bookTitle}</td>
                      <td style={{ padding: '1rem' }}>{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString('vi-VN') : 'Vừa xong'}</td>
                      <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleApprove(req)} style={{ background: 'rgba(39, 201, 63, 0.2)', color: '#27c93f', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}>Duyệt</button>
                        <button onClick={() => handleReject(req.id)} style={{ background: 'rgba(255, 95, 86, 0.2)', color: '#ff5f56', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}>Từ Chối</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* RECORDS TABLE */
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Người Mượn</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Sách</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Ngày Phải Trả</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Trạng Thái</th>
                  <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '1rem', textAlign: 'center' }}>Chưa có bản ghi mượn sách nào.</td>
                  </tr>
                ) : (
                  records.map(rec => {
                    const dueDate = rec.dueDate?.toDate ? rec.dueDate.toDate() : (rec.dueDate ? new Date(rec.dueDate) : null);
                    const isOverdue = rec.status === 'Active' && dueDate && dueDate < new Date();
  
                    return (
                      <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{rec.memberName || rec.userName}</td>
                        <td style={{ padding: '1rem' }}>{rec.bookTitle}</td>
                        <td style={{ padding: '1rem' }}>{dueDate ? dueDate.toLocaleDateString('vi-VN') : 'N/A'}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            background: isOverdue ? 'rgba(255, 95, 86, 0.2)' : rec.status === 'Active' || rec.status === 'BORROWING' ? 'rgba(39, 201, 63, 0.2)' : 'rgba(255,255,255,0.1)',
                            color: isOverdue ? '#ff5f56' : rec.status === 'Active' || rec.status === 'BORROWING' ? '#27c93f' : '#888',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem'
                          }}>
                            {isOverdue ? 'Quá Hạn' : (rec.status === 'Active' || rec.status === 'BORROWING' ? 'Đang Mượn' : 'Đã Trả')}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {(rec.status === 'Active' || rec.status === 'BORROWING') && (
                            <button onClick={() => handleReturn(rec.id, rec.bookId)} className="btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>Thu Hồi / Trả</button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

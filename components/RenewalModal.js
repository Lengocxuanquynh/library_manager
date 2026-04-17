"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthProvider";

export default function RenewalModal({ book, isOpen, onClose, userId, onSuccess }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do gia hạn.");
      return;
    }

    setSubmitting(true);
    const loadingToast = toast.loading("Đang gửi yêu cầu gia hạn...");
    try {
      const res = await fetch('/api/user/renewal/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          recordId: book.recordId || book.id,
          reason: reason.trim(),
          userName: user?.displayName || "Độc giả",
          bookTitles: book.bookTitle // Đã được nối chuỗi từ User Page
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message, { id: loadingToast });
        setReason("");
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || "Gửi yêu cầu thất bại", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối server", { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 2000, padding: "1rem"
    }}>
      <div style={{
        background: "#1e1e1e", padding: "2rem", borderRadius: "16px",
        width: "100%", maxWidth: "450px", border: "1px solid rgba(187,134,252,0.2)",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
      }}>
        <h3 style={{ margin: "0 0 1rem 0", color: "#bb86fc", fontSize: "1.25rem" }}>Yêu Cầu Gia Hạn</h3>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          Sách: <strong>{book.bookTitle}</strong><br/>
          Hạn trả hiện tại: {book.dueDateFormatted}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}> Lý do gia hạn (Bắt buộc) </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Tôi chưa đọc xong, tôi cần dùng cho nghiên cứu thêm..."
              style={{
                width: "100%", minHeight: "100px", padding: "0.8rem", borderRadius: "8px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", outline: "none", resize: "vertical"
              }}
              required
            />
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "0.8rem", borderRadius: "8px",
                background: "rgba(255,255,255,0.05)", border: "none",
                color: "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: "600"
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 2, padding: "0.8rem", borderRadius: "8px",
                background: "linear-gradient(135deg, #bb86fc, #9965f4)",
                color: "#fff", border: "none", cursor: "pointer", fontWeight: "700"
              }}
            >
              {submitting ? "Đang gửi..." : "Gửi Yêu Cầu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

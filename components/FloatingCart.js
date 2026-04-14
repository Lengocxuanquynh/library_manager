"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useCart } from "./CartProvider";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";

export default function FloatingCart() {
  const { cart, isDrawerOpen, setIsDrawerOpen, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleContinueShopping = () => {
    setIsDrawerOpen(false);
    
    // Nếu đang ở trang xem sách rồi thì chỉ cần đóng Giỏ hàng
    if (pathname === '/' || pathname === '/user/books' || pathname === '/admin/books') {
      return;
    }

    // Nếu đang ở trang khác, chuyển hướng về Danh mục sách phù hợp
    if (user?.role === 'admin') {
      router.push('/admin/books');
    } else if (user) {
      router.push('/user/books');
    } else {
      router.push('/');
    }
  };

  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [cccd, setCccd] = useState("");
  const [email, setEmail] = useState("");
  const [showValidationForm, setShowValidationForm] = useState(false);

  // Initialize email from auth user if available
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const handleCheckoutClick = () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để mượn sách");
      router.push("/login");
      setIsDrawerOpen(false);
      return;
    }
    
    // Check validation
    if (!phone.trim() || !cccd.trim() || !email.trim()) {
      setShowValidationForm(true);
      toast.info("Vui lòng cập nhật đù thông tin trước khi xác nhận");
      return;
    }
    
    submitBorrowRequest();
  };

  const submitBorrowRequest = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    const loadingToast = toast.loading("Đang gửi yêu cầu mượn sách...");

    try {
      const res = await fetch("/api/borrow-batch-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          userName: user.displayName || email || "Ẩn danh",
          email: email.trim(),
          phone: phone.trim(),
          cccd: cccd.trim(),
          books: cart.map(b => ({ bookId: b.id, bookTitle: b.title })),
          paymentStatus: "PENDING", // Will define logic
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Đã gửi yêu cầu mượn sách thành công!", { id: loadingToast });
        clearCart();
        setIsDrawerOpen(false);
        setShowValidationForm(false);
      } else {
        toast.error(data.error || "Có lỗi xảy ra", { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi kết nối server", { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  const isCartEmpty = cart.length === 0;

  return (
    <>
      {/* Floating Button */}
      <div 
        onClick={() => setIsDrawerOpen(true)}
        style={{
          position: "fixed",
          bottom: "2rem",
          right: "2rem",
          background: "linear-gradient(135deg, #bb86fc, #9965f4)",
          color: "#fff",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 10px 25px rgba(187, 134, 252, 0.4)",
          zIndex: 1000,
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)";
          e.currentTarget.style.boxShadow = "0 15px 35px rgba(187, 134, 252, 0.6)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 10px 25px rgba(187, 134, 252, 0.4)";
        }}
      >
        <svg fill="currentColor" viewBox="0 0 24 24" width="28" height="28">
          <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
        {cart.length > 0 && (
          <div style={{
            position: "absolute",
            top: "-5px",
            right: "-5px",
            background: "#ff5f56",
            color: "white",
            fontSize: "0.8rem",
            fontWeight: "bold",
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 5px rgba(0,0,0,0.3)"
          }}>
            {cart.length}
          </div>
        )}
      </div>

      {/* Backdrop */}
      {isDrawerOpen && (
        <div 
          onClick={() => setIsDrawerOpen(false)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1001,
          }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: "fixed",
        top: 0, right: isDrawerOpen ? 0 : "-450px", bottom: 0,
        width: "100%", maxWidth: "400px",
        background: "#181818",
        boxShadow: "-5px 0 25px rgba(0,0,0,0.5)",
        zIndex: 1002,
        transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid rgba(255,255,255,0.05)"
      }}>
        {/* Header */}
        <div style={{ padding: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#fff" }}>Giỏ Sách Mượn</h2>
          <button onClick={() => setIsDrawerOpen(false)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "1.5rem", cursor: "pointer" }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {isCartEmpty ? (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", marginTop: "3rem" }}>
              <svg style={{ opacity: 0.5, marginBottom: "1rem" }} fill="currentColor" viewBox="0 0 24 24" width="64" height="64">
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
              <p>Giỏ hàng đang trống.</p>
              <button 
                onClick={handleContinueShopping}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(187, 134, 252, 0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                style={{ marginTop: "1rem", background: "transparent", border: "1px solid #bb86fc", color: "#bb86fc", padding: "0.6rem 1.2rem", borderRadius: "8px", cursor: "pointer", transition: "background 0.2s" }}
              >
                Tiếp tục chọn sách
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {cart.map(book => (
                <div key={book.id} style={{ display: "flex", gap: "1rem", background: "rgba(255,255,255,0.03)", padding: "0.8rem", borderRadius: "10px" }}>
                  <div style={{ width: "60px", height: "85px", backgroundImage: `url(${book.coverImage || 'https://via.placeholder.com/100x150'})`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: "6px" }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 0.3rem 0", fontSize: "0.95rem", color: "#fff" }}>{book.title}</h4>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>{book.author}</p>
                  </div>
                  <button 
                    onClick={() => removeFromCart(book.id)}
                    style={{ background: "transparent", border: "none", color: "#ff5f56", cursor: "pointer", fontSize: "1.2rem", height: "fit-content" }}
                    title="Xóa khỏi giỏ"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {showValidationForm && !isCartEmpty && (
             <div style={{ marginTop: "2rem", background: "rgba(255,95,86,0.05)", border: "1px solid rgba(255,95,86,0.3)", padding: "1rem", borderRadius: "8px", animation: "fadeIn 0.3s" }}>
                <h4 style={{ margin: "0 0 1rem 0", color: "#ff5f56", fontSize: "0.9rem" }}>Vui lòng cập nhật thông tin:</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  <input type="text" placeholder="Số điện thoại (*)" value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: "0.8rem", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", outline: "none" }} />
                  <input type="text" placeholder="Số CCCD/CMND (*)" value={cccd} onChange={e => setCccd(e.target.value)} style={{ padding: "0.8rem", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", outline: "none" }} />
                  <input type="email" placeholder="Email (*)" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: "0.8rem", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", outline: "none" }} />
                </div>
             </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
          {cart.length > 3 && (
            <p style={{ color: "#ff5f56", fontSize: "0.85rem", margin: "0 0 1rem 0", textAlign: "center" }}>
              Bạn chỉ được mượn tối đa 3 cuốn sách
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <button 
              onClick={handleCheckoutClick}
              disabled={isCartEmpty || cart.length > 3 || submitting}
              style={{
                width: "100%", padding: "1rem", borderRadius: "10px", border: "none",
                background: (isCartEmpty || cart.length > 3 || submitting) ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #bb86fc, #9965f4)",
                color: (isCartEmpty || cart.length > 3 || submitting) ? "rgba(255,255,255,0.3)" : "#fff",
                fontWeight: "bold", cursor: (isCartEmpty || cart.length > 3 || submitting) ? "not-allowed" : "pointer",
                transition: "all 0.2s"
              }}
            >
              {submitting ? "Đang xử lý..." : "Xác Nhận Mượn"}
            </button>
            <button 
              onClick={handleContinueShopping}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              style={{
                width: "100%", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontWeight: "500",
                transition: "background 0.2s"
              }}
            >
              Tiếp tục chọn sách
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

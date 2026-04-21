"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthProvider";
import { useCart } from "./CartProvider";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import OTPModal from "./OTPModal";
import { sendMail } from "../services/emailService";
import { Reorder, AnimatePresence, motion } from "framer-motion";

export default function FloatingCart() {
  const { cart, setCart, isDrawerOpen, setIsDrawerOpen, removeFromCart, clearCart, remainingSlots, refreshQuota } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const bottomRef = useRef(null);

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
  const [email, setEmail] = useState("");
  
  // OTP States
  const [showOTP, setShowOTP] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [isSendingOTP, setIsSendingOTP] = useState(false);

  // Initialize email from auth user if available
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  // Auto-scroll to bottom when new item added
  useEffect(() => {
    if (isDrawerOpen && cart.length > 0) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [cart.length, isDrawerOpen]);

  // Refresh quota whenever drawer opens
  useEffect(() => {
    if (isDrawerOpen && user?.uid) {
      refreshQuota(user.uid);
    }
  }, [isDrawerOpen, user?.uid]);

  const handleCheckoutClick = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để mượn sách");
      router.push("/login");
      setIsDrawerOpen(false);
      return;
    }
    
    setIsSendingOTP(true);
    const isMock = typeof window !== "undefined" && localStorage.getItem("DEV_MOCK_EMAIL") === "true";

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: email, name: user.displayName || "Thành viên", isMock })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể gửi OTP");
      }

      if (result.devOtp) {
        toast.success(`[🛠 MOCK MODE] OTP xác nhận mượn sách: ${result.devOtp}`, { duration: 10000 });
      } else {
        toast.success("Mã OTP xác thực đã được gửi về email của bạn!");
      }
      setShowOTP(true);
    } catch (err) {
      console.error(err);
      toast.error("Không thể gửi OTP. Vui lòng thử lại sau.");
    } finally {
      setIsSendingOTP(false);
    }
  };

  const onVerifyOTP = async (inputOTP) => {
    const loadingToast = toast.loading("Đang xác thực mã...");
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, otp: inputOTP })
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Xác thực Chữ ký số thành công!", { id: loadingToast });
        setShowOTP(false);
        submitBorrowRequest();
      } else {
        toast.error(data.message || "Mã OTP không chính xác.", { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi kết nối máy chủ", { id: loadingToast });
    }
  };

  const submitBorrowRequest = async () => {
    const separatorIndex = cart.findIndex(item => item.isSeparator);
    const borrowTarget = cart.slice(0, separatorIndex !== -1 ? separatorIndex : 0);
    
    if (borrowTarget.length === 0) {
      toast.error("Vùng mượn đang trống. Hãy kéo sách lên trên vạch ranh giới.");
      return;
    }

    setSubmitting(true);
    const loadingToast = toast.loading("Đang gửi yêu cầu mượn sách...");

    try {
      const isMock = typeof window !== "undefined" && localStorage.getItem("DEV_MOCK_EMAIL") === "true";
      
      const res = await fetch("/api/borrow-batch-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          userName: user.displayName || email || "Ẩn danh",
          email: email.trim(),
          phone: user.phone || "Chưa có SĐT", 
          books: borrowTarget.map(b => ({ bookId: b.id, bookTitle: b.title })),
          paymentStatus: "PENDING", 
          isAdmin: user.role === 'admin',
          isMock: isMock
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Đã mượn thành công ${borrowTarget.length} cuốn!`, { id: loadingToast });
        // Xóa những cuốn đã mượn và giữ nguyên phần còn lại (bao gồm separator và hàng đợi)
        const newCart = cart.filter(item => !borrowTarget.some(bt => bt.cartItemId === item.cartItemId));
        setCart(newCart);
        refreshQuota(user.uid); 
        setIsDrawerOpen(false);
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

  // Quota Enforcement: Đảm bảo vạch separator không bao giờ vượt quá remainingSlots
  useEffect(() => {
    if (cart.length > 0) {
      const sepIndex = cart.findIndex(i => i.isSeparator);
      if (sepIndex > remainingSlots) {
        const newCart = [...cart];
        const [sepItem] = newCart.splice(sepIndex, 1);
        // Đẩy vạch lên vị trí bằng đúng số suất còn lại
        newCart.splice(remainingSlots, 0, sepItem);
        setCart(newCart);
      }
    }
  }, [remainingSlots, cart.length, isDrawerOpen]);

  const handleReorder = (newCart) => {
    const newSepIndex = newCart.findIndex(item => item.isSeparator);
    // Nếu kéo sách từ dưới lên làm vạch nhảy xuống vượt quá remainingSlots -> Chặn
    if (newSepIndex > remainingSlots) {
       toast.error(`Bạn chỉ còn ${remainingSlots} suất mượn trống.`);
       return;
    }
    setCart(newCart);
  };

  const isCartEmpty = cart.length === 0;

  if (showOTP) {
    return (
      <OTPModal
        email={email}
        isSending={isSendingOTP}
        onVerify={onVerifyOTP}
        onCancel={() => setShowOTP(false)}
        resendOTP={() => handleCheckoutClick()} // Mượn hàm để gửi lại
      />
    );
  }

  // Không hiển thị giỏ hàng nếu là Admin, ở trang quản trị, hoặc các trang đăng nhập/đăng ký
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register');
  if (user?.role === 'admin' || pathname?.startsWith('/admin') || isAuthPage) {
    return null;
  }

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
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ padding: '0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: '800', 
                  border: remainingSlots > 0 ? '1px solid #bb86fc' : '1px solid rgba(255,255,255,0.2)', 
                  color: remainingSlots > 0 ? '#bb86fc' : 'rgba(255,255,255,0.5)', 
                  padding: '2px 10px', 
                  borderRadius: '4px', 
                  textTransform: 'uppercase',
                  background: remainingSlots > 0 ? 'rgba(187,134,252,0.1)' : 'transparent'
                }}>
                  {remainingSlots > 0 ? `Vùng Mượn Sách (CÒN ${remainingSlots} SUẤT)` : `PHIẾU ĐÃ ĐẦY (CÓ 3 CUỐN)`}
                </span>
                <div style={{ flex: 1, height: '1px', background: remainingSlots > 0 ? 'rgba(187,134,252,0.2)' : 'rgba(255,255,255,0.1)' }} />
              </div>
              
              <Reorder.Group axis="y" values={cart} onReorder={handleReorder} style={{ display: "flex", flexDirection: "column", gap: "0.8rem", padding: 0, listStyle: 'none' }}>
                <AnimatePresence mode="popLayout">
                  {cart.map((item, index) => {
                    const sepIndex = cart.findIndex(i => i.isSeparator);
                    const isPriority = index < sepIndex;
                    
                    if (item.isSeparator) {
                      return (
                        <Reorder.Item 
                          key="cart-separator" 
                          value={item}
                          drag={false} // Không cho phép cầm vạch kéo, chỉ cho phép kéo sách qua vạch
                          style={{ 
                            padding: '0.4rem 0', 
                            marginTop: '0.5rem', 
                            marginBottom: '0.8rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.6rem',
                            cursor: 'default'
                          }}
                        >
                          <span style={{ fontSize: '0.65rem', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Hàng đợi mượn đợt sau
                          </span>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                        </Reorder.Item>
                      );
                    }

                    return (
                      <Reorder.Item 
                        key={item.cartItemId}
                        value={item}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9, x: -20 }}
                        whileDrag={{ scale: 1.05, boxShadow: "0 20px 40px rgba(0,0,0,0.5)", zIndex: 100 }}
                        style={{ 
                          display: "flex", 
                          gap: "1rem", 
                          background: isPriority ? "rgba(187,134,252,0.06)" : "rgba(255,255,255,0.02)", 
                          padding: "0.8rem", 
                          borderRadius: "12px",
                          border: `1px solid ${isPriority ? 'rgba(187,134,252,0.2)' : 'rgba(255,255,255,0.05)'}`,
                          position: 'relative',
                          cursor: 'grab',
                          marginBottom: '0.8rem'
                        }}
                      >
                        {/* Priority Badge */}
                        <div style={{ 
                          width: '24px', height: '24px', borderRadius: '50%', 
                          background: isPriority ? '#bb86fc' : 'rgba(255,255,255,0.1)',
                          color: isPriority ? '#000' : 'rgba(255,255,255,0.5)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: '800', flexShrink: 0
                        }}>
                          {isPriority ? (index + 1) : '-'}
                        </div>

                        <div style={{ width: "50px", height: "70px", backgroundImage: `url(${item.coverImage || 'https://via.placeholder.com/100x150'})`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: "6px", flexShrink: 0 }} />
                        
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <h4 style={{ margin: "0 0 0.2rem 0", fontSize: "0.9rem", color: "#fff", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                          <p style={{ margin: 0, fontSize: "0.75rem", color: isPriority ? "rgba(187,134,252,0.6)" : "rgba(255,255,255,0.3)" }}>{item.author}</p>
                        </div>

                        <button 
                          onClick={(e) => { e.stopPropagation(); removeFromCart(item.cartItemId); }}
                          style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "1rem", padding: '4px' }}
                        >
                          ✕
                        </button>
                      </Reorder.Item>
                    );
                  })}
                  <div ref={bottomRef} style={{ height: '10px' }} />
                </AnimatePresence>
              </Reorder.Group>
            </div>
          )}
          
        </div>

        {/* Footer */}
        <div style={{ padding: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <button 
              onClick={handleCheckoutClick}
              disabled={isCartEmpty || submitting || (cart.findIndex(i => i.isSeparator) === 0)}
              style={{
                width: "100%", padding: "1rem", borderRadius: "10px", border: "none",
                background: (isCartEmpty || submitting || (cart.findIndex(i => i.isSeparator) === 0)) ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #bb86fc, #9965f4)",
                color: (isCartEmpty || submitting || (cart.findIndex(i => i.isSeparator) === 0)) ? "rgba(255,255,255,0.3)" : "#fff",
                fontWeight: "bold", cursor: (isCartEmpty || submitting || (cart.findIndex(i => i.isSeparator) === 0)) ? "not-allowed" : "pointer",
                transition: "all 0.2s"
              }}
            >
              {submitting ? "Đang xử lý..." : (remainingSlots > 0 ? "Xác Nhận Mượn" : "Đã Hết Suất Mượn")}
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

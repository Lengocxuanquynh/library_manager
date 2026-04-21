"use client";

import { useState, useEffect } from "react";
import { loginUser, loginWithGoogle, logoutUser } from "@/services/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";
import OTPModal from "@/components/OTPModal";
import PremiumPasswordInput from "@/components/PremiumPasswordInput";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { sendMail } from "@/services/emailService";
import { auth } from "@/lib/firebase";

export default function Login() {
  const [identifier, setIdentifier] = useState(""); // Can be email or username
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, role } = useAuth();

  // Real-time validation
  useEffect(() => {
    // Identifier check only, password validation handled inside PremiumPasswordInput
    if (identifier && identifier.length < 3) {
      // Small notice if needed
    } else {
      setError("");
    }
  }, [identifier]);

  // OTP States
  const [showOTP, setShowOTP] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [pendingUserRole, setPendingUserRole] = useState(null);

  // Removed aggressive auto logout on component mount to prevent race conditions
  useEffect(() => {
    // Luôn dọn dẹp biến nhớ OTP cũ mỗi khi màn hình đăng nhập được load lại
    if (typeof window !== "undefined") {
      localStorage.removeItem("otp_verified");
    }
  }, []);

  const sendOTP = async (targetUid, targetEmail) => {
    setIsSendingOTP(true);
    setError("");
    const isMock = typeof window !== "undefined" && localStorage.getItem("DEV_MOCK_EMAIL") === "true";

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: targetUid, email: targetEmail, name: "Thành viên", isMock })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể gửi OTP");
      }

      if (result.devOtp) {
        toast.success(`[🛠 MOCK MODE] OTP: ${result.devOtp}`, { duration: 10000 });
      } else {
        toast.success("Mã OTP đã được gửi đến email của bạn.");
      }
      
      setShowOTP(true);
    } catch (err) {
      console.error("OTP Send Error:", err);
      setError(`Lỗi: ${err.message}. Vui lòng thử lại sau.`);
      logoutUser();
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Final check before submission
    if (!identifier || identifier.length < 3) {
      setError("Vui lòng nhập Tên đăng nhập hoặc Email hợp lệ.");
      return;
    }
    if (password.length < 8) {
      setError("Vui lòng đảm bảo mật khẩu đúng định dạng.");
      return;
    }

    setError("");
    try {
      const { role, user: loggedInUser } = await loginUser(identifier, password);
      
      const userEmail = loggedInUser.email;

      // Yêu cầu đặc biệt: Bypass OTP cho tài khoản admin@library.vn
      if (userEmail === "admin@library.vn" || role === "admin") {
        router.push("/admin");
        return;
      }
      
      // Wait for OTP before routing for normal users
      setPendingUserRole(role);
      await sendOTP(loggedInUser.uid, userEmail);
    } catch (err) {
      setError(err.message || "Thông tin đăng nhập không hợp lệ. Vui lòng thử lại.");
    }
  };

  const onVerifyOTP = async (inputOTP) => {
    // Use the user from useAuth or check auth.currentUser
    const currentUid = user?.uid || auth.currentUser?.uid;
    if (!currentUid) return;

    setIsSendingOTP(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUid, otp: inputOTP })
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem("otp_verified", "true");
        toast.success("Xác thực thành công!");
        router.push(pendingUserRole === "admin" ? "/admin" : "/user");
      } else {
        toast.error(data.message || "Xác thực thất bại.");
        if (data.shouldLogout) {
          setTimeout(() => onCancelOTP(), 2000);
        }
      }
    } catch (err) {
      toast.error("Lỗi kết nối server.");
    } finally {
      setIsSendingOTP(false);
    }
  };

  const onCancelOTP = () => {
    logoutUser();
    setShowOTP(false);
  };

  const handleGoogleLogin = async () => {
    setError("");
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
      // AuthProvider handles redirect
    } catch (err) {
      if (err.code === "auth/cancelled-popup-request" || err.code === "auth/popup-closed-by-user") {
        console.log("Google login popup closed by user");
        return;
      }
      console.error(err);
      setError("Có lỗi khi đăng nhập bằng Google. Vui lòng thử lại.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (showOTP) {
    return (
      <OTPModal
        email={identifier.includes('@') ? identifier : "tài khoản của bạn"}
        isSending={isSendingOTP}
        onVerify={onVerifyOTP}
        onCancel={onCancelOTP}
        resendOTP={() => sendOTP(auth.currentUser?.uid, auth.currentUser?.email)}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Đăng Nhập</h1>
        
        {error && (
          <div style={{
            background: 'rgba(255, 95, 86, 0.2)',
            border: '1px solid #ff5f56',
            color: '#ff5f56',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            textAlign: 'center',
            fontWeight: '500'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className={styles.form}>
          <input
            type="text"
            placeholder="Tên đăng nhập hoặc Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className={styles.input}
          />
          <PremiumPasswordInput
            placeholder="Nhập mật khẩu truy cập"
            value={password}
            onChange={setPassword}
            required
            showStrength={false}
            showChecklist={false} 
          />

          <div style={{ textAlign: 'right', marginTop: '-10px' }}>
            <Link href="/forgot-password" style={{ 
              fontSize: '0.85rem', 
              color: 'var(--primary, #bb86fc)',
              fontWeight: '500',
              textDecoration: 'none'
            }}>
              Quên mật khẩu?
            </Link>
          </div>
          <button type="submit" className={styles.button} disabled={isSendingOTP || !!error}>
            {isSendingOTP ? "Đang gửi thông tin..." : "Đăng Nhập"}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0", color: "rgba(255,255,255,0.2)" }}>
          <div style={{ flex: 1, height: "1px", background: "currentColor" }}></div>
          <span style={{ margin: "0 1rem", fontSize: "0.9rem" }}>HOẶC</span>
          <div style={{ flex: 1, height: "1px", background: "currentColor" }}></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading || isSendingOTP}
          className={styles.button}
          style={{
            background: "white",
            color: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.8rem",
            fontWeight: "600",
            opacity: (isGoogleLoading || isSendingOTP) ? 0.7 : 1,
            cursor: (isGoogleLoading || isSendingOTP) ? 'not-allowed' : 'pointer'
          }}
        >
          {isGoogleLoading ? (
            "Đang kết nối Google..."
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: "18px" }} />
              Tiếp tục với Google
            </>
          )}
        </button>
        <p className={styles.footerText}>
          Bạn chưa có tài khoản? <Link href="/register">Đăng ký</Link>
        </p>
      </div>
    </div>
  );
}

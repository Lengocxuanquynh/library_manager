"use client";

import { useState, useEffect } from "react";
import { loginUser, loginWithGoogle, logoutUser } from "../../../services/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";
import OTPModal from "../../../components/OTPModal";
import { useAuth } from "../../../components/AuthProvider";
import { toast } from "sonner";
import { sendMail } from "../../../services/emailService"; // Assuming sonner is used as checked earlier in package.json

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, role } = useAuth();

  // OTP States
  const [showOTP, setShowOTP] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [pendingUserRole, setPendingUserRole] = useState(null);

  // Removed aggressive auto logout on component mount to prevent race conditions
  useEffect(() => {
    // Luôn dọn dẹp biến nhớ OTP cũ mỗi khi màn hình đăng nhập được load lại
    if (typeof window !== "undefined") {
      localStorage.removeItem("otp_verified");
    }
  }, []);

  const sendOTP = async (targetEmail) => {
    setIsSendingOTP(true);
    setError("");
    const newOTP = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(newOTP);

    try {
      const result = await sendMail(targetEmail, "Thư Viện FPT", newOTP);
      
      if (result.mock) {
        toast.success(`[DEV MODE] OTP mô phỏng: ${result.otp}`, { duration: 10000 });
      } else {
        toast.success("Đã gửi mã OTP đến email của bạn.");
      }
      
      setShowOTP(true);
    } catch (err) {
      console.error("Full EmailJS Error:", err);
      setError(`Không thể gửi email OTP (Chi tiết: ${err.text || err.message}). Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.`);
      // Logout completely if OTP fails to send, so they can try again properly
      logoutUser();
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { role } = await loginUser(email, password);
      
      // Yêu cầu đặc biệt: Bypass OTP cho tài khoản admin@library.vn
      if (email === "admin@library.vn" || role === "admin") {
        router.push("/admin");
        return;
      }
      
      // Wait for OTP before routing for normal users
      setPendingUserRole(role);
      await sendOTP(email);
    } catch (err) {
      setError("Thông tin đăng nhập không hợp lệ. Vui lòng thử lại.");
    }
  };

  const onVerifyOTP = (inputOTP) => {
    if (inputOTP === generatedOTP) {
      localStorage.setItem("otp_verified", "true");
      router.push(pendingUserRole === "admin" ? "/admin" : "/user");
    } else {
      toast.error("Mã OTP không chính xác.");
    }
  };

  const onCancelOTP = () => {
    logoutUser();
    setShowOTP(false);
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const { role } = await loginWithGoogle();
      // Google Login bypasses OTP
      if (role === "admin") {
        // Let AuthProvider redirect automatically
      } else {
        // Let AuthProvider redirect automatically
      }
    } catch (err) {
      if (err.code === "auth/cancelled-popup-request" || err.code === "auth/popup-closed-by-user") {
        console.log("Google login popup closed by user");
        return;
      }
      console.error(err);
      setError("Có lỗi khi đăng nhập bằng Google. Vui lòng thử lại.");
    }
  };

  if (showOTP) {
    return (
      <OTPModal
        email={email}
        isSending={isSendingOTP}
        onVerify={onVerifyOTP}
        onCancel={onCancelOTP}
        resendOTP={() => sendOTP(email)}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Đăng Nhập</h1>
        {error && <p className={styles.error}>{error}</p>}
        <form onSubmit={handleLogin} className={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.input}
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.input}
          />
          <button type="submit" className={styles.button} disabled={isSendingOTP}>
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
          className={styles.button}
          style={{
            background: "white",
            color: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.8rem",
            fontWeight: "600",
          }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: "18px" }} />
          Tiếp tục với Google
        </button>
        <p className={styles.footerText}>
          Bạn chưa có tài khoản? <Link href="/register">Đăng ký</Link>
        </p>
      </div>
    </div>
  );
}

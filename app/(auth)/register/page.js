"use client";

import { useState, useEffect } from "react";
import { registerUser, loginWithGoogle, logoutUser } from "../../../services/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";
import OTPModal from "../../../components/OTPModal";
import { useAuth } from "../../../components/AuthProvider";
import { toast } from "sonner";
import { sendMail } from "../../../services/emailService";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, role } = useAuth();

  // Real-time validation
  useEffect(() => {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Định dạng Email không hợp lệ (ví dụ: name@gmail.com)");
    } else if (phone && !/^\d+$/.test(phone)) {
      setError("Số điện thoại chỉ được chứa các chữ số");
    } else if (phone && phone.length !== 10) {
      setError("Số điện thoại phải có đúng 10 chữ số");
    } else if (password && password.length < 8) {
      setError("Mật khẩu phải chứa ít nhất 8 ký tự");
    } else {
      setError("");
    }
  }, [email, phone, password]);

  // OTP States
  const [showOTP, setShowOTP] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [pendingUserRole, setPendingUserRole] = useState(null);

  // Removed aggressive auto logout on component mount to prevent race conditions

  const sendOTP = async (targetEmail, targetName) => {
    setIsSendingOTP(true);
    setError("");
    const newOTP = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(newOTP);

    try {
      const result = await sendMail(targetEmail, targetName || "Thành viên Thư Viện", newOTP);
      
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

  const handleRegister = async (e) => {
    e.preventDefault();

    // Final check before submission
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Vui lòng nhập Email đúng định dạng trước khi tiếp tục.");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu phải dài ít nhất 8 ký tự để đảm bảo an toàn.");
      return;
    }

    setError("");
    try {
      // By default new signups are 'user' role
      const { role } = await registerUser(email, password, name, "user", phone);
      
      // Yêu cầu đặc biệt: Bypass OTP cho tài khoản admin@library.vn
      if (email === "admin@library.vn" || role === "admin") {
        router.push("/admin");
        return;
      }
      
      // Wait for OTP before routing for normal users
      setPendingUserRole(role);
      await sendOTP(email, name);
    } catch (err) {
      if (err.code === "auth/email-already-in-use" || (err.message && err.message.includes("email-already-in-use"))) {
        setError("Email này đã tồn tại. Vui lòng chuyển sang trang Đăng nhập.");
      } else {
        setError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
      }
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
      if (role === "admin") {
        // Let AuthProvider handle redirect
      } else {
        // Let AuthProvider handle redirect
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
        resendOTP={() => sendOTP(email, name)}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Đăng Ký</h1>
        
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

        <form onSubmit={handleRegister} className={styles.form}>
          <input
            type="text"
            placeholder="Họ và Tên"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={styles.input}
          />
          <input
            type="email"
            placeholder="Email (ví dụ: user@gmail.com)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.input}
          />
          <input
            type="tel"
            placeholder="Số điện thoại (10 chữ số)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className={styles.input}
          />
          <input
            type="password"
            placeholder="Mật khẩu (tối thiểu 8 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.input}
          />
          <button type="submit" className={styles.button} disabled={isSendingOTP || !!error}>
            {isSendingOTP ? "Đang gửi thông tin..." : "Đăng Ký"}
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
          Bạn đã có tài khoản? <Link href="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}

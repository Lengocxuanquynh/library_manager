"use client";

import { useState, useEffect } from "react";
import { registerUser, loginWithGoogle, logoutUser } from "@/services/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";
import OTPModal from "@/components/OTPModal";
import PremiumPasswordInput from "@/components/PremiumPasswordInput";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { sendMail } from "@/services/emailService";

export default function Register() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, role } = useAuth();

  // Real-time validation
  useEffect(() => {
    const nameHasNumbers = /\d/.test(name);
    const usernameRegex = /^[a-z][a-z0-9_]*$/;

    // Password Strength Check (Nới lỏng: Trung bình là OK)
    const score = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password)
    ].filter(Boolean).length;
    
    const isPassable = score >= 3; // Chỉ cần đạt mức Trung bình (3/5)

    if (nameHasNumbers) {
      setError("Họ và Tên không được chứa số");
    } else if (username && !usernameRegex.test(username.toLowerCase())) {
      setError("Tên đăng nhập phải bắt đầu bằng chữ, không có dấu, không có khoảng cách");
    } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Định dạng Email không hợp lệ");
    } else if (phone && !/^0\d{9}$/.test(phone)) {
      setError("Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)");
    } else if (password && !isPassable) {
      setError("Mật khẩu còn yếu. Hãy thêm ít nhất 8 ký tự và phối hợp Hoa/Thường/Số/Đặc biệt.");
    } else {
      setError("");
    }
  }, [name, username, email, phone, password]);

  // OTP States
  const [showOTP, setShowOTP] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState(null); // Stores { uid, email, role }

  // Removed aggressive auto logout on component mount to prevent race conditions

  const sendOTP = async (targetUid, targetEmail, targetName) => {
    setIsSendingOTP(true);
    setError("");
    const isMock = typeof window !== "undefined" && localStorage.getItem("DEV_MOCK_EMAIL") === "true";

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: targetUid, email: targetEmail, name: targetName, isMock })
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
      // Nếu lỗi gửi mail, đăng xuất để sạch session
      logoutUser();
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    // Final check before submission
    if (/\d/.test(name)) {
      setError("Họ và Tên không được chứa số.");
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(username.toLowerCase())) {
      setError("Tên đăng nhập không đúng định dạng.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Vui lòng nhập Email đúng định dạng trước khi tiếp tục.");
      return;
    }
    if (!/^0\d{9}$/.test(phone)) {
      setError("Số điện thoại phải bắt đầu bằng số 0 và đủ 10 chữ số.");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu phải dài ít nhất 8 ký tự để đảm bảo an toàn.");
      return;
    }

    setError("");
    try {
      const { user: registeredUser, role } = await registerUser(email, password, name, "user", phone, username);

      if (email === "admin@library.vn" || role === "admin") {
        router.push("/admin");
        return;
      }

      setPendingUser({ uid: registeredUser.uid, email, role });
      await sendOTP(registeredUser.uid, email, name);
    } catch (err) {
      if (err.code === "auth/email-already-in-use" || (err.message && err.message.includes("email-already-in-use"))) {
        setError("Email này đã tồn tại. Vui lòng chuyển sang trang Đăng nhập.");
      } else {
        setError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
      }
    }
  };

  const onVerifyOTP = async (inputOTP) => {
    if (!pendingUser?.uid) return;
    
    setIsSendingOTP(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: pendingUser.uid, otp: inputOTP })
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem("otp_verified", "true");
        toast.success("Xác thực thành công!");
        router.push(pendingUser.role === "admin" ? "/admin" : "/user");
      } else {
        toast.error(data.message || "Xác thực thất bại.");
        if (data.shouldLogout) {
          // Bị hacker phá hoặc nhập sai quá 3 lần -> Out ngay
          setTimeout(() => {
            onCancelOTP();
          }, 2000);
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
    setPendingUser(null);
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
        email={email}
        isSending={isSendingOTP}
        onVerify={onVerifyOTP}
        onCancel={onCancelOTP}
        resendOTP={() => sendOTP(pendingUser?.uid, email, name)}
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
            placeholder="Họ và Tên (Dùng để hiển thị)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={styles.input}
          />
          <input
            type="text"
            placeholder="Tên đăng nhập (viết liền, không dấu)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
          <PremiumPasswordInput
            label="Mật khẩu cực mạnh"
            placeholder="Tối thiểu 8 ký tự (Hoa, Thường, Số, Đặc biệt)"
            value={password}
            onChange={setPassword}
            required
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
          Bạn đã có tài khoản? <Link href="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}

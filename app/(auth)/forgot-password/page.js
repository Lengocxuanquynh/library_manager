"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";
import OTPModal from "@/components/OTPModal";
import PremiumPasswordInput from "@/components/PremiumPasswordInput";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState(""); // Email or Username
  const [step, setStep] = useState(1); // 1: Enter ID, 2: Reset Form
  const [showOTP, setShowOTP] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  
  // Reset Form States
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingUser, setPendingUser] = useState(null); // { uid, email }

  const router = useRouter();

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    if (!identifier) {
      setError("Vui lòng nhập Email hoặc Tên đăng nhập.");
      return;
    }

    setIsSending(true);
    setError("");

    try {
      // 1. Tìm UID và Email từ Identifier
      let email = identifier;
      let uid = "";
      let name = "Thành viên";

      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
      if (!isEmail) {
        const q = query(collection(db, "users"), where("username", "==", identifier.toLowerCase()));
        const snap = await getDocs(q);
        if (snap.empty) {
          throw new Error("Tên đăng nhập không tồn tại trong hệ thống.");
        }
        const data = snap.docs[0].data();
        email = data.email;
        uid = snap.docs[0].id;
        name = data.name;
      } else {
        const q = query(collection(db, "users"), where("email", "==", identifier.toLowerCase()));
        const snap = await getDocs(q);
        if (snap.empty) {
          throw new Error("Email này chưa được đăng ký tài khoản.");
        }
        uid = snap.docs[0].id;
        name = snap.docs[0].data().name;
      }

      setPendingUser({ uid, email, name });

      // 2. Gửi OTP
      const isMock = typeof window !== "undefined" && localStorage.getItem("DEV_MOCK_EMAIL") === "true";
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, email, name, isMock })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể gửi OTP.");

      if (result.devOtp) {
        toast.success(`[🛠 MOCK MODE] OTP: ${result.devOtp}`, { duration: 10000 });
      } else {
        toast.success("Mã xác thực đã được gửi đến email của bạn.");
      }
      
      setShowOTP(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const onVerifyOTP = async (inputOTP) => {
    setIsSending(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: pendingUser.uid, otp: inputOTP })
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Xác thực danh tính thành công!");
        setShowOTP(false);
        setStep(2); // Sang bước đặt lại mật khẩu
      } else {
        toast.error(data.message || "Mã OTP không chính xác.");
      }
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ.");
    } finally {
      setIsSending(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    const score = [
      newPassword.length >= 8,
      /[A-Z]/.test(newPassword),
      /[a-z]/.test(newPassword),
      /[0-9]/.test(newPassword),
      /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    ].filter(Boolean).length;

    if (score < 3) {
      setError("Mật khẩu còn yếu. Vui lòng tăng cường độ bảo mật (đạt mức Trung bình).");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: pendingUser.uid, newPassword })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Mật khẩu đã được thay đổi thành công!");
        router.push("/login"); // Về trang đăng nhập
      } else {
        throw new Error(data.error || "Không thể đặt lại mật khẩu.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  if (showOTP) {
    return (
      <OTPModal
        email={pendingUser?.email}
        isSending={isSending}
        onVerify={onVerifyOTP}
        onCancel={() => setShowOTP(false)}
        resendOTP={() => handleSendOTP()}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <Link href="/login" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "5px" }}>
             ← Quay lại Đăng nhập
          </Link>
        </div>

        <h1 className={styles.title}>{step === 1 ? "Quên mật khẩu" : "Đặt lại mật khẩu"}</h1>
        
        {step === 1 ? (
          <>
            <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: "2rem", fontSize: "0.95rem" }}>
              Nhập tên đăng nhập hoặc email. Chúng tôi sẽ gửi mã OTP để xác nhận bạn là chủ sở hữu tài khoản.
            </p>

            <form onSubmit={handleSendOTP} className={styles.form}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>Định danh tài khoản</label>
                <input
                  type="text"
                  placeholder="Username hoặc Email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className={styles.input}
                  disabled={isSending}
                />
              </div>

              {error && <p style={{ color: "#ff5252", fontSize: "0.85rem", textAlign: "center", margin: "0" }}>{error}</p>}

              <button type="submit" className={styles.button} disabled={isSending}>
                {isSending ? "Đang xử lý..." : "Tiếp tục"}
              </button>
            </form>
          </>
        ) : (
          <>
             <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: "2rem", fontSize: "0.95rem" }}>
              Danh tính đã được xác thực bậc cao. Vui lòng thiết lập mật khẩu mới cực kỳ bảo mật.
            </p>

            <form onSubmit={handleResetPassword} className={styles.form}>
              <PremiumPasswordInput
                label="Mật khẩu mới cực mạnh"
                placeholder="Ví dụ: Abc@123456"
                value={newPassword}
                onChange={setNewPassword}
                required
              />

              <PremiumPasswordInput
                label="Xác nhận lại mật khẩu"
                placeholder="Nhập lại mật khẩu giống hệt trên"
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                showStrength={false}
                showChecklist={false}
                error={confirmPassword && newPassword !== confirmPassword ? "Mật khẩu xác nhận không khớp" : ""}
              />

              <div style={{ marginTop: '10px' }}>
                <button 
                  type="submit" 
                  className={styles.button} 
                  disabled={isSending || newPassword !== confirmPassword || newPassword.length < 8}
                >
                  {isSending ? "Đang lưu mật khẩu..." : "Hoàn tất & Đăng nhập"}
                </button>
              </div>
              
              {error && <p style={{ color: "#ff5252", fontSize: "0.85rem", textAlign: "center", margin: "0" }}>{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}

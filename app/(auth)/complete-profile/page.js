"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { updateUserProfile, checkUsernameUnique, updateUserPassword } from "@/services/auth";
import { toast } from "sonner";
import PremiumPasswordInput from "@/components/PremiumPasswordInput";

export default function CompleteProfile() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      if (user.displayName) setName(user.displayName);
      if (user.username) setUsername(user.username);
      if (user.phone) setPhone(user.phone);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    const cleanUsername = username.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!name.trim()) { setError("Vui lòng nhập Họ và Tên"); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) { setError("Tên đăng nhập từ 3-20 ký tự (chữ thường, số)"); return; }
    if (!/^\d{10}$/.test(cleanPhone)) { setError("Số điện thoại phải có đúng 10 chữ số"); return; }
    const pScore = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password)
    ].filter(Boolean).length;

    if (pScore < 3) {
      setError("Mật khẩu còn yếu. Hãy đảm bảo đạt mức Trung bình (kết hợp Hoa/Thường/Số/Đặc biệt).");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không trùng khớp");
      return;
    }

    setLoading(true);
    try {
      const isUnique = await checkUsernameUnique(cleanUsername, user.uid);
      if (!isUnique) {
        setError("Tên đăng nhập này đã có người sử dụng");
        setLoading(false);
        return;
      }

      // 1. Cập nhật mật khẩu trước (Firebase Auth)
      await updateUserPassword(password);

      // 2. Cập nhật Firestore profile
      await updateUserProfile(user.uid, {
        name: name.trim(),
        username: cleanUsername,
        phone: cleanPhone
      });

      toast.success("Hồ sơ và Mật khẩu đã được thiết lập! Chào mừng bạn.");
      router.push("/user");
    } catch (err) {
      console.error(err);
      setError(err.message || "Lỗi cập nhật hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div style={styles.container}>Đang tải...</div>;
  if (!user) return null;

  return (
    <div style={styles.container}>
      {/* Animated Background Orbs */}
      <div style={styles.bgOrb1}></div>
      <div style={styles.bgOrb2}></div>
      <div style={styles.bgOrb3}></div>

      <div style={styles.glassCard}>
        <div style={styles.headerArea}>
          <div style={styles.iconBox}>🛡️</div>
          <h1 style={styles.title}>Bảo Mật Tài Khoản</h1>
          <p style={styles.subtitle}>
            Thiết lập định danh và mật khẩu để hoàn tất gia nhập thư viện.
          </p>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <span style={{marginRight: '8px'}}>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.scrollArea}>
            <div style={styles.inputWrapper}>
              <label style={styles.label}>Họ và Tên thật</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập họ tên đầy đủ..."
                style={styles.input}
                required
              />
            </div>

            <div style={styles.inputWrapper}>
              <label style={styles.label}>Tên đăng nhập (Username)</label>
              <div style={styles.usernameInputContainer}>
                <span style={styles.atSymbol}>@</span>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="ví dụ: user_123"
                  style={styles.inputUsername}
                  required
                />
              </div>
            </div>

            <div style={styles.inputWrapper}>
              <label style={styles.label}>Số điện thoại</label>
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nhập 10 chữ số..."
                style={styles.input}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <PremiumPasswordInput
                label="Mật khẩu mới"
                placeholder="Password cực mạnh"
                value={password}
                onChange={setPassword}
                required
              />

              <PremiumPasswordInput
                label="Xác nhận mật khẩu"
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                showStrength={false}
                showChecklist={false}
                error={confirmPassword && password !== confirmPassword ? "Mật khẩu xác nhận không khớp" : ""}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              transform: loading ? 'scale(0.98)' : 'scale(1)'
            }}
          >
            {loading ? "Đang xử lý..." : "Kích Hoạt Tài Khoản ▸"}
          </button>
        </form>
      </div>

      <style jsx global>{`
        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -40px) scale(1.1); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes floatReverse {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 30px) scale(1.05); }
          100% { transform: translate(0, 0) scale(1); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0c',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  bgOrb1: {
    position: 'absolute',
    top: '10%',
    left: '15%',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(187, 134, 252, 0.15) 0%, transparent 70%)',
    filter: 'blur(50px)',
    animation: 'float 12s infinite ease-in-out',
    zIndex: 1,
  },
  bgOrb2: {
    position: 'absolute',
    bottom: '10%',
    right: '15%',
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(3, 218, 198, 0.1) 0%, transparent 70%)',
    filter: 'blur(60px)',
    animation: 'floatReverse 15s infinite ease-in-out',
    zIndex: 1,
  },
  bgOrb3: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(207, 102, 121, 0.08) 0%, transparent 70%)',
    filter: 'blur(40px)',
    zIndex: 1,
  },
  glassCard: {
    position: 'relative',
    width: '100%',
    maxWidth: '520px',
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '28px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    padding: '40px',
    zIndex: 10,
  },
  headerArea: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  iconBox: {
    fontSize: '2.5rem',
    marginBottom: '15px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#fff',
    marginBottom: '10px',
    letterSpacing: '-0.5px',
    background: 'linear-gradient(to right, #fff, #bb86fc)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1rem',
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: '1.5',
  },
  errorAlert: {
    background: 'rgba(207, 102, 121, 0.15)',
    color: '#ff8a80',
    padding: '14px 18px',
    borderRadius: '14px',
    fontSize: '0.9rem',
    marginBottom: '25px',
    border: '1px solid rgba(207, 102, 121, 0.2)',
    display: 'flex',
    alignItems: 'center',
  },
  scrollArea: {
    display: 'grid',
    gap: '20px',
    maxHeight: '400px',
    overflowY: 'auto',
    paddingRight: '10px',
    paddingBottom: '10px'
  },
  form: {
    display: 'grid',
    gap: '24px',
  },
  inputWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: '4px',
  },
  input: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '14px',
    padding: '15px 18px',
    color: '#fff',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
    outline: 'none',
  },
  usernameInputContainer: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '14px',
    overflow: 'hidden',
  },
  atSymbol: {
    paddingLeft: '18px',
    color: '#bb86fc',
    fontWeight: '800',
    fontSize: '1.1rem',
  },
  inputUsername: {
    background: 'transparent',
    border: 'none',
    padding: '15px 10px',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    width: '100%',
  },
  hint: {
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.3)',
    marginLeft: '4px',
  },
  submitBtn: {
    marginTop: '10px',
    background: 'linear-gradient(135deg, #bb86fc 0%, #6200ee 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    padding: '18px',
    fontSize: '1.1rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 10px 20px -5px rgba(187, 134, 252, 0.4)',
  }
};

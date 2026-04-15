"use client";

import { useState } from "react";
import { registerUser, loginWithGoogle } from "../../../services/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // By default new signups are 'user' role
      const { role } = await registerUser(email, password, name, "user");
      router.push("/user");
    } catch (err) {
      setError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const { role } = await loginWithGoogle();
      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/user");
      }
    } catch (err) {
      console.error(err);
      setError("Có lỗi khi đăng nhập bằng Google. Vui lòng thử lại.");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Đăng Ký</h1>
        {error && <p className={styles.error}>{error}</p>}
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
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            className={styles.input}
          />
          <input 
            type="password" 
            placeholder="Mật khẩu (ít nhất 6 ký tự)" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            minLength={6}
            className={styles.input}
          />
          <button type="submit" className={styles.button}>Đăng Ký</button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: 'rgba(255,255,255,0.2)' }}>
          <div style={{ flex: 1, height: '1px', background: 'currentColor' }}></div>
          <span style={{ margin: '0 1rem', fontSize: '0.9rem' }}>HOẶC</span>
          <div style={{ flex: 1, height: '1px', background: 'currentColor' }}></div>
        </div>

        <button 
          onClick={handleGoogleLogin} 
          className={styles.button} 
          style={{ 
            background: 'white', 
            color: '#000', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '0.8rem',
            fontWeight: '600'
          }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
          Tiếp tục với Google
        </button>
        <p className={styles.footerText}>
          Bạn đã có tài khoản? <Link href="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}

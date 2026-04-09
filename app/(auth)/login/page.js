"use client";

import { useState } from "react";
import { loginUser } from "@/services/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { role } = await loginUser(email, password);
      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/user");
      }
    } catch (err) {
      setError("Thông tin đăng nhập không hợp lệ. Vui lòng thử lại.");
    }
  };

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
          <button type="submit" className={styles.button}>Đăng Nhập</button>
        </form>
        <p className={styles.footerText}>
          Bạn chưa có tài khoản? <Link href="/register">Đăng ký</Link>
        </p>
      </div>
    </div>
  );
}

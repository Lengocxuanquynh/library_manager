"use client";

import { useState } from "react";
import { registerUser } from "@/services/auth";
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
        <p className={styles.footerText}>
          Bạn đã có tài khoản? <Link href="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}

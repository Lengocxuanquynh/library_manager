"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function DevEmailToggle() {
  const [isMock, setIsMock] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("DEV_MOCK_EMAIL") === "true";
      setIsMock(saved);
    }
  }, []);

  const toggleMock = () => {
    const newVal = !isMock;
    setIsMock(newVal);
    localStorage.setItem("DEV_MOCK_EMAIL", newVal ? "true" : "false");
    toast.info(`Mock Email Mode: ${newVal ? "BẬT (0đ Quota)" : "TẮT (Gửi thật)"}`);
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggleMock}
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
        background: isMock ? "#10b981" : "#ef4444",
        color: "white",
        border: "none",
        borderRadius: "20px",
        padding: "8px 16px",
        fontSize: "12px",
        fontWeight: "bold",
        cursor: "pointer",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        opacity: 0.8,
        transition: "all 0.2s",
        fontFamily: "system-ui, sans-serif"
      }}
      onMouseEnter={(e) => (e.target.style.opacity = "1")}
      onMouseLeave={(e) => (e.target.style.opacity = "0.8")}
    >
      🛠 {isMock ? "Mock OTP: ON" : "Mock OTP: OFF"}
    </button>
  );
}

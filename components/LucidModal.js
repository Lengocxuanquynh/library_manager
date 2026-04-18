"use client";

import { useState, useEffect, createContext, useContext } from "react";

const LucidContext = createContext();

export function LucidProvider({ children }) {
  const [modalConfig, setModalConfig] = useState(null);

  const confirm = (config) => {
    return new Promise((resolve) => {
      setModalConfig({
        ...config,
        type: "confirm",
        onConfirm: () => {
          setModalConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setModalConfig(null);
          resolve(false);
        },
      });
    });
  };

  const alert = (config) => {
    return new Promise((resolve) => {
      setModalConfig({
        ...(typeof config === "string" ? { message: config } : config),
        type: "alert",
        onConfirm: () => {
          setModalConfig(null);
          resolve(true);
        },
      });
    });
  };

  return (
    <LucidContext.Provider value={{ confirm, alert }}>
      {children}
      {modalConfig && <LucidModalUI config={modalConfig} />}
    </LucidContext.Provider>
  );
}

export function useLucid() {
  return useContext(LucidContext);
}

function LucidModalUI({ config }) {
  const [isAnimate, setIsAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimate(true), 10);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: isAnimate ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0)",
        backdropFilter: isAnimate ? "blur(8px)" : "blur(0px)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(23, 23, 26, 0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "28px",
          padding: "2rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          transform: isAnimate ? "scale(1) translateY(0)" : "scale(0.9) translateY(20px)",
          opacity: isAnimate ? 1 : 0,
          transition: "all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "20px",
              background: config.type === "confirm" ? "rgba(187, 134, 252, 0.1)" : "rgba(3, 218, 198, 0.1)",
              color: config.type === "confirm" ? "#bb86fc" : "#03dac6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.8rem",
              margin: "0 auto 1rem auto",
              boxShadow: config.type === "confirm" ? "0 0 20px rgba(187, 134, 252, 0.15)" : "0 0 20px rgba(3, 218, 198, 0.15)",
            }}
          >
            {config.type === "confirm" ? "❓" : "ℹ️"}
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#fff", marginBottom: "0.5rem", letterSpacing: "-0.5px" }}>
            {config.title || (config.type === "confirm" ? "Xác nhận hành động" : "Thông báo")}
          </h3>
          <p style={{ fontSize: "0.95rem", color: "rgba(255, 255, 255, 0.6)", lineHeight: "1.6" }}>
            {config.message}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          {config.type === "confirm" && (
            <button
              onClick={config.onCancel}
              style={{
                flex: 1,
                padding: "0.8rem",
                borderRadius: "14px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.8)",
                fontWeight: "600",
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)")}
            >
              {config.cancelText || "Hủy bỏ"}
            </button>
          )}
          <button
            onClick={config.onConfirm}
            style={{
              flex: 1,
              padding: "0.8rem",
              borderRadius: "14px",
              background: config.type === "confirm" ? "linear-gradient(135deg, #a435f0, #6200ee)" : "linear-gradient(135deg, #03dac6, #018786)",
              border: "none",
              color: "#fff",
              fontWeight: "700",
              fontSize: "0.9rem",
              cursor: "pointer",
              boxShadow: config.type === "confirm" ? "0 8px 15px rgba(98, 0, 238, 0.3)" : "0 8px 15px rgba(1, 135, 134, 0.3)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            {config.confirmText || (config.type === "confirm" ? "Đồng ý" : "Đã hiểu")}
          </button>
        </div>
      </div>
    </div>
  );
}

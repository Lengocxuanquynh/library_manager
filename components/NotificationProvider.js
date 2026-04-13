"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    message: "",
    onConfirm: null,
    onCancel: null,
  });

  // TOAST LOGIC
  const showToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  // CONFIRM MODAL LOGIC
  const confirmAction = useCallback((message, onConfirm, onCancel = null) => {
    setConfirmModal({
      isOpen: true,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ showToast, confirmAction }}>
      {children}

      {/* TOAST LIST */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* CONFIRM MODAL */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={confirmModal.onCancel}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Xác nhận</h3>
            <p className="modal-message">{confirmModal.message}</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={confirmModal.onCancel}>Hủy bỏ</button>
              <button className="btn-primary" onClick={confirmModal.onConfirm}>Đồng ý</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .toast-container {
          position: fixed;
          top: 2rem;
          right: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          z-index: 9999;
        }

        .toast {
          padding: 1rem 1.5rem;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
          animation: slideIn 0.3s ease forwards;
          backdrop-filter: blur(10px);
          max-width: 320px;
        }

        .toast-info { background: rgba(30, 30, 30, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); }
        .toast-success { background: rgba(39, 201, 63, 0.9); border: 1px solid rgba(39, 201, 63, 0.2); }
        .toast-error { background: rgba(207, 102, 121, 0.9); border: 1px solid rgba(207, 102, 121, 0.2); }
        .toast-warning { background: rgba(255, 183, 77, 0.9); border: 1px solid rgba(255, 183, 77, 0.2); color: #000; }

        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9998;
          animation: fadeIn 0.2s ease;
        }

        .modal-content {
          width: 90%;
          max-width: 440px;
          padding: 2.5rem;
          border-radius: 24px;
          text-align: center;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
          animation: scaleIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }

        .modal-title { margin-bottom: 1rem; color: #fff; font-size: 1.5rem; }
        .modal-message { margin-bottom: 2.5rem; color: rgba(255, 255, 255, 0.7); line-height: 1.6; }
        .modal-actions { display: flex; gap: 1rem; justify-content: center; }
        .modal-actions button { flex: 1; padding: 0.9rem; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};

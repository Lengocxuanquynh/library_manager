"use client";
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ConfirmContext = createContext();

export const ConfirmProvider = ({ children }) => {
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm', // 'confirm' or 'alert'
    resolve: null
  });

  const confirmPremium = useCallback((message, title = 'Xác nhận hành động', type = 'confirm') => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        title,
        message,
        type,
        resolve
      });
    });
  }, []);

  const handleClose = (value) => {
    if (modal.resolve) {
      modal.resolve(value);
    }
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <ConfirmContext.Provider value={{ confirmPremium }}>
      {children}
      
      {modal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          background: 'rgba(0,0,0,0.6)', animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,30,30,0.95), rgba(20,20,20,0.98))',
            width: '90%', maxWidth: '450px', borderRadius: '28px',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '2.5rem', boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
            textAlign: 'center', animation: 'scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <style>{`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes scaleUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
              .premium-btn { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
              .premium-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
              .premium-btn:active { transform: translateY(0); }
            `}</style>
            
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
              {modal.title}
            </div>
            
            <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', marginBottom: '2.5rem' }}>
              {modal.message}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {modal.type === 'confirm' && (
                <button 
                  onClick={() => handleClose(false)}
                  className="premium-btn"
                  style={{
                    flex: 1, padding: '0.9rem', borderRadius: '14px',
                    background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                    fontSize: '0.9rem', fontWeight: '600'
                  }}
                >
                  Hủy bỏ
                </button>
              )}
              <button 
                onClick={() => handleClose(true)}
                className="premium-btn"
                style={{
                  flex: 1, padding: '0.9rem', borderRadius: '14px',
                  background: modal.type === 'confirm' ? '#ff5f56' : '#bb86fc', 
                  color: '#fff', border: 'none', cursor: 'pointer',
                  fontSize: '0.9rem', fontWeight: '700',
                  boxShadow: modal.type === 'confirm' ? '0 10px 20px -5px rgba(255,95,86,0.4)' : '0 10px 20px -5px rgba(187,134,252,0.4)'
                }}
              >
                {modal.type === 'confirm' ? 'Đồng ý' : 'Tuyệt vời'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within a ConfirmProvider');
  
  const { confirmPremium } = context;

  const alertPremium = useCallback((message, title = 'Thông báo') => {
    return confirmPremium(message, title, 'alert');
  }, [confirmPremium]);

  return { confirmPremium, alertPremium };
};

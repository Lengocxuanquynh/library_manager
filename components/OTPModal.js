import React, { useState } from 'react';

export default function OTPModal({ email, onVerify, onCancel, resendOTP, isSending }) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError('Vui lòng nhập đủ 6 ký tự mã OTP.');
      return;
    }
    setError('');
    onVerify(otp);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Xác Nhận OTP</h2>
        <p style={styles.description}>
          Mã xác nhận 6 số đã được gửi đến email <strong>{email}</strong>. Vui lòng kiểm tra hộp thư (và mục Spam) để lấy mã.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // only allow digits
            placeholder="Nhập 6 số mã OTP"
            style={styles.input}
            disabled={isSending}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          
          <div style={styles.actions}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={isSending}>
              Huỷ bỏ
            </button>
            <button type="submit" style={styles.submitBtn} disabled={isSending || otp.length < 6}>
              {isSending ? 'Đang kiểm tra...' : 'Xác Nhận'}
            </button>
          </div>
        </form>

        <div style={styles.footer}>
          <span>Không nhận được mã? </span>
          <button 
            type="button" 
            onClick={resendOTP} 
            style={styles.resendBtn}
            disabled={isSending}
          >
            Gửi lại mã
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '30px',
    width: '90%',
    maxWidth: '400px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    color: '#333',
    textAlign: 'center',
  },
  description: {
    fontSize: '0.95rem',
    color: '#666',
    textAlign: 'center',
    lineHeight: '1.4',
    margin: '10px 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  input: {
    padding: '12px',
    fontSize: '1.2rem',
    textAlign: 'center',
    letterSpacing: '5px',
    border: '2px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.3s',
  },
  error: {
    color: '#e74c3c',
    fontSize: '0.85rem',
    margin: 0,
    textAlign: 'center',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#f1f1f1',
    color: '#333',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
  },
  submitBtn: {
    flex: 2,
    padding: '12px',
    backgroundColor: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
  },
  footer: {
    marginTop: '15px',
    textAlign: 'center',
    fontSize: '0.9rem',
    color: '#666',
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    color: '#3498db',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  }
};

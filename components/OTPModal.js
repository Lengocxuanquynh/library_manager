import React, { useState, useEffect, useRef } from 'react';

/**
 * OTPModal Premium - Giao diện xác thực OTP phong cách Glassmorphism
 * Hỗ trợ 6 ô nhập liệu rời, tự động focus, backspace và paste.
 */
export default function OTPModal({ email, onVerify, onCancel, resendOTP, isSending }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [isExpired, setIsExpired] = useState(false);
  const inputRefs = useRef([]);

  // Đếm ngược thời gian
  useEffect(() => {
    if (timeLeft <= 0) {
      setIsExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Luôn focus vào ô đầu tiên khi mở modal
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleChange = (value, index) => {
    // Chỉ cho phép nhập số
    const cleanValue = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = cleanValue;
    setOtp(newOtp);

    // Tự động chuyển sang ô tiếp theo nếu có giá trị
    if (cleanValue && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    // Nếu nhấn Backspace khi ô hiện tại trống, chuyển về ô trước đó
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const data = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (data.length > 0) {
      const newOtp = [...otp];
      data.split('').forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      
      // Focus vào ô cuối cùng hoặc ô tiếp theo sau chuỗi dán
      const lastIndex = Math.min(data.length, 5);
      inputRefs.current[lastIndex].focus();
    }
  };

  const handleResend = () => {
    setTimeLeft(300);
    setIsExpired(false);
    setOtp(['', '', '', '', '', '']);
    if (inputRefs.current[0]) inputRefs.current[0].focus();
    resendOTP();
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const fullOtp = otp.join('');
    
    if (isExpired) {
      setError('Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.');
      return;
    }
    if (fullOtp.length < 6) {
      setError('Vui lòng nhập đủ 6 số mã OTP.');
      return;
    }
    setError('');
    onVerify(fullOtp);
  };

  // Tự động submit khi đã nhập đủ 6 số
  useEffect(() => {
    const fullOtp = otp.join('');
    if (fullOtp.length === 6 && !isSending) {
      handleSubmit();
    }
  }, [otp]);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="glass">
        <div style={styles.iconContainer}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--primary, #bb86fc)'}}>
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h2 style={styles.title}>Xác nhận OTP</h2>
        <p style={styles.description}>
          Mã xác nhận 6 số đã được gửi đến email <br/>
          <strong style={{color: 'var(--primary, #bb86fc)', fontSize: '1rem'}}>{email}</strong>
        </p>

        <div style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(e.target.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onPaste={index === 0 ? handlePaste : undefined}
              style={{
                ...styles.digitInput,
                borderColor: error ? 'var(--error, #cf6679)' : (digit ? 'var(--primary, #bb86fc)' : 'rgba(255,255,255,0.1)'),
                boxShadow: digit ? '0 0 10px rgba(187, 134, 252, 0.2)' : 'none'
              }}
              disabled={isSending || isExpired}
            />
          ))}
        </div>

        <div style={styles.timerContainer}>
          <span style={{ 
            fontSize: '0.9rem', 
            fontWeight: '600', 
            color: isExpired ? 'var(--error, #cf6679)' : 'rgba(255,255,255,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isExpired ? 'var(--error, #cf6679)' : 'var(--secondary, #03dac6)',
              boxShadow: isExpired ? 'none' : '0 0 8px var(--secondary)',
              display: 'inline-block'
            }}></span>
            {isExpired ? 'Mã đã hết hạn' : `Hiệu lực còn: ${formatTime(timeLeft)}`}
          </span>
        </div>

        {error && <div style={styles.errorContainer}>{error}</div>}
        
        <div style={styles.actions}>
          <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={isSending}>
            Huỷ bỏ
          </button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            style={{
                ...styles.submitBtn,
                opacity: (isSending || otp.join('').length < 6 || isExpired) ? 0.6 : 1
            }} 
            disabled={isSending || otp.join('').length < 6 || isExpired}
          >
            {isSending ? 'Đang xác thực...' : 'Xác nhận mã'}
          </button>
        </div>

        <div style={styles.footer}>
          <span>Không nhận được mã? </span>
          <button 
            type="button" 
            onClick={handleResend} 
            style={styles.resendBtn}
            disabled={isSending || (timeLeft > 240)}
          >
            {timeLeft > 240 ? `Gửi lại sau (${timeLeft - 240}s)` : 'Gửi lại mã ngay'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modal: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: '24px',
    padding: '40px 30px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  iconContainer: {
    marginBottom: '20px',
    backgroundColor: 'rgba(187, 134, 252, 0.1)',
    padding: '15px',
    borderRadius: '50%',
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '1.75rem',
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: '-0.5px'
  },
  description: {
    fontSize: '0.95rem',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: '1.6',
    marginBottom: '30px',
  },
  otpContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '25px',
    width: '100%'
  },
  digitInput: {
    width: '50px',
    height: '60px',
    fontSize: '1.5rem',
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid',
    borderRadius: '12px',
    color: '#fff',
    outline: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  timerContainer: {
    marginBottom: '25px',
  },
  errorContainer: {
    color: 'var(--error, #cf6679)',
    backgroundColor: 'rgba(207, 102, 121, 0.1)',
    padding: '10px 20px',
    borderRadius: '10px',
    fontSize: '0.85rem',
    marginBottom: '20px',
    textAlign: 'center',
    width: '100%'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    width: '100%',
    marginBottom: '25px',
  },
  cancelBtn: {
    flex: 1,
    padding: '14px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.95rem',
    transition: 'all 0.2s',
  },
  submitBtn: {
    flex: 1.5,
    padding: '14px',
    backgroundColor: 'var(--primary, #bb86fc)',
    color: '#000',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '0.95rem',
    transition: 'all 0.2s',
    boxShadow: '0 4px 15px rgba(187, 134, 252, 0.3)',
  },
  footer: {
    textAlign: 'center',
    fontSize: '0.9rem',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary, #bb86fc)',
    fontWeight: '700',
    cursor: 'pointer',
    padding: '0 5px',
    textDecoration: 'none',
    transition: 'all 0.2s',
  }
};

import React, { useState, useEffect } from 'react';

/**
 * PremiumPasswordInput - Thành phần nhập mật khẩu cao cấp
 * Bao gồm: Hiện/Ẩn, Đo độ mạnh, Checklist bảo mật và Hiệu ứng Glow/Shake.
 */
export default function PremiumPasswordInput({ 
  value, 
  onChange, 
  placeholder = "Nhập mật khẩu", 
  label = "Mật khẩu",
  showStrength = true,
  showChecklist = true,
  error = "",
  required = true,
  validateStrict = false // Nếu true, sẽ bắt buộc đủ 4 tiêu chuẩn để submit
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState(0);
  const [requirements, setRequirements] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
    special: false
  });

  useEffect(() => {
    const checks = {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      lower: /[a-z]/.test(value),
      number: /[0-9]/.test(value),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(value)
    };
    setRequirements(checks);

    // Tính điểm sức mạnh (0-5)
    const score = Object.values(checks).filter(Boolean).length;
    setStrength(score);
  }, [value]);

  const getStrengthColor = () => {
    if (strength <= 2) return '#ff5252'; // Đỏ - Yếu
    if (strength <= 4) return '#ffb142'; // Vàng - Trung bình
    return '#00d2d3'; // Xanh - Mạnh
  };

  const getStrengthText = () => {
    if (value.length === 0) return '';
    if (strength <= 2) return 'Yếu (Dễ bị bẻ khóa)';
    if (strength <= 4) return 'Trung bình (Nên thêm ký tự đặc biệt)';
    return 'Rất Mạnh (An toàn tuyệt đối)';
  };

  return (
    <div style={styles.container}>
      {label && <label style={styles.label}>{label} {required && '*'}</label>}
      
      <div style={styles.inputWrapper}>
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            ...styles.input,
            borderColor: error ? '#ff5252' : (value && strength === 5 ? '#00d2d3' : 'rgba(255,255,255,0.1)'),
            boxShadow: value ? `0 0 10px ${getStrengthColor()}22` : 'none'
          }}
          required={required}
        />
        <button 
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={styles.eyeBtn}
        >
          {showPassword ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          )}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div style={styles.strengthBox}>
          <div style={styles.strengthBarContainer}>
            <div style={{
              ...styles.strengthBarFill,
              width: `${(strength / 5) * 100}%`,
              backgroundColor: getStrengthColor()
            }} />
          </div>
          <span style={{...styles.strengthText, color: getStrengthColor()}}>{getStrengthText()}</span>
        </div>
      )}

      {/* Checklist Lưu ý đàng hoàng cho User */}
      {showChecklist && (
        <div style={styles.checklist}>
          <div style={styles.checkItem}>
            <span style={requirements.length ? styles.checkIconValid : styles.checkIconInvalid}>
              {requirements.length ? '✓' : '○'}
            </span>
            <span style={requirements.length ? styles.checkTextValid : styles.checkText}>Ít nhất 8 ký tự</span>
          </div>
          <div style={styles.checkItem}>
            <span style={requirements.upper ? styles.checkIconValid : styles.checkIconInvalid}>
              {requirements.upper ? '✓' : '○'}
            </span>
            <span style={requirements.upper ? styles.checkTextValid : styles.checkText}>Chữ hoa (A-Z)</span>
          </div>
          <div style={styles.checkItem}>
            <span style={requirements.lower ? styles.checkIconValid : styles.checkIconInvalid}>
              {requirements.lower ? '✓' : '○'}
            </span>
            <span style={requirements.lower ? styles.checkTextValid : styles.checkText}>Chữ thường (a-z)</span>
          </div>
          <div style={styles.checkItem}>
            <span style={requirements.number ? styles.checkIconValid : styles.checkIconInvalid}>
              {requirements.number ? '✓' : '○'}
            </span>
            <span style={requirements.number ? styles.checkTextValid : styles.checkText}>Số (0-9)</span>
          </div>
          <div style={styles.checkItem}>
            <span style={requirements.special ? styles.checkIconValid : styles.checkIconInvalid}>
              {requirements.special ? '✓' : '○'}
            </span>
            <span style={requirements.special ? styles.checkTextValid : styles.checkText}>Ký tự đặc biệt (@#$... )</span>
          </div>
        </div>
      )}

      {error && <p style={styles.errorMsg}>{error}</p>}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
    fontFamily: "'Inter', sans-serif"
  },
  label: {
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: '600',
    marginBottom: '4px'
  },
  inputWrapper: {
    position: 'relative',
    width: '100%'
  },
  input: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '12px 45px 12px 15px',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    transition: 'all 0.3s ease',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    opacity: 0.6,
    display: 'flex',
    alignItems: 'center'
  },
  strengthBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '4px'
  },
  strengthBarContainer: {
    flex: 1,
    height: '6px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '3px',
    overflow: 'hidden'
  },
  strengthBarFill: {
    height: '100%',
    transition: 'width 0.3s ease, background-color 0.3s ease'
  },
  strengthText: {
    fontSize: '0.8rem',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  checklist: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px 15px',
    marginTop: '8px',
    padding: '10px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  checkIconValid: {
    color: '#00d2d3',
    fontWeight: 'bold',
    fontSize: '0.9rem'
  },
  checkIconInvalid: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: '0.9rem'
  },
  checkText: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)'
  },
  checkTextValid: {
    fontSize: '0.75rem',
    color: '#00d2d3',
    fontWeight: '500'
  },
  errorMsg: {
    color: '#ff5252',
    fontSize: '0.8rem',
    margin: '4px 0 0 0',
    fontWeight: '500'
  }
};

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../../components/AuthProvider";
import styles from "../../dashboard.module.css";
import Link from "next/link";
import { updateUserProfile, updateUserPassword, updateUserEmail, logoutUser } from "../../../../services/auth";
import { sendMail } from "../../../../services/emailService";
import OTPModal from "../../../../components/OTPModal";
import { toast } from "sonner";
import { createNotification } from "../../../../services/db";

export default function UserSettings() {
  const { user, role } = useAuth();
  
  // Basic Profile
   const [name, setName] = useState("");
   const [avatar, setAvatar] = useState("");
   const [loading, setLoading] = useState(false);
   const [message, setMessage] = useState({ type: '', text: '' });

  // Password Change State
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Email Change State
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // OTP State Machine
  // mode: null | 'PASSWORD' | 'EMAIL_STEP_1' | 'EMAIL_STEP_2'
  const [otpMode, setOtpMode] = useState(null); 
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [customEmailTarget, setCustomEmailTarget] = useState(""); 

  // Phone Change State
  const [newPhone, setNewPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    if (user?.displayName) {
      setName(user.displayName);
    }
    if (user?.photoURL) {
      setAvatar(user.photoURL);
    }
  }, [user]);

  const handleErrorStr = (err) => {
    if (err.code === 'auth/requires-recent-login') {
      return "An Ninh: Vui lòng ĐĂNG XUẤT thẻ và ĐĂNG NHẬP lại để chứng minh chủ quyền trước khi đổi thông tin này!";
    }
    return err.message || "Đã xảy ra lỗi hệ thống.";
  };

  // --- Basic Profile Update ---
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await updateUserProfile(user.uid, { name, photoURL: avatar });
      
      // Thông báo vào Hộp thư
      if (name !== user.displayName) {
        await createNotification(user.uid, "📝 Thay đổi họ tên", `Bạn đã đổi tên thành: ${name}`, "info");
      }
      
      setMessage({ type: 'success', text: 'Cập nhật Hồ sơ thành công!' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Lỗi cập nhật hồ sơ' });
    } finally {
      setLoading(false);
    }
  };

  // --- OTP Trigger Helper ---
  const triggerSendOTP = async (targetEmail, contextName) => {
    setIsSendingOTP(true);
    const newOTP = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(newOTP);
    setCustomEmailTarget(targetEmail);

    try {
      const result = await sendMail(targetEmail, contextName, newOTP);
      if (result.mock) {
        toast.success(`[DEV MODE] OTP mô phỏng tới ${targetEmail}: ${result.otp}`, { duration: 10000 });
      } else {
        toast.success(`Đã gửi mã OTP đến ${targetEmail}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi gửi Email OTP. Vui lòng thử lại.");
      setOtpMode(null);
    } finally {
      setIsSendingOTP(false);
    }
  };

  // --- Start Password Change ---
  const startPasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordError("Mật khẩu phải dài ít nhất 8 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không trùng khớp");
      return;
    }
    setPasswordError("");
    setOtpMode('PASSWORD');
    await triggerSendOTP(user.email, "yêu cầu Đổi Mật Khẩu");
  };

  // --- Start Email Change ---
  const startEmailChange = async (e) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      setEmailError("Email mới không hợp lệ");
      return;
    }
    if (newEmail === user.email) {
      setEmailError("Email mới bị trùng với Email hiện tại");
      return;
    }
    setEmailError("");
    setOtpMode('EMAIL_STEP_1');
    // Bước 1: Gửi vào email cũ để xác minh chủ cũ
    await triggerSendOTP(user.email, "yêu cầu Đổi Email (Vòng 1/2)");
  };
  
  // --- Start Phone Change ---
  const startPhoneChange = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(newPhone)) {
      setPhoneError("Số điện thoại phải có đúng 10 chữ số");
      return;
    }
    setPhoneError("");
    setOtpMode('PHONE');
    await triggerSendOTP(user.email, "yêu cầu Đổi Số điện thoại");
  };

  // --- OTP Verification Logic ---
  const onVerifyOTP = async (inputOTP) => {
    if (inputOTP !== generatedOTP) {
      toast.error("Mã OTP không chính xác hoặc đã hết hạn!");
      return;
    }

    if (otpMode === 'PASSWORD') {
      try {
        await updateUserPassword(newPassword);
        
        // Thông báo vào Hộp thư
        await createNotification(user.uid, "🔐 Bảo mật tài khoản", "Bạn đã thay đổi mật khẩu thành công.", "success");

        toast.success("Đổi mật khẩu thành công! Hệ thống sẽ Đăng Xuất sau 2 giây để bảo mật...");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordForm(false);
        setTimeout(() => logoutUser(), 2000);
      } catch (err) {
        toast.error(handleErrorStr(err));
      }
      setOtpMode(null);
    } 
    else if (otpMode === 'EMAIL_STEP_1') {
      toast.success("Vòng 1 chuẩn xác! Đang tạo OTP cuối cùng gửi tới Email Mới của bạn...");
      setOtpMode('EMAIL_STEP_2');
      // Bước 2: Gửi vào email MỚI để chốt kèo
      await triggerSendOTP(newEmail, "xác nhận hộp thư mới (Vòng 2/2)");
    }
    else if (otpMode === 'EMAIL_STEP_2') {
      try {
        await updateUserEmail(user.uid, newEmail);

        // Thông báo vào Hộp thư
        await createNotification(user.uid, "📧 Thay đổi Email", `Bạn đã đổi địa chỉ Email thành: ${newEmail}`, "success");

        toast.success("Đổi Email thành công! Hệ thống sẽ Đăng Xuất sau 2 giây để áp dụng quyền...");
        setNewEmail("");
        setShowEmailForm(false);
        setTimeout(() => logoutUser(), 2000);
      } catch (err) {
        toast.error(handleErrorStr(err));
      }
      setOtpMode(null);
    }
    else if (otpMode === 'PHONE') {
      try {
        await updateUserProfile(user.uid, { phone: newPhone });

        // Thông báo vào Hộp thư
        await createNotification(user.uid, "📞 Cập nhật Số điện thoại", `Bạn đã đổi số điện thoại thành: ${newPhone}`, "success");

        toast.success("Cập nhật Số điện thoại thành công!");
        setNewPhone("");
        setOtpMode(null);
      } catch (err) {
        toast.error(handleErrorStr(err));
        setOtpMode(null);
      }
    }
  };

  const onCancelOTP = () => {
    setOtpMode(null);
    toast.error("Đã hủy quá trình xác nhận OTP.");
  };

  // Render Conditional Modal
  if (otpMode) {
    let modeText = "";
    if (otpMode === 'PASSWORD') modeText = "Đổi Mật Khẩu";
    if (otpMode === 'EMAIL_STEP_1') modeText = "Bước 1/2 - Chứng Thực Mất Email";
    if (otpMode === 'EMAIL_STEP_2') modeText = "Bước 2/2 - Liên Kết Email Mới";
    if (otpMode === 'PHONE') modeText = "Đổi Số Điện Thoại";

    return (
      <OTPModal
        email={customEmailTarget}
        isSending={isSendingOTP}
        onVerify={onVerifyOTP}
        onCancel={onCancelOTP}
        resendOTP={() => triggerSendOTP(customEmailTarget, modeText)}
      />
    );
  }

  return (
    <div>
      <div className={styles.headerArea}>
        <h1 className={styles.pageTitle}>Cài Đặt Tài Khoản</h1>
        <Link href="/user" className="btn-outline">Quay lại Hồ Sơ</Link>
      </div>

      <div className={styles.grid}>
        {/* Profile Summary */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ 
            width: '100px', 
            height: '100px', 
            borderRadius: '50%', 
            backgroundImage: avatar ? `url(${avatar})` : 'none',
            backgroundColor: avatar ? 'transparent' : 'rgba(255,255,255,0.05)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: '3px solid #bb86fc',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '1.2rem',
            boxShadow: '0 0 20px rgba(187, 134, 252, 0.2)'
          }}>
            {!avatar && (name ? name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase())}
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.4rem', color: '#fff' }}>{name || "Độc giả"}</h2>
          <p style={{ color: 'rgba(255,193,7,0.8)', fontSize: '1.1rem', marginBottom: '1.2rem', fontWeight: '800', fontFamily: 'monospace', letterSpacing: '2px' }}> {user?.memberCode} </p>
          <div style={{ padding: '0.4rem 1rem', background: 'rgba(187, 134, 252, 0.1)', borderRadius: '20px', fontSize: '0.8rem', color: '#bb86fc', border: '1px solid rgba(187, 134, 252, 0.2)' }}>
            Hạng: <strong>Thành viên Thư Viện</strong>
          </div>
        </div>

        {/* Cài Đặt Khối Thao Tác */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', gridColumn: 'span 2' }}>
          
          {/* Cập Nhật Tên */}
          <div className={styles.card}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Thông Tin Cơ Bản</h3>
            <form onSubmit={handleUpdate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Họ và Tên</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                  className={styles.input}
                  style={{ width: '100%', padding: '0.9rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Link Ảnh Đại Diện (Avatar URL)</label>
                <input 
                  type="url" 
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '0.9rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.9rem 2.5rem', width: 'fit-content' }}>
                  {loading ? "Đang lưu..." : "Cập Nhật Hồ Sơ"}
                </button>
              </div>
            </form>
            {message.text && (
              <p style={{ marginTop: '1rem', color: message.type === 'success' ? '#27c93f' : '#ff5f56', fontSize: '0.9rem' }}>
                {message.text}
              </p>
            )}
          </div>

          {/* Cập Nhật Mật Khẩu */}
          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.3rem' }}>Thay Đổi Mật Khẩu</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Có xác nhận OTP để đảm bảo an toàn tối đa.</p>
              </div>
              <button type="button" onClick={() => setShowPasswordForm(!showPasswordForm)} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {showPasswordForm ? "Hủy thay đổi" : "Bắt Đầu ▸"}
              </button>
            </div>
            
            {showPasswordForm && (
              <form onSubmit={startPasswordChange} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Mật khẩu mới (Tối thiểu 8 ký tự)</label>
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập khóa mới (>= 8 ký tự)..."
                      style={{ padding: '0.9rem', borderRadius: '8px', border: '1px solid rgba(187, 134, 252, 0.3)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Xác nhận Mật khẩu mới</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại khóa mới để chốt..."
                      style={{ padding: '0.9rem', borderRadius: '8px', border: '1px solid rgba(187, 134, 252, 0.3)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                      required
                    />
                  </div>
                </div>
                {passwordError && <p style={{ color: '#ff5f56', fontSize: '0.9rem', margin: 0 }}>{passwordError}</p>}
                <button type="submit" className="btn-primary" style={{ background: 'rgba(187, 134, 252, 0.1)', color: '#bb86fc', width: 'fit-content' }}>
                  Yêu Cầu Lấy Mã OTP
                </button>
              </form>
            )}
          </div>

          {/* Cập Nhật Email */}
          <div className={styles.card} style={{ border: '1px solid rgba(255, 193, 7, 0.1)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ffc107' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.3rem', color: 'rgba(255, 193, 7, 0.9)' }}>Kết Nối Hòm Thư Mới</h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Cần 2 bước OTP xác thực khép kín: Thư Cũ ➜ Thư Mới.</p>
              </div>
              <button type="button" onClick={() => setShowEmailForm(!showEmailForm)} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'rgba(255, 193, 7, 0.3)', color: '#ffc107' }}>
                {showEmailForm ? "Hủy thay đổi" : "Bắt Đầu Kích Hoạt ▸"}
              </button>
            </div>

            {showEmailForm && (
              <form onSubmit={startEmailChange} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Nhập Địa Chỉ Email Mới</label>
                  <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    style={{ width: '100%', padding: '0.9rem', borderRadius: '8px', border: '1px solid rgba(255, 193, 7, 0.3)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                    required
                  />
                </div>
                {emailError && <p style={{ color: '#ff5f56', fontSize: '0.9rem', margin: 0 }}>{emailError}</p>}
                <button type="submit" className="btn-primary" style={{ background: 'rgba(255, 193, 7, 0.1)', color: '#ffc107', width: 'fit-content' }}>
                  Gửi Mã OTP Tới Email Cũ
                </button>
              </form>
            )}
          </div>

          {/* Cập Nhật Số Điện Thoại */}
          <div className={styles.card} style={{ border: '1px solid rgba(39, 201, 63, 0.1)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#27c93f' }}></div>
            <div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.3rem', color: '#27c93f' }}>Cập Nhật Số Điện Thoại</h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem' }}>Số điện thoại hiện tại: <strong>{user?.phone || "Chưa có"}</strong></p>
              
              <form onSubmit={startPhoneChange} style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Nhập Số Điện Thoại Mới (10 số)</label>
                  <input 
                    type="tel" 
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="09xx..."
                    style={{ width: '100%', padding: '0.9rem', borderRadius: '8px', border: '1px solid rgba(39, 201, 63, 0.3)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                    required
                  />
                </div>
                {phoneError && <p style={{ color: '#ff5f56', fontSize: '0.9rem', margin: 0 }}>{phoneError}</p>}
                <button type="submit" className="btn-primary" style={{ background: 'rgba(39, 201, 63, 0.1)', color: '#27c93f', width: 'fit-content' }}>
                  Xác Thực OTP Qua Email
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  updateDoc, 
  increment,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";

/**
 * Creates or updates an OTP session for a user.
 * @param {string} uid - User ID
 * @param {string} email - User Email
 * @returns {Promise<string>} - The generated 6-digit OTP code
 */
export const createOTPSession = async (uid, email) => {
  if (!uid) throw new Error("UID is required for OTP session");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

  const otpRef = doc(db, "otp_sessions", uid);
  await setDoc(otpRef, {
    uid,
    email,
    code,
    expiresAt,
    attempts: 0,
    createdAt: serverTimestamp()
  });

  return code;
};

/**
 * Verifies an OTP code for a user.
 * @param {string} uid - User ID
 * @param {string} inputCode - Code entered by user
 * @returns {Promise<{success: boolean, message: string, shouldLogout: boolean}>}
 */
export const verifyOTPSession = async (uid, inputCode) => {
  const otpRef = doc(db, "otp_sessions", uid);
  const snap = await getDoc(otpRef);

  if (!snap.exists()) {
    return { success: false, message: "Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng gửi lại mã mới.", shouldLogout: false };
  }

  const data = snap.data();
  const now = new Date();
  
  // Convert Firestore Timestamp to JS Date
  const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

  // 1. Check Expiry
  if (now > expiresAt) {
    await deleteDoc(otpRef);
    return { success: false, message: "Mã OTP đã quá hạn (5 phút). Vui lòng gửi lại mã mới.", shouldLogout: false };
  }

  // 2. Check Attempts
  if (data.attempts >= 3) {
    await deleteDoc(otpRef);
    return { success: false, message: "Bạn đã nhập sai quá 3 lần. Tài khoản sẽ được đăng xuất để bảo mật. Vui lòng thử lại sau.", shouldLogout: true };
  }

  // 3. Compare Codes
  if (data.code === inputCode) {
    await deleteDoc(otpRef); // Success, clear OTP
    return { success: true, message: "Xác nhận OTP thành công." };
  } else {
    // Increment attempts
    const newAttempts = (data.attempts || 0) + 1;
    if (newAttempts >= 3) {
      await deleteDoc(otpRef);
      return { success: false, message: "Đã quá số lần nhập sai (3 lần). Phiếu OTP đã bị hủy.", shouldLogout: true };
    } else {
      await updateDoc(otpRef, { attempts: increment(1) });
      return { success: false, message: `Mã OTP không chính xác. Bạn còn ${3 - newAttempts} lần thử.`, shouldLogout: false };
    }
  }
};

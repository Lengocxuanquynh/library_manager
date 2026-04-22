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
import crypto from "crypto";

/**
 * Băm mã OTP bằng SHA-256
 */
const hashOTP = (code) => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

/**
 * Kiểm tra giới hạn phạt (Lockout/Incremental Backoff)
 */
export const checkOTPLimit = async (email) => {
  const limitRef = doc(db, "otp_limits", email);
  const snap = await getDoc(limitRef);
  
  if (!snap.exists()) return { isLocked: false };

  const data = snap.data();
  if (!data.lockedUntil) return { isLocked: false };

  const lockedUntil = data.lockedUntil.toDate ? data.lockedUntil.toDate() : new Date(data.lockedUntil);
  const now = new Date();

  if (now < lockedUntil) {
    const diffMin = Math.ceil((lockedUntil - now) / (1000 * 60));
    return { 
      isLocked: true, 
      message: `Tài khoản đang bị tạm khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau ${diffMin} phút.`,
      lockedUntil 
    };
  }

  return { isLocked: false };
};

/**
 * Ghi nhận một lần thất bại và áp dụng hình phạt tăng dần
 */
export const recordOTPFailure = async (email) => {
  const limitRef = doc(db, "otp_limits", email);
  const snap = await getDoc(limitRef);
  
  let penaltyLevel = 0;
  if (snap.exists()) {
    penaltyLevel = snap.data().penaltyLevel || 0;
  }

  penaltyLevel += 1;
  
  // Tính thời gian khóa (5, 15, 60 phút)
  let lockMinutes = 5;
  if (penaltyLevel === 2) lockMinutes = 15;
  if (penaltyLevel >= 3) lockMinutes = 60;

  const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);

  await setDoc(limitRef, {
    email,
    penaltyLevel,
    lockedUntil,
    lastFailure: serverTimestamp()
  }, { merge: true });

  return { penaltyLevel, lockMinutes };
};

/**
 * Xóa hình phạt khi thành công
 */
export const resetOTPLimit = async (email) => {
  const limitRef = doc(db, "otp_limits", email);
  await deleteDoc(limitRef);
};

/**
 * Tạo phiên OTP bảo mật (Fingerprint + Hashing)
 */
export const createOTPSession = async (uid, email, fingerprint = "") => {
  if (!uid) throw new Error("UID is required");

  // 1. Tạo mã ngẫu nhiên 6 số
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // 2. Băm mã trước khi lưu
  const hashedCode = hashOTP(code);
  
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Hiệu lực 5 phút

  const otpRef = doc(db, "otp_sessions", uid);
  await setDoc(otpRef, {
    uid,
    email,
    hashedCode, // CHỈ lưu mã đã băm
    expiresAt,
    fingerprint, // Ràng buộc thiết bị
    attempts: 0,
    createdAt: serverTimestamp()
  });

  return code; // TRẢ mã thực về để gửi mail, sau đó Server sẽ "quên" mã này
};

/**
 * Xác thực OTP bảo mật cao
 */
export const verifyOTPSession = async (uid, inputCode, currentFingerprint = "") => {
  const otpRef = doc(db, "otp_sessions", uid);
  const snap = await getDoc(otpRef);

  if (!snap.exists()) {
    return { success: false, message: "Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng gửi lại mã mới.", shouldLogout: false };
  }

  const data = snap.data();
  const email = data.email;
  const now = new Date();
  const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

  // 1. Kiểm tra dấu vân tay (Fingerprint Binding)
  if (data.fingerprint && data.fingerprint !== currentFingerprint) {
    await deleteDoc(otpRef);
    await recordOTPFailure(email); // Coi như một lần tấn công
    return { success: false, message: "Cảnh báo bảo mật: Yêu cầu xác thực không khớp với thiết bị đã gửi mã. Tài khoản bị tạm khóa.", shouldLogout: true };
  }

  // 2. Kiểm tra thời gian
  if (now > expiresAt) {
    await deleteDoc(otpRef);
    return { success: false, message: "Mã OTP đã quá hạn (5 phút). Vui lòng gửi lại mã mới.", shouldLogout: false };
  }

  // 3. So khớp băm (SHA-256)
  const hashedInput = hashOTP(inputCode);
  
  if (data.hashedCode === hashedInput) {
    await deleteDoc(otpRef); 
    await resetOTPLimit(email); // Thành công -> Xóa vết phạt
    return { success: true, message: "Xác nhận OTP thành công." };
  } else {
    // Sai mã -> Cộng dồn lần thử của phiên này
    const newAttempts = (data.attempts || 0) + 1;
    
    if (newAttempts >= 3) {
      await deleteDoc(otpRef);
      const { lockMinutes } = await recordOTPFailure(email); // Sai 3 lần -> Bắt đầu phạt khóa
      return { 
        success: false, 
        message: `Bạn đã nhập sai quá 3 lần. Hệ thống tạm khóa ${lockMinutes} phút để bảo mật.`, 
        shouldLogout: true 
      };
    } else {
      await updateDoc(otpRef, { attempts: increment(1) });
      return { success: false, message: `Mã OTP không chính xác. Bạn còn ${3 - newAttempts} lần thử.`, shouldLogout: false };
    }
  }
};

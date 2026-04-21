import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  updatePassword,
  updateEmail,
  getAdditionalUserInfo
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, getCountFromServer, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// Register user and store role
export const registerUser = async (email, password, name, role = "user", phone = "", username = "") => {
  try {
    // Check if username already exists
    if (username) {
      const uQuery = query(collection(db, "users"), where("username", "==", username.toLowerCase()));
      const uSnap = await getDocs(uQuery);
      if (!uSnap.empty) {
        throw new Error("Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.");
      }
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, { displayName: name });

    // Create Auto-increment Member Code
    const snapshot = await getCountFromServer(collection(db, "users"));
    const count = snapshot.data().count;
    const memberCode = `DG-${String(count + 1).padStart(4, '0')}`;

    // Store user data in Firestore
    await setDoc(doc(db, "users", user.uid), {
      id: user.uid,
      name,
      username: username.toLowerCase() || email.split('@')[0],
      email,
      phone,
      role,
      memberCode,
      createdAt: new Date().toISOString()
    });

    return { user, role };
  } catch (error) {
    throw error;
  }
};

// Login user
export const loginUser = async (identifier, password) => {
  try {
    let email = identifier;

    // Check if identifier is an email. If not, treat as username
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    if (!isEmail) {
      const q = query(collection(db, "users"), where("username", "==", identifier.toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error("Tên đăng nhập không tồn tại.");
      }
      email = snap.docs[0].data().email;
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch role
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    let role = "user";
    if (userDoc.exists()) {
      role = userDoc.data().role;
    }

    return { user, role };
  } catch (error) {
    throw error;
  }
};

export const loginWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const additionalInfo = getAdditionalUserInfo(result);

    let role = "user";

    if (additionalInfo?.isNewUser) {
      // First time Google login, create user doc
      const snapshot = await getCountFromServer(collection(db, "users"));
      const count = snapshot.data().count;
      const memberCode = `DG-${String(count + 1).padStart(4, '0')}`;

      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        name: user.displayName,
        email: user.email,
        role: "user",
        memberCode,
        createdAt: new Date().toISOString()
      }, { merge: true });
    }

    return { user, role };
  } catch (error) {
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("otp_verified");
    }
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

// Listen to auth state changes
export const subscribeToAuthChanges = (callback) => {
  let unsubscribeSnapshot = null;

  const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    // Dọn dẹp listener cũ nếu có
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      
      // Sử dụng onSnapshot để lắng nghe thay đổi thời gian thực từ Firestore
      unsubscribeSnapshot = onSnapshot(userDocRef, (userDoc) => {
        let role = "user";
        let isLocked = false;
        let memberCode = `DG-${user.uid.slice(-5).toUpperCase()}`;
        let phone = "";
        let username = "";

        if (userDoc.exists()) {
          const userData = userDoc.data();
          role = userData.role || "user";
          isLocked = userData.isLocked || false;
          if (userData.memberCode) memberCode = userData.memberCode;
          if (userData.phone) phone = userData.phone;
          username = userData.username || "";
          
          callback({ user: { ...user, memberCode, phone, username }, role, isLocked });
        } else {
          // Trường hợp user mới (VD: Login Google lần đầu chưa có doc)
          callback({ user: { ...user, memberCode, phone: "", username: "" }, role: "user", isLocked: false });
        }
      }, (error) => {
        console.error("Firestore Snapshot Error:", error);
      });
    } else {
      callback(null);
    }
  });

  // Trả về hàm hủy đăng ký cả Auth và Snapshot
  return () => {
    unsubscribeAuth();
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
};

// Update user profile
export const updateUserProfile = async (uid, data) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    // Update Firebase Auth Profile
    if (data.name) {
      await updateProfile(user, { displayName: data.name });
    }

    // Prepare Firestore update data
    const userDocRef = doc(db, "users", uid);
    const firestoreData = { ...data, id: uid };
    
    // Chỉ thêm name nếu nó được truyền vào (để tránh lỗi undefined in setDoc)
    if (data.name !== undefined) {
      firestoreData.name = data.name;
    }

    await setDoc(userDocRef, firestoreData, { merge: true });

    return true;
  } catch (error) {
    throw error;
  }
};

// Đổi Mật Khẩu
export const updateUserPassword = async (newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");
    await updatePassword(user, newPassword);
    return true;
  } catch (error) {
    throw error;
  }
};

// Đổi Email (Cần đồng bộ cả Auth và Firestore)
export const updateUserEmail = async (uid, newEmail) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");
    
    // Vượt rào Security Mặc định của Firebase bằng Tàu ngầm API (Sử dụng Admin SDK)
    const res = await fetch('/api/user/update-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, newEmail })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Không thể cập nhật Email trên máy chủ");
    }

    return true;
  } catch (error) {
    throw error;
  }
};

// Kiểm tra Tên đăng nhập duy nhất
export const checkUsernameUnique = async (username, currentUid) => {
  try {
    const q = query(
      collection(db, "users"),
      where("username", "==", username.toLowerCase())
    );
    const snapshot = await getDocs(q);
    
    // Nếu trống -> Duy nhất
    if (snapshot.empty) return true;
    
    // Nếu có người dùng trùng, kiểm tra xem có phải là chính mình không
    const otherUser = snapshot.docs.find(doc => doc.id !== currentUid);
    return !otherUser;
  } catch (error) {
    console.error("Check Username Error:", error);
    return false;
  }
};

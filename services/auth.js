import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  updatePassword,
  updateEmail
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, getCountFromServer } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// Register user and store role
export const registerUser = async (email, password, name, role = "user") => {
  try {
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
      email,
      role,
      memberCode
    });

    return { user, role };
  } catch (error) {
    throw error;
  }
};

// Login user
export const loginUser = async (email, password) => {
  try {
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

// Login with Google
export const loginWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user document exists in Firestore
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    
    let role = "user";
    if (userDoc.exists()) {
      role = userDoc.data().role;
    } else {
      // First time Google login, create user doc
      const snapshot = await getCountFromServer(collection(db, "users"));
      const count = snapshot.data().count;
      const memberCode = `DG-${String(count + 1).padStart(4, '0')}`;

      await setDoc(userDocRef, {
        id: user.uid,
        name: user.displayName,
        email: user.email,
        role: "user",
        memberCode,
        createdAt: new Date().toISOString()
      });
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
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      let role = "user";
      let isLocked = false;
      let memberCode = `DG-${user.uid.slice(-5).toUpperCase()}`; // Fallback tức thời
      if (userDoc.exists()) {
        const userData = userDoc.data();
        role = userData.role || "user";
        isLocked = userData.isLocked || false;
        if (userData.memberCode) memberCode = userData.memberCode;
      }
      callback({ user: { ...user, memberCode }, role, isLocked });
    } else {
      callback(null);
    }
  });
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

    // Update Firestore User Doc
    const userDocRef = doc(db, "users", uid);
    await setDoc(userDocRef, {
      ...data,
      name: data.name,
      id: uid
    }, { merge: true });

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

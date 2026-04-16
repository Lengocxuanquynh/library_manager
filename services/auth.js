import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// Register user and store role
export const registerUser = async (email, password, name, role = "user") => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, { displayName: name });

    // Store user data in Firestore
    await setDoc(doc(db, "users", user.uid), {
      id: user.uid,
      name,
      email,
      role
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
      await setDoc(userDocRef, {
        id: user.uid,
        name: user.displayName,
        email: user.email,
        role: "user",
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
      if (userDoc.exists()) {
        const userData = userDoc.data();
        role = userData.role || "user";
        isLocked = userData.isLocked || false;
      }
      callback({ user, role, isLocked });
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

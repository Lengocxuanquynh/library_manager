import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Server-side helper to verify if a userId belongs to an admin.
 * @param {string} userId - The UID to check.
 * @returns {Promise<boolean>} - True if admin, false otherwise.
 */
export async function verifyAdmin(userId) {
  if (!userId) return false;
  
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      return data.role === "admin";
    }
    
    return false;
  } catch (error) {
    console.error("Error verifying admin role:", error);
    return false;
  }
}

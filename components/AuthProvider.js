"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { subscribeToAuthChanges, logoutUser } from "../services/auth";
import { useRouter, usePathname } from "next/navigation";
import { LucidProvider, useLucid } from "./LucidModal";

export { useLucid };

const AuthContext = createContext({
  user: null,
  role: null,
  loading: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((state) => {
      if (state) {
        setUser(state.user);
        setRole(state.role);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading) {
      let isOtpVerified = false;
      if (typeof window !== "undefined") {
        isOtpVerified = localStorage.getItem("otp_verified") === "true";
      }

      // Admin và Google accounts không cần chờ OTP
      const isGoogleLogin = user?.providerData?.some(p => p.providerId === 'google.com');
      const isAdmin = role === "admin" || user?.email === "admin@library.vn";
      
      if (isGoogleLogin || isAdmin) {
        isOtpVerified = true;
      }

      // Kiểm tra hồ sơ hoàn thiện (Username & Phone)
      const isProfileIncomplete = user && !isAdmin && (!user.username || !user.phone);

      if (user && !isOtpVerified) {
        if (pathname !== "/login" && pathname !== "/register") {
          logoutUser();
          router.push("/login");
        }
        return;
      }

      // Ép buộc hoàn thiện hồ sơ nếu thiếu Username/Phone
      if (isProfileIncomplete && pathname !== "/complete-profile") {
        router.push("/complete-profile");
        return;
      }

      if (pathname.startsWith("/admin")) {
        if (!user) {
          router.push("/login");
        } else if (role !== "admin" && user?.email !== "admin@library.vn") {
          router.push("/user");
        }
      } else if (pathname.startsWith("/user")) {
        if (!user) {
          router.push("/login");
        }
      } else if ((pathname === "/login" || pathname === "/register" || pathname === "/complete-profile") && user && isOtpVerified && !isProfileIncomplete) {
        // Already logged in and profile complete, go to dashboard
        router.push((role === "admin" || user?.email === "admin@library.vn") ? "/admin" : "/user");
      }
    }
  }, [user, role, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      <LucidProvider>
        {children}
      </LucidProvider>
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

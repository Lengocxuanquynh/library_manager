"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { subscribeToAuthChanges } from "@/services/auth";
import { useRouter, usePathname } from "next/navigation";

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
      if (pathname.startsWith("/admin") && role !== "admin") {
        router.push("/user");
      } else if (pathname.startsWith("/user") && !user) {
        router.push("/login");
      } else if ((pathname === "/login" || pathname === "/register") && user) {
        // Already logged in, go to dashboard
        router.push(role === "admin" ? "/admin" : "/user");
      }
    }
  }, [user, role, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

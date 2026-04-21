"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";

const CartContext = createContext();

const CART_SEPARATOR = { cartItemId: "cart-separator", isSeparator: true };

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [remainingSlots, setRemainingSlots] = useState(3);

  // Load from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem("library_cart");
      if (stored) {
        let parsed = JSON.parse(stored);
        // Đảm bảo luôn có SEPARATOR trong giỏ
        if (!parsed.some(item => item.isSeparator)) {
          parsed.push(CART_SEPARATOR);
        }
        setCart(parsed);
      } else {
        setCart([CART_SEPARATOR]);
      }
    } catch (error) {
      console.error("Lỗi khi đọc giỏ hàng nội bộ:", error);
      setCart([CART_SEPARATOR]);
    }
  }, []);
  
  // Auto-refresh quota on user mount
  useEffect(() => {
    // We can't access useAuth here due to circular dependency usually, 
    // but we can pass user context from components or just rely on the API.
    // Assuming refreshQuota is called by FloatingCart or other components.
  }, []);

  // Sync quota logic
  const refreshQuota = async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/user/can-borrow-check?userId=${userId}`);
      if (!res.ok) throw new Error("API response error");
      const data = await res.json();
      
      // Debug Log for Admin/Dev
      console.log(`[QUOTA CHECK] User: ${userId} | Remaining: ${data.remaining}`);
      
      if (data.remaining !== undefined) {
        setRemainingSlots(data.remaining);
      }
    } catch (err) {
      console.error("Failed to refresh quota", err);
    }
  };

  // Save to localStorage whenever cart changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("library_cart", JSON.stringify(cart));
    }
  }, [cart, isMounted]);

  const addToCart = (book) => {
    // 1. KIỂM TRA TỒN KHO THỰC TẾ
    const availableQty = (Number(book.quantity) || 0) - (Number(book.damagedCount) || 0);
    const existingCount = cart.filter(item => item.id === book.id).length;

    if (existingCount >= availableQty) {
      toast.error(`Sách này chỉ còn ${availableQty} bản khả dụng. Bạn không thể thêm thêm.`);
      return;
    }

    // 2. THÊM VÀO GIỎ
    setCart((prevCart) => {
      const cartItemId = Math.random().toString(36).substr(2, 9) + Date.now();
      const bookWithId = { ...book, cartItemId };
      
      const separatorIndex = prevCart.findIndex(item => item.isSeparator);
      const itemsBeforeSeparator = separatorIndex === -1 ? prevCart.length : separatorIndex;
      
      let newCart;
      let pos;

      // Nếu vùng mượn còn chỗ trống, chèn vào ngay trước SEPARATOR
      if (itemsBeforeSeparator < remainingSlots) {
        newCart = [...prevCart];
        if (separatorIndex === -1) {
          newCart.push(bookWithId);
        } else {
          newCart.splice(separatorIndex, 0, bookWithId);
        }
        pos = itemsBeforeSeparator + 1;
        toast.success(`Đã thêm cuốn thứ ${pos} vào Vùng mượn!`);
      } else {
        // Nếu vùng mượn đã đầy, chèn vào cuối hàng đợi
        newCart = [...prevCart, bookWithId];
        pos = newCart.length - 1; // Trừ đi separator
        toast.success(`Đã thêm vào Hàng đợi!`);
      }
      
      return newCart;
    });
    
    setIsDrawerOpen(true);
  };

  const removeFromCart = (cartItemId) => {
    if (cartItemId === "cart-separator") return;
    setCart(cart.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => setCart([CART_SEPARATOR]);

  return (
    <CartContext.Provider value={{ cart, setCart, addToCart, removeFromCart, clearCart, isDrawerOpen, setIsDrawerOpen, remainingSlots, refreshQuota }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);

"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem("library_cart");
      if (stored) {
        setCart(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Lỗi khi đọc giỏ hàng nội bộ:", error);
    }
  }, []);

  // Save to localStorage whenever cart changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("library_cart", JSON.stringify(cart));
    }
  }, [cart, isMounted]);

  const addToCart = async (book, userId = null) => {
    // 1. KIỂM TRA TỒN KHO
    if ((book.quantity || 0) <= 0) {
      toast.error(`Sách "${book.title}" hiện đã hết bản cứng trong kho.`);
      return;
    }

    // 2. KIỂM TRA TỔNG GIỚI HẠN (GIỎ HÀNG + ĐƠN CHỜ DUYỆT)
    if (userId) {
      try {
        const res = await fetch(`/api/user/can-borrow-check?userId=${userId}&cartSize=${cart.length}`);
        const data = await res.json();
        if (!data.canAdd) {
          toast.error(data.reason || "Giỏ hàng bị đầy! Bạn có quá nhiều sách đang xử lý.");
          setIsDrawerOpen(true);
          return;
        }
      } catch (err) {
        console.error("Quota check failed", err);
      }
    }

    // 3. KIỂM TRA GIỚI HẠN TẠI CHỖ CỦA GIỎ HÀNG
    if (cart.length >= 3) {
      toast.error("Giỏ hàng đã đầy! Tối đa chỉ được mượn 3 cuốn mỗi đợt.");
      setIsDrawerOpen(true);
      return;
    }
    
    // Tạo ID duy nhất cho mỗi item trong giỏ để cho phép trùng loại sách
    const cartItemId = Math.random().toString(36).substr(2, 9) + Date.now();
    setCart([...cart, { ...book, cartItemId }]);
    
    toast.success(`Đã thêm vào giỏ: ${book.title}`);
    setIsDrawerOpen(true);
  };

  const removeFromCart = (cartItemId) => {
    setCart(cart.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, isDrawerOpen, setIsDrawerOpen }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);

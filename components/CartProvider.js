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

  const addToCart = (book) => {
    if (cart.length >= 3) {
      toast.error("Giỏ hàng đã đầy (tối đa 3 cuốn)");
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

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
      toast.error("Bạn chỉ được mượn tối đa 3 cuốn sách");
      setIsDrawerOpen(true);
      return;
    }
    if (cart.find((item) => item.id === book.id)) {
      toast.info("Sách này đã có trong giỏ");
      return;
    }
    setCart([...cart, book]);
    toast.success(`Đã thêm vào giỏ hàng`);
    setIsDrawerOpen(true);
  };

  const removeFromCart = (bookId) => {
    setCart(cart.filter((item) => item.id !== bookId));
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, isDrawerOpen, setIsDrawerOpen }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);

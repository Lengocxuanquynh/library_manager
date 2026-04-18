"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';

/**
 * PremiumSelect - A custom, high-end select component replacement.
 * Features: Searchable, Glassmorphism design, Smooth animations, Click-outside closing.
 * 
 * @param {Object} props
 * @param {Array} props.options - Array of objects { value, label } or { id, name }
 * @param {string|number} props.value - Current selected value
 * @param {Function} props.onChange - Callback with the new value
 * @param {string} props.placeholder - Text to show when no value is selected
 * @param {string} props.label - Optional label above the select
 * @param {boolean} props.searchable - Whether to show the search input (default: true)
 */
const PremiumSelect = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Chọn...", 
  label,
  searchable = true 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  // Normalize options to { value, label } format
  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      // Handle { id, name } format commonly used in the app
      if (opt.id !== undefined && opt.name !== undefined) {
        return { value: opt.name, label: opt.name };
      }
      // Handle standard { value, label }
      return { 
        value: opt.value ?? opt.name ?? opt, 
        label: opt.label ?? opt.name ?? opt 
      };
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return normalizedOptions;
    return normalizedOptions.filter(opt => 
      String(opt.label).toLowerCase().includes(search.toLowerCase())
    );
  }, [normalizedOptions, search]);

  const selectedLabel = useMemo(() => {
    const found = normalizedOptions.find(opt => opt.value === value);
    return found ? found.label : placeholder;
  }, [normalizedOptions, value, placeholder]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clear search when closing
  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label style={{ 
          display: 'block', 
          marginBottom: '0.6rem', 
          fontSize: '0.85rem', 
          fontWeight: '600',
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.05em'
        }}>
          {label}
        </label>
      )}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          width: '100%', 
          padding: '0.8rem 1.2rem', 
          borderRadius: '14px', 
          background: 'rgba(187, 134, 252, 0.05)', 
          backdropFilter: 'blur(10px)',
          border: `1px solid ${isOpen ? 'rgba(187, 134, 252, 0.5)' : 'rgba(187, 134, 252, 0.2)'}`, 
          color: value ? '#fff' : 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpen ? '0 0 20px rgba(187, 134, 252, 0.15)' : 'none'
        }}
      >
        <span style={{ 
          fontWeight: '600', 
          fontSize: '0.95rem',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {selectedLabel}
        </span>
        <span style={{ 
          fontSize: '0.7rem', 
          opacity: 0.5,
          transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' 
        }}>
          ▼
        </span>
      </div>

      {isOpen && (
        <div style={{ 
          position: 'absolute', 
          top: 'calc(100% + 10px)', 
          left: 0, 
          right: 0, 
          background: 'rgba(25, 25, 28, 0.98)', 
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '0.8rem',
          zIndex: 9999,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
          animation: 'premiumFadeDown 0.3s cubic-bezier(0.165, 0.84, 0.44, 1)'
        }}>
          <style>{`
            @keyframes premiumFadeDown {
              from { opacity: 0; transform: translateY(-10px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .select-option { transition: all 0.2s ease; }
            .select-option:hover { background: rgba(187, 134, 252, 0.1); color: #bb86fc; transform: translateX(5px); }
            .custom-scrollbar::-webkit-scrollbar { width: 5px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
          `}</style>

          {searchable && (
            <div style={{ position: 'relative', marginBottom: '0.8rem' }}>
              <input 
                type="text" 
                placeholder="Tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '0.6rem 2.2rem 0.6rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(187, 134, 252, 0.4)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3, fontSize: '0.8rem' }}>🔍</span>
            </div>
          )}

          <ul className="custom-scrollbar" style={{ 
            maxHeight: '220px', 
            overflowY: 'auto', 
            margin: 0, 
            padding: 0, 
            listStyle: 'none' 
          }}>
            {filteredOptions.length === 0 ? (
              <li style={{ padding: '1rem', textAlign: 'center', opacity: 0.3, fontSize: '0.85rem' }}>Không tìm thấy kết quả</li>
            ) : (
              filteredOptions.map((opt, idx) => (
                <li 
                  key={`${opt.value}-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className="select-option"
                  style={{ 
                    padding: '0.8rem 1rem', 
                    borderRadius: '10px', 
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    marginBottom: '2px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: value === opt.value ? 'rgba(187, 134, 252, 0.15)' : 'transparent',
                    color: value === opt.value ? '#bb86fc' : 'rgba(255,255,255,0.8)',
                    fontWeight: value === opt.value ? '700' : '500'
                  }}
                >
                  {opt.label}
                  {value === opt.value && <span style={{ fontSize: '0.7rem' }}>●</span>}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PremiumSelect;

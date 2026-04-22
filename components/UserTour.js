"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Premium Interactive Tour Component
 * Hand-holding users through the library dashboard.
 */
export default function UserTour({ steps, onComplete, isOpen }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && steps[currentStep]) {
      const updateSpotlight = () => {
        const element = document.getElementById(steps[currentStep].targetId);
        if (element) {
          const rect = element.getBoundingClientRect();
          setSpotlightRect(rect);
          
          // Scroll element into view if needed
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // If element not found, just show center modal
          setSpotlightRect(null);
        }
      };

      updateSpotlight();
      window.addEventListener('resize', updateSpotlight);
      return () => window.removeEventListener('resize', updateSpotlight);
    }
  }, [currentStep, isOpen, steps]);

  if (!isMounted || !isOpen) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const tourUI = (
    <div style={styles.overlay}>
      {/* Background with hole (Spotlight) */}
      <div style={{
        ...styles.spotlightOverlay,
        clipPath: spotlightRect 
          ? `polygon(0% 0%, 0% 100%, ${spotlightRect.left}px 100%, ${spotlightRect.left}px ${spotlightRect.top}px, ${spotlightRect.right}px ${spotlightRect.top}px, ${spotlightRect.right}px ${spotlightRect.bottom}px, ${spotlightRect.left}px ${spotlightRect.bottom}px, ${spotlightRect.left}px 100%, 100% 100%, 100% 0%)`
          : 'none'
      }} />

      {/* Pulsing Border for Spotlight */}
      {spotlightRect && (
        <div style={{
          ...styles.pulseBorder,
          top: spotlightRect.top - 4,
          left: spotlightRect.left - 4,
          width: spotlightRect.width + 8,
          height: spotlightRect.height + 8,
        }} />
      )}

      {/* Tour Content Card */}
      <div style={{
        ...styles.card,
        ...(spotlightRect ? calculateCardPosition(spotlightRect) : styles.centerPosition)
      }} className="glass-card">
        <div style={styles.cardHeader}>
          <div style={styles.stepIndicator}>Bước {currentStep + 1}/{steps.length}</div>
          <button onClick={onComplete} style={styles.closeBtn}>✕</button>
        </div>
        
        <h3 style={styles.title}>{step.title}</h3>
        <p style={styles.description}>{step.description}</p>
        
        <div style={styles.actions}>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            {currentStep > 0 && (
              <button onClick={handlePrev} style={styles.prevBtn}>Quay lại</button>
            )}
            <button onClick={handleNext} style={styles.nextBtn}>
              {isLastStep ? (step.finishText || 'Hoàn tất 🎉') : 'Tiếp theo →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(tourUI, document.body);
}

const calculateCardPosition = (rect) => {
  const windowHeight = window.innerHeight;
  const windowWidth = window.innerWidth;
  
  let top = rect.bottom + 20;
  let left = rect.left;
  
  // If card goes off bottom, show above
  if (top + 250 > windowHeight) {
    top = rect.top - 270;
  }
  
  // Align to center of screen if needed or adjust left/right
  if (left + 350 > windowWidth) {
    left = windowWidth - 370;
  }
  if (left < 20) left = 20;

  return {
    position: 'fixed',
    top: Math.max(20, top),
    left: left,
    width: '350px'
  };
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    pointerEvents: 'none',
  },
  spotlightOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(2px)',
    transition: 'clip-path 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  pulseBorder: {
    position: 'absolute',
    borderRadius: '12px',
    border: '2px solid #bb86fc',
    boxShadow: '0 0 15px #bb86fc',
    animation: 'tour-pulse 2s infinite',
    pointerEvents: 'none',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  card: {
    background: '#1e1e1e',
    borderRadius: '20px',
    padding: '24px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    zIndex: 100000,
    pointerEvents: 'auto',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  centerPosition: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '400px'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  stepIndicator: {
    fontSize: '0.75rem',
    color: '#bb86fc',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    background: 'rgba(187, 134, 252, 0.1)',
    padding: '4px 10px',
    borderRadius: '6px'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: '1.2rem'
  },
  title: {
    color: '#fff',
    fontSize: '1.25rem',
    fontWeight: '800',
    margin: '0 0 12px 0'
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.95rem',
    lineHeight: '1.6',
    margin: '0 0 24px 0'
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  skipBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  prevBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600'
  },
  nextBtn: {
    background: '#bb86fc',
    color: '#000',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '700',
    boxShadow: '0 4px 15px rgba(187, 134, 252, 0.3)'
  }
};

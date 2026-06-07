import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[rgba(155,80,255,0.92)] text-white px-5 py-2 rounded-full font-mono text-xs z-[9999] pointer-events-none whitespace-nowrap shadow-lg">
      {message}
    </div>
  );
};
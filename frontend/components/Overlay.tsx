import React from 'react';

interface OverlayProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Overlay: React.FC<OverlayProps> = ({ title, isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-bg flex flex-col">
      <div className="flex items-center justify-between px-4 h-[58px] shrink-0 border-b border-border bg-[rgba(7,7,15,0.92)]">
        <span className="font-cinzel text-base font-semibold tracking-wide">{title}</span>
        <button 
          onClick={onClose}
          className="bg-transparent border border-border text-dim font-mono text-[9px] tracking-widest px-2 py-1 rounded-md cursor-pointer transition-all hover:border-accent hover:text-accent whitespace-nowrap"
        >
          CLOSE
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </div>
  );
};
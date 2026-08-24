"use client";

import React, { useEffect } from "react";
import { CheckCircle2, X, Sparkles } from "lucide-react";

export interface ToastProps {
  isOpen: boolean;
  type?: "success" | "info" | "warning";
  title: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({
  isOpen,
  type = "success",
  title,
  message,
  onClose,
  duration = 5000,
}: ToastProps) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-toast-in shadow-2xl">
      <div className="relative overflow-hidden rounded-2xl border border-brand-500/40 bg-brand-950/95 backdrop-blur-xl p-4 text-white shadow-glow-blue">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-brand-500 via-gold-400 to-brand-500 animate-pulse" />
        
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-600/20 p-2 text-gold-400 border border-brand-500/30">
            {type === "success" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 pr-2">
            <h4 className="text-sm font-bold text-white">{title}</h4>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed font-normal">{message}</p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-brand-900 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar notificação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

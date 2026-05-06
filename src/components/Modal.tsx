"use client";

import React from "react";
import { CheckCircle2, AlertCircle, HelpCircle, X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "alert" | "confirm" | "error" | "success";
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = "alert",
  onConfirm,
  confirmText = "확인",
  cancelText = "취소",
}: ModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-12 h-12 text-green-400" />;
      case "error":
        return <AlertCircle className="w-12 h-12 text-rose-500" />;
      case "confirm":
        return <HelpCircle className="w-12 h-12 text-cyan-400" />;
      default:
        return <AlertCircle className="w-12 h-12 text-fuchsia-400" />;
    }
  };

  const getButtonStyles = () => {
    switch (type) {
      case "error":
        return "bg-rose-600 hover:bg-rose-500";
      case "confirm":
        return "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500";
      default:
        return "bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="mb-6 p-4 bg-white/5 rounded-3xl">
            {getIcon()}
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
          <p className="text-white/70 leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>

        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex gap-3">
          {type === "confirm" && (
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl text-white font-semibold bg-white/10 hover:bg-white/20 transition-all"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
            className={`flex-1 px-6 py-3 rounded-xl text-white font-bold shadow-lg transform hover:-translate-y-0.5 transition-all ${getButtonStyles()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

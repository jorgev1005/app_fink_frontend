"use client";
import React from "react";
import { createPortal } from "react-dom";

export default function SimpleModal({ open, title, children, onClose, hideFooter }: { open: boolean; title?: string; children: React.ReactNode; onClose: () => void; hideFooter?: boolean }) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 z-10 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-start justify-between mb-4 shrink-0">
          <h3 className="text-xl font-bold text-slate-800">{title || 'Información'}</h3>
          <button aria-label="Cerrar" className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="text-sm text-slate-600 overflow-y-auto">
          {children}
        </div>
        {!hideFooter && (
          <div className="mt-6 flex justify-end pt-4 border-t border-slate-100 shrink-0">
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors">Cerrar</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

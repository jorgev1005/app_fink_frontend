
"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, Delete, GripHorizontal, Move, Copy, Check } from "lucide-react";

interface SimpleCalculatorProps {
  initialValue?: number | string;
  onResult: (val: number) => void;
  onClose: () => void;
}

export default function SimpleCalculator({ initialValue = "", onResult, onClose }: SimpleCalculatorProps) {
  const [display, setDisplay] = useState(String(initialValue || ""));
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dragging state for calculator window
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setOffset({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y,
      });
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    };
  };

  // Close on click outside (only if not dragging)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (document.body.style.cursor === "grabbing" || isDragging) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, isDragging]);

  const handleBtn = (val: string) => {
    if (display === "Error") setDisplay(val);
    else setDisplay(prev => prev + val);
  };

  const handleClear = () => setDisplay("");
  const handleBackspace = () => setDisplay(prev => prev.slice(0, -1));

  const handleEqual = () => {
    try {
      if (!/^[\d+\-*/.() ]+$/.test(display)) return;
      const res = new Function("return " + display)();
      if (isFinite(res)) {
        setDisplay(String(res));
        onResult(Number(res));
      } else {
        setDisplay("Error");
      }
    } catch (e) {
      setDisplay("Error");
    }
  };

  const activeNumber = isNaN(Number(display)) ? display : Number(display).toString();

  const handleDragStart = (e: React.DragEvent) => {
    if (display && display !== "Error") {
      e.dataTransfer.setData("text/plain", display);
      e.dataTransfer.effectAllowed = "copy";
    }
  };

  const btnClass = "h-8 flex items-center justify-center rounded text-xs font-bold transition-colors active:scale-95";
  const numClass = `${btnClass} bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200`;
  const opClass = `${btnClass} bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100`;
  const actionClass = `${btnClass} bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200`;

  return (
    <div 
      ref={containerRef} 
      className="absolute z-[999] mt-2 right-0 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 w-56 animate-in zoom-in-95 origin-top-right transition-shadow"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <div 
        className="flex justify-between items-center mb-3 cursor-grab active:cursor-grabbing p-2 -m-2 rounded bg-slate-100 hover:bg-slate-200 border-b border-slate-200"
        onMouseDown={handleMouseDown}
        title="Arrastrar calculadora"
      >
        <div className="flex items-center gap-1.5 text-slate-400">
          <Move size={14} className="opacity-50" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none">Calculadora</span>
        </div>
        <button 
          onMouseDown={e => e.stopPropagation()} 
          onClick={onClose} 
          className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      
      <div className="flex gap-2 mb-3">
        <div 
          className="bg-amber-50 group border border-amber-200 p-2 rounded-lg flex-1 text-right font-mono text-sm h-9 overflow-hidden flex items-center justify-between text-slate-800 cursor-grab active:cursor-grabbing hover:bg-amber-100 transition-colors shadow-inner"
          draggable
          onDragStart={handleDragStart}
          title="Arrastra este monto o usa el botón copiar"
        >
          <GripHorizontal size={14} className="text-amber-400 group-hover:text-amber-600" />
          <span className="truncate flex-1 select-none">{display || "0"}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); if(display && display!=="Error") { navigator.clipboard.writeText(display); setCopied(true); setTimeout(()=>setCopied(false), 2000); } }}
          className="h-9 w-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition-colors"
          title="Copiar resultado"
        >
          {copied ? <Check size={14} className="text-green-600"/> : <Copy size={14} />}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5" onMouseDown={e => e.stopPropagation()}>
        <button onClick={handleClear} className={`${actionClass} text-red-500`}>C</button>
        <button onClick={() => handleBtn("(")} className={opClass}>(</button>
        <button onClick={() => handleBtn(")")} className={opClass}>)</button>
        <button onClick={() => handleBtn("/")} className={opClass}>÷</button>

        <button onClick={() => handleBtn("7")} className={numClass}>7</button>
        <button onClick={() => handleBtn("8")} className={numClass}>8</button>
        <button onClick={() => handleBtn("9")} className={numClass}>9</button>
        <button onClick={() => handleBtn("*")} className={opClass}>×</button>

        <button onClick={() => handleBtn("4")} className={numClass}>4</button>
        <button onClick={() => handleBtn("5")} className={numClass}>5</button>
        <button onClick={() => handleBtn("6")} className={numClass}>6</button>
        <button onClick={() => handleBtn("-")} className={opClass}>-</button>

        <button onClick={() => handleBtn("1")} className={numClass}>1</button>
        <button onClick={() => handleBtn("2")} className={numClass}>2</button>
        <button onClick={() => handleBtn("3")} className={numClass}>3</button>
        <button onClick={() => handleBtn("+")} className={opClass}>+</button>

        <button onClick={() => handleBtn("0")} className={`col-span-2 ${numClass}`}>0</button>
        <button onClick={() => handleBtn(".")} className={numClass}>.</button>
        <button onClick={handleEqual} className="h-8 flex items-center justify-center rounded text-xs font-bold transition-colors active:scale-95 bg-blue-600 text-white hover:bg-blue-700 shadow-sm">=</button>

        <button onClick={handleBackspace} className={`col-span-4 ${actionClass} mt-1`}><Delete size={14} className="inline mr-1" /> Borrar</button>
      </div>
    </div>
  );
}


"use client";

import React, { useState, useEffect, useRef } from 'react';

export default function VoiceTestPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);
  const [error, setError] = useState('');
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    console.log("Inicializando SpeechRecognition...");
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      const msg = 'Tu navegador no soporta la API de reconocimiento de voz. Intenta en Chrome o Safari iOS.';
      console.error(msg);
      setError(msg);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Cambiamos a true para que escuche más de una frase corta
      recognition.interimResults = true;
      recognition.lang = 'es-ES'; // Can be adjusted to 'es-CO', 'es-MX', etc.

      recognition.onstart = () => {
        console.log("Micrófono activado, escuchando...");
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        console.log("Texto recibido:", currentTranscript);
        setTranscript((prev) => {
          // Simplificado para PoC
          return currentTranscript; 
        });
      };

      recognition.onerror = (event: any) => {
        console.error('Error de reconocimiento:', event.error);
        setError(`Error: ${event.error}`);
        setIsRecording(false);
      };

      recognition.onend = () => {
        console.log("Reconocimiento finalizado.");
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      console.log("SpeechRecognition configurado correctamente.");
    } catch (e: any) {
      console.error("Error al configurar SpeechRecognition:", e);
      setError(`Error interno: ${e.message}`);
    }
  }, []);

  const toggleRecording = () => {
    console.log("Botón presionado. Estado actual isRecording:", isRecording);
    if (!recognitionRef.current) {
      alert("La API de voz no está inicializada o soportada por tu navegador.");
      return;
    }

    if (isRecording) {
      console.log("Deteniendo la grabación...");
      recognitionRef.current.stop();
    } else {
      console.log("Iniciando la grabación...");
      setError('');
      setParsedData(null);
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e: any) {
        console.error("Excepción al iniciar Start():", e);
        setError(`Error al iniciar: ${e.message}`);
      }
    }
  };

  const processText = async () => {
    if (!transcript) return;
    
    // Aquí llamaremos al backend para procesar con IA
    // Por ahora, simularemos la respuesta
    setParsedData({
      status: "Procesando...",
    });

    try {
      // Endpoint que construiremos en el paso 2
      const res = await fetch('/api/voice-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript })
      });
      const data = await res.json();
      setParsedData(data);
    } catch (err: any) {
      setParsedData({ error: "Fallo la conexión con el servidor", detail: err.message });
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto mt-10 bg-white rounded-xl shadow-md font-sans">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Prueba de Ingreso por Voz</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-col items-center mb-6">
        <button
          onClick={toggleRecording}
          className={`w-32 h-32 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg transition-all ${
            isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isRecording ? 'Detener' : 'Hablar'}
        </button>
        <p className="mt-4 text-gray-500">
          {isRecording ? 'Escuchando...' : 'Presiona para hablar'}
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Lo que escuchamos:</label>
        <div className="p-4 bg-gray-50 min-h-24 rounded border border-gray-200">
          {transcript || <span className="text-gray-400 italic">Aquí aparecerá el texto...</span>}
        </div>
      </div>

      <button
        onClick={processText}
        disabled={!transcript || isRecording}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed mb-6"
      >
        Procesar Texto
      </button>

      {parsedData && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Extracción Inteligente:</label>
          <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(parsedData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';

interface InvoiceCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

// Helper: Compress image to avoid large payloads (Nginx 413)
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (file.size < 1024 * 1024) return resolve(file); // Skip if < 1MB
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const MAX = 1200;
        if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
        else if (height > MAX) { width *= MAX / height; height = MAX; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if(ctx) {
            ctx.fillStyle = 'white'; // Prevent black background on transparent PNGs
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((b) => {
                if(b) resolve(new File([b], file.name.replace(/\.[^.]+$/, ".jpg"), {type: 'image/jpeg'}));
                else resolve(file);
            }, 'image/jpeg', 0.8);
        } else resolve(file);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function InvoiceCamera({ onCapture, onClose }: InvoiceCameraProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen es muy grande. Máximo 10MB');
      return;
    }

    setSelectedFile(file);

    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };


  const handleConfirm = async () => {
    if (!selectedFile) return;
    
    setProcessing(true);
    try {
       // Compress before sending
       const compressed = await compressImage(selectedFile);
       onCapture(compressed);
    } catch(e) {
       // Fallback
       onCapture(selectedFile);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">
            📸 Capturar Factura
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {!capturedImage ? (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📷</div>
                <p className="text-gray-600 mb-6">
                  Toma una foto de tu factura o comprobante
                </p>

                {/* Camera Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="camera-input"
                />
                <label
                  htmlFor="camera-input"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition font-medium"
                >
                  📸 Abrir Cámara
                </label>

                {/* Gallery Button */}
                <div className="mt-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="gallery-input"
                  />
                  <label
                    htmlFor="gallery-input"
                    className="inline-block px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 cursor-pointer transition font-medium"
                  >
                    🖼️ Seleccionar de Galería
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">💡 Consejos:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Asegúrate de tener buena iluminación</li>
                  <li>• Mantén la factura plana y visible</li>
                  <li>• Encuadra todo el documento</li>
                  <li>• Evita sombras y reflejos</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="relative">
                <img
                  src={capturedImage}
                  alt="Factura capturada"
                  className="w-full h-auto rounded-lg border-2 border-gray-200"
                />
              </div>

              {processing && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Procesando imagen...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {capturedImage && !processing && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex gap-3">
            <button
              onClick={handleRetake}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              🔄 Tomar Otra
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              ✅ Usar Esta Foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

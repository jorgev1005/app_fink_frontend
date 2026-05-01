import axios from 'axios';
import FormData from 'form-data';

// Usamos el entorno del servidor backend (asegurar que las llaves estén en D:\...backend\.env también si ejecutas desde aquí)
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

/**
 * Recibe un Buffer de audio (en formato .oga de Telegram) 
 * y devuelve el texto transcrito en español usando Whisper en Groq (Gratis y Libre VPN).
 */
export const transcribeAudioOGG = async (audioBuffer: Buffer): Promise<string> => {
  try {
    if (!GROQ_API_KEY) {
      throw new Error("Falta GROQ_API_KEY en las variables de entorno del backend");
    }

    const formData = new FormData();
    // Groq requiere un archivo "virtual". Oga es el predeterminado de las notas de voz de Telegram.
    formData.append('file', audioBuffer, {
      filename: 'voice_note.ogg',
      contentType: 'audio/ogg'
    });
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'es'); // Forzamos español para mejor precisión
    formData.append('response_format', 'text');

    const res = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        ...formData.getHeaders()
      }
    });

    // La API devuelve el texto puro cuando response_format="text"
    return res.data;
  } catch (error: any) {
    console.error("❌ Error transcribiendo audio con Groq:", error?.response?.data || error.message);
    throw new Error("No se pudo transcribir el audio");
  }
};
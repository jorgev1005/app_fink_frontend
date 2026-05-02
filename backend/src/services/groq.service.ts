import axios from 'axios';
import FormData from 'form-data';

// Usamos el entorno del servidor backend (asegurar que las llaves estén en D:\...backend\.env también si ejecutas desde aquí)
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1200;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Recibe un Buffer de audio (en formato .oga de Telegram) 
 * y devuelve el texto transcrito en español usando Whisper en Groq (Gratis y Libre VPN).
 */
export const transcribeAudioOGG = async (audioBuffer: Buffer): Promise<string> => {
  if (!GROQ_API_KEY) {
    throw new Error('Falta GROQ_API_KEY en las variables de entorno del backend');
  }

  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const formData = new FormData();
      // Groq requiere un archivo "virtual". Oga es el predeterminado de las notas de voz de Telegram.
      formData.append('file', audioBuffer, {
        filename: 'voice_note.ogg',
        contentType: 'audio/ogg'
      });
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'es');
      formData.append('response_format', 'text');

      const res = await axios.post(GROQ_TRANSCRIPTION_URL, formData, {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          ...formData.getHeaders()
        },
        timeout: 20000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      return typeof res.data === 'string' ? res.data.trim() : String(res.data || '').trim();
    } catch (error: any) {
      lastError = error;
      const message = error?.response?.data || error?.message || error;
      console.error(`❌ Error transcribiendo audio con Groq (intento ${attempt}/${MAX_RETRIES}):`, message);

      const isRetryable = Boolean(
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ECONNABORTED' ||
        typeof error?.message === 'string' && (
          error.message.includes('ECONNRESET') ||
          error.message.includes('timeout')
        )
      );

      if (!isRetryable || attempt === MAX_RETRIES) {
        break;
      }

      await wait(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(`No se pudo transcribir el audio${lastError?.code ? ` (${lastError.code})` : ''}`);
};
import type { AppSettings } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/** Máximo de caracteres por utterance (límite de algunos navegadores) */
const MAX_BROWSER_CHARS = 280;

let activeUtteranceId = 0;
let chromeKeepAliveTimer: ReturnType<typeof setInterval> | null = null;

export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchServerVoices(): Promise<string[]> {
  const res = await fetch(`${API_URL}/voices`);
  if (!res.ok) throw new Error('No se pudieron cargar las voces del servidor');
  const data = (await res.json()) as { voices: string[] };
  return data.voices;
}

export async function synthesizeServerAudio(
  text: string,
  settings: AppSettings,
): Promise<Blob> {
  const res = await fetch(`${API_URL}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: settings.serverVoice,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { detail?: string }).detail ?? 'Error al sintetizar audio en el servidor',
    );
  }
  return res.blob();
}

/** Espera a que el navegador cargue la lista de voces */
export function waitForVoices(timeoutMs = 4000): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }

    const finish = () => {
      speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve(speechSynthesis.getVoices());
    };

    const onChange = () => {
      if (speechSynthesis.getVoices().length > 0) finish();
    };

    speechSynthesis.addEventListener('voiceschanged', onChange);
    window.setTimeout(finish, timeoutMs);
  });
}

export function getBrowserVoices(): SpeechSynthesisVoice[] {
  const voices = speechSynthesis.getVoices();
  const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  return spanish.length > 0 ? spanish : voices;
}

export async function isBrowserTtsLikelyAvailable(): Promise<boolean> {
  if (!('speechSynthesis' in window)) return false;
  const voices = await waitForVoices(2000);
  return voices.length > 0;
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  settings: AppSettings,
): SpeechSynthesisVoice | null {
  if (settings.voiceUri) {
    const selected = voices.find((v) => v.voiceURI === settings.voiceUri);
    if (selected) return selected;
  }

  const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  const pool = spanish.length > 0 ? spanish : voices;

  return (
    pool.find((v) => v.lang.toLowerCase() === 'es-es') ??
    pool.find((v) => v.lang.toLowerCase().startsWith('es')) ??
    pool[0] ??
    null
  );
}

function browserErrorMessage(error: SpeechSynthesisErrorCode): string {
  switch (error) {
    case 'synthesis-unavailable':
    case 'synthesis-failed':
      return 'Tu navegador no puede sintetizar voz. Usa «Servidor» en ajustes (⚙) o instala voces del sistema (en Arch: speech-dispatcher, espeak-ng).';
    case 'audio-hardware':
      return 'Problema con el audio del sistema. Comprueba altavoces/volumen.';
    case 'not-allowed':
      return 'El navegador bloqueó la voz. Pulsa Reproducir de nuevo tras interactuar con la página.';
    case 'text-too-long':
      return 'Fragmento de texto demasiado largo para el navegador.';
    case 'network':
      return 'La voz del navegador requiere red y falló la conexión.';
  }
  return 'Error en la síntesis de voz del navegador';
}

function isBenignError(error: SpeechSynthesisErrorCode): boolean {
  return error === 'interrupted' || error === 'canceled';
}

function startChromeKeepAlive() {
  if (chromeKeepAliveTimer) return;
  chromeKeepAliveTimer = window.setInterval(() => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    }
  }, 8000);
}

function stopChromeKeepAlive() {
  if (chromeKeepAliveTimer) {
    clearInterval(chromeKeepAliveTimer);
    chromeKeepAliveTimer = null;
  }
}

function normalizeForBrowser(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_BROWSER_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_BROWSER_CHARS)}…`;
}

export function speakInBrowser(
  text: string,
  settings: AppSettings,
  onEnd: () => void,
  onError: (msg: string) => void,
): () => void {
  const utteranceId = ++activeUtteranceId;
  let ended = false;

  const safeEnd = () => {
    if (ended || utteranceId !== activeUtteranceId) return;
    ended = true;
    stopChromeKeepAlive();
    onEnd();
  };

  const safeError = (msg: string) => {
    if (ended || utteranceId !== activeUtteranceId) return;
    ended = true;
    stopChromeKeepAlive();
    onError(msg);
  };

  void (async () => {
    const normalized = normalizeForBrowser(text);
    if (!normalized) {
      safeEnd();
      return;
    }

    const voices = await waitForVoices();
    if (utteranceId !== activeUtteranceId) return;

    const voice = pickVoice(voices, settings);
    if (!voice && voices.length === 0) {
      safeError(
        'No hay voces instaladas en el sistema. En ajustes (⚙) elige «Servidor» o instala: sudo pacman -S speech-dispatcher espeak-ng',
      );
      return;
    }

    speechSynthesis.cancel();

    window.setTimeout(() => {
      if (utteranceId !== activeUtteranceId) return;

      const utterance = new SpeechSynthesisUtterance(normalized);
      utterance.lang = voice?.lang ?? 'es-ES';
      utterance.rate = Math.min(2, Math.max(0.5, settings.speechRate));
      utterance.pitch = Math.min(2, Math.max(0.5, settings.speechPitch));
      if (voice) utterance.voice = voice;

      utterance.onend = () => safeEnd();
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (utteranceId !== activeUtteranceId) return;
        if (isBenignError(event.error)) return;
        safeError(browserErrorMessage(event.error));
      };

      startChromeKeepAlive();
      speechSynthesis.speak(utterance);

      if (!speechSynthesis.speaking && !speechSynthesis.pending) {
        window.setTimeout(() => {
          if (utteranceId !== activeUtteranceId || ended) return;
          if (!speechSynthesis.speaking && !speechSynthesis.pending) {
            safeError(
              'La voz del navegador no arrancó. Usa «Servidor (mejor calidad)» en ajustes (⚙).',
            );
          }
        }, 400);
      }
    }, 80);
  })();

  return () => {
    activeUtteranceId++;
    stopChromeKeepAlive();
    speechSynthesis.cancel();
  };
}

export function playAudioBlob(blob: Blob, onEnd: () => void): () => void {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => {
    URL.revokeObjectURL(url);
    onEnd();
  };
  audio.onerror = () => {
    URL.revokeObjectURL(url);
    onEnd();
  };
  void audio.play().catch(() => onEnd());
  return () => {
    audio.pause();
    URL.revokeObjectURL(url);
  };
}

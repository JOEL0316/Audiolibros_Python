export interface BookPage {
  pageNumber: number;
  text: string;
}

export interface Book {
  id: string;
  title: string;
  fileName: string;
  totalPages: number;
  pages: BookPage[];
  createdAt: number;
  updatedAt: number;
}

export interface ReadingProgress {
  bookId: string;
  currentPage: number;
  /** Índice de frase dentro de la página (modo navegador) */
  sentenceIndex: number;
  updatedAt: number;
}

export type TtsMode = 'browser' | 'server';

export interface AppSettings {
  ttsMode: TtsMode;
  speechRate: number;
  speechPitch: number;
  voiceUri?: string;
  serverVoice: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ttsMode: 'server',
  speechRate: 1,
  speechPitch: 1,
  serverVoice: 'es-ES-ElviraNeural',
};

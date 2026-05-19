import { useCallback, useEffect, useRef, useState } from 'react';
import { splitIntoSentences } from '../services/pdfExtractor';
import {
  checkServerHealth,
  playAudioBlob,
  speakInBrowser,
  synthesizeServerAudio,
} from '../services/ttsService';
import { getProgress, saveProgress } from '../services/storageService';
import type { AppSettings, Book } from '../types';

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'loading';

interface UseAudiobookPlayerOptions {
  book: Book | null;
  settings: AppSettings;
}

export function useAudiobookPlayer({ book, settings }: UseAudiobookPlayerOptions) {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [currentPage, setCurrentPage] = useState(1);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!book) return;
    void getProgress(book.id).then((p) => {
      if (p) {
        setCurrentPage(p.currentPage);
        setSentenceIndex(p.sentenceIndex);
      } else {
        setCurrentPage(1);
        setSentenceIndex(0);
      }
      setStatus('idle');
    });
  }, [book?.id]);

  const persistProgress = useCallback(
    async (page: number, sentence: number) => {
      if (!book) return;
      await saveProgress({
        bookId: book.id,
        currentPage: page,
        sentenceIndex: sentence,
        updatedAt: Date.now(),
      });
    },
    [book],
  );

  const getPageText = useCallback(
    (pageNum: number) => book?.pages.find((p) => p.pageNumber === pageNum)?.text ?? '',
    [book],
  );

  const getSentences = useCallback(
    (pageNum: number) => splitIntoSentences(getPageText(pageNum)),
    [getPageText],
  );

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    speechSynthesis.cancel();
    setStatus('idle');
    pausedRef.current = false;
  }, []);

  const playSentence = useCallback(
    async (page: number, sIdx: number) => {
      if (!book) return;
      const sentences = getSentences(page);
      if (sentences.length === 0) {
        const nextPage = page + 1;
        if (nextPage <= book.totalPages) {
          setCurrentPage(nextPage);
          setSentenceIndex(0);
          await persistProgress(nextPage, 0);
          void playSentence(nextPage, 0);
        } else {
          stop();
        }
        return;
      }

      if (sIdx >= sentences.length) {
        const nextPage = page + 1;
        if (nextPage <= book.totalPages) {
          setCurrentPage(nextPage);
          setSentenceIndex(0);
          await persistProgress(nextPage, 0);
          void playSentence(nextPage, 0);
        } else {
          stop();
        }
        return;
      }

      const text = sentences[sIdx];
      setCurrentPage(page);
      setSentenceIndex(sIdx);
      await persistProgress(page, sIdx);
      setError(null);
      setStatus('loading');

      const onEnd = () => {
        if (pausedRef.current) return;
        const next = sIdx + 1;
        void playSentence(page, next);
      };

      try {
        if (settings.ttsMode === 'server') {
          const ok = await checkServerHealth();
          if (!ok) throw new Error('Servidor TTS no disponible. Activa el backend o usa voz del navegador.');
          const blob = await synthesizeServerAudio(text, settings);
          stopRef.current?.();
          setStatus('playing');
          stopRef.current = playAudioBlob(blob, onEnd);
        } else {
          stopRef.current?.();
          setStatus('playing');
          stopRef.current = speakInBrowser(
            text,
            settings,
            onEnd,
            (msg) => {
              void (async () => {
                const serverOk = await checkServerHealth();
                if (serverOk) {
                  try {
                    setStatus('loading');
                    const blob = await synthesizeServerAudio(text, settings);
                    stopRef.current?.();
                    setError(null);
                    setStatus('playing');
                    stopRef.current = playAudioBlob(blob, onEnd);
                    return;
                  } catch {
                    /* sigue con el mensaje del navegador */
                  }
                }
                setError(
                  serverOk
                    ? `${msg} (tampoco pudo usar el servidor)`
                    : `${msg} Inicia el backend o en ⚙ elige «Servidor».`,
                );
                setStatus('idle');
              })();
            },
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error de reproducción');
        setStatus('idle');
      }
    },
    [book, getSentences, persistProgress, settings, stop],
  );

  const play = useCallback(() => {
    pausedRef.current = false;
    void playSentence(currentPage, sentenceIndex);
  }, [currentPage, sentenceIndex, playSentence]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    stopRef.current?.();
    stopRef.current = null;
    speechSynthesis.cancel();
    setStatus('paused');
  }, []);

  const skipForward = useCallback(() => {
    stop();
    const sentences = getSentences(currentPage);
    const nextIdx = sentenceIndex + 1;
    if (nextIdx < sentences.length) {
      setSentenceIndex(nextIdx);
      void playSentence(currentPage, nextIdx);
    } else if (book && currentPage < book.totalPages) {
      const np = currentPage + 1;
      setCurrentPage(np);
      setSentenceIndex(0);
      void playSentence(np, 0);
    }
  }, [book, currentPage, sentenceIndex, getSentences, playSentence, stop]);

  const skipBackward = useCallback(() => {
    stop();
    if (sentenceIndex > 0) {
      const prev = sentenceIndex - 1;
      setSentenceIndex(prev);
      void playSentence(currentPage, prev);
    } else if (currentPage > 1) {
      const prevPage = currentPage - 1;
      const prevSentences = getSentences(prevPage);
      const last = Math.max(0, prevSentences.length - 1);
      setCurrentPage(prevPage);
      setSentenceIndex(last);
      void playSentence(prevPage, last);
    }
  }, [currentPage, sentenceIndex, getSentences, playSentence, stop]);

  const goToPage = useCallback(
    (page: number) => {
      stop();
      setCurrentPage(page);
      setSentenceIndex(0);
      void persistProgress(page, 0);
    },
    [persistProgress, stop],
  );

  return {
    status,
    currentPage,
    sentenceIndex,
    error,
    currentText: getSentences(currentPage)[sentenceIndex] ?? getPageText(currentPage),
    play,
    pause,
    stop,
    skipForward,
    skipBackward,
    goToPage,
  };
}

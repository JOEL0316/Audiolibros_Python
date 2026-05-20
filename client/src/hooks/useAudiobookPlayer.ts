import { useCallback, useEffect, useRef, useState } from 'react';
import { audioPlayer } from '../services/audioPlayerService';
import {
  clearMediaSession,
  isMobileDevice,
  updateMediaSession,
} from '../services/mediaSessionService';
import { splitIntoSentences } from '../services/pdfExtractor';
import {
  checkServerHealth,
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
  const [notice, setNotice] = useState<string | null>(null);
  const pausedRef = useRef(false);
  const playSentenceRef = useRef<(page: number, idx: number) => void>(() => {});

  const handlersRef = useRef({
    play: () => {},
    pause: () => {},
    next: () => {},
    prev: () => {},
  });

  useEffect(() => {
    if (!book) {
      clearMediaSession();
      return;
    }
    updateMediaSession(
      {
        title: book.title,
        artist: `Página ${currentPage} de ${book.totalPages}`,
        album: 'Audiolibro PDF',
      },
      {
        onPlay: () => handlersRef.current.play(),
        onPause: () => handlersRef.current.pause(),
        onNext: () => handlersRef.current.next(),
        onPrevious: () => handlersRef.current.prev(),
      },
      status === 'playing',
    );
  }, [book, currentPage, status]);

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
    audioPlayer.stop();
    speechSynthesis.cancel();
    setStatus('idle');
    pausedRef.current = false;
    clearMediaSession();
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
          void playSentenceRef.current(nextPage, 0);
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
          void playSentenceRef.current(nextPage, 0);
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
        void playSentenceRef.current(page, sIdx + 1);
      };

      const playWithAudio = async (fallbackNotice?: string) => {
        if (fallbackNotice) setNotice(fallbackNotice);
        const serverOk = await checkServerHealth();
        if (!serverOk) {
          if (isMobileDevice()) {
            setError(
              'Para escuchar con pantalla apagada necesitas el servidor TTS (modo Servidor en ⚙).',
            );
            setStatus('idle');
            return;
          }
          playBrowser(
            'Servidor no disponible. La voz del navegador se detiene al bloquear la pantalla.',
          );
          return;
        }
        try {
          const blob = await synthesizeServerAudio(text, settings);
          if (fallbackNotice) setNotice(fallbackNotice);
          else if (isMobileDevice()) {
            setNotice('Audio en segundo plano: usa los controles de la pantalla de bloqueo.');
          } else {
            setNotice(null);
          }
          setStatus('playing');
          await audioPlayer.playBlob(blob, onEnd);
        } catch {
          playBrowser('Error al generar audio. Usando voz del navegador.');
        }
      };

      const playBrowser = (fallbackNotice?: string) => {
        if (fallbackNotice) setNotice(fallbackNotice);
        if (isMobileDevice()) {
          setNotice(
            'En móvil, la voz del navegador se pausa al apagar la pantalla. Usa modo Servidor con backend activo.',
          );
        }
        setStatus('playing');
        speakInBrowser(
          text,
          settings,
          onEnd,
          (msg) => {
            void playWithAudio(msg);
          },
        );
      };

      try {
        const useServer =
          settings.ttsMode === 'server' || (isMobileDevice() && (await checkServerHealth()));

        if (useServer) {
          await playWithAudio();
        } else {
          const serverOk = await checkServerHealth();
          if (serverOk) {
            await playWithAudio();
          } else {
            playBrowser();
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error de reproducción');
        setStatus('idle');
      }
    },
    [book, getSentences, persistProgress, settings, stop],
  );

  playSentenceRef.current = (page, idx) => {
    void playSentence(page, idx);
  };

  const play = useCallback(() => {
    pausedRef.current = false;
    if (status === 'paused' && audioPlayer.element.src) {
      void audioPlayer.resume().then(() => setStatus('playing'));
      return;
    }
    void playSentence(currentPage, sentenceIndex);
  }, [currentPage, sentenceIndex, playSentence, status]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    audioPlayer.pause();
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

  handlersRef.current = { play, pause, next: skipForward, prev: skipBackward };

  const progressPercent = book
    ? Math.round((currentPage / book.totalPages) * 100)
    : 0;

  return {
    status,
    currentPage,
    sentenceIndex,
    error,
    notice,
    progressPercent,
    currentText: getSentences(currentPage)[sentenceIndex] ?? getPageText(currentPage),
    play,
    pause,
    stop,
    skipForward,
    skipBackward,
    goToPage,
  };
}

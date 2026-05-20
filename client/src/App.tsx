import { useCallback, useEffect, useState } from 'react';
import { BookList } from './components/BookList';
import { FileUpload } from './components/FileUpload';
import { InstallBanner } from './components/InstallBanner';
import { PlayerControls } from './components/PlayerControls';
import { SettingsPanel } from './components/SettingsPanel';
import { useAudiobookPlayer } from './hooks/useAudiobookPlayer';
import { extractTextFromPdf } from './services/pdfExtractor';
import {
  checkServerHealth,
  isBrowserTtsLikelyAvailable,
  isUnreachableLocalApi,
} from './services/ttsService';
import { isMobileDevice } from './services/mediaSessionService';
import {
  deleteBook,
  getBook,
  getProgress,
  getSettings,
  listBooks,
  saveBook,
  saveSettings,
} from './services/storageService';
import { DEFAULT_SETTINGS } from './types';
import type { AppSettings, Book, ReadingProgress } from './types';

function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appNotice, setAppNotice] = useState<string | null>(null);

  const player = useAudiobookPlayer({
    book: activeBook,
    settings: settings ?? DEFAULT_SETTINGS,
  });

  const refreshLibrary = useCallback(async () => {
    const list = await listBooks();
    setBooks(list);
    const map: Record<string, ReadingProgress> = {};
    await Promise.all(
      list.map(async (b) => {
        const p = await getProgress(b.id);
        if (p) map[b.id] = p;
      }),
    );
    setProgressMap(map);
  }, []);

  useEffect(() => {
    void refreshLibrary();
    void (async () => {
      const stored = await getSettings();
      const merged = { ...DEFAULT_SETTINGS, ...stored };
      const serverOk = await checkServerHealth();
      const browserOk = await isBrowserTtsLikelyAvailable();

      if (serverOk) {
        merged.ttsMode = 'server';
        if (isMobileDevice()) {
          setAppNotice(
            'Modo servidor activo: audio en segundo plano y controles en pantalla de bloqueo.',
          );
        }
      } else if (!serverOk && merged.ttsMode === 'server') {
        merged.ttsMode = 'browser';
        await saveSettings(merged);
        setAppNotice(
          isUnreachableLocalApi()
            ? 'Configura VITE_API_URL con tu API en Render para voz en pantalla bloqueada.'
            : 'Servidor TTS no disponible. Usando voz del navegador.',
        );
      } else if (serverOk && !browserOk && merged.ttsMode === 'browser') {
        merged.ttsMode = 'server';
        await saveSettings(merged);
      }

      setSettings(merged);
    })();
  }, [refreshLibrary]);

  const handleFile = async (file: File) => {
    setLoadError(null);
    setLoading(true);
    setUploadProgress(0);
    try {
      const book = await extractTextFromPdf(file, setUploadProgress);
      const hasText = book.pages.some((p) => p.text.length > 0);
      if (!hasText) {
        throw new Error(
          'No se encontró texto en el PDF. Puede ser un escaneo (solo imágenes); se necesitaría OCR.',
        );
      }
      await saveBook(book);
      await refreshLibrary();
      setActiveBook(book);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Error al procesar el PDF');
    } finally {
      setLoading(false);
    }
  };

  const selectBook = async (id: string) => {
    player.stop();
    const book = await getBook(id);
    setActiveBook(book ?? null);
  };

  const handleDelete = async (id: string) => {
    await deleteBook(id);
    if (activeBook?.id === id) {
      player.stop();
      setActiveBook(null);
    }
    await refreshLibrary();
  };

  const updateSettings = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const showMiniPlayer =
    activeBook && (player.status === 'playing' || player.status === 'paused');

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <span className="header__logo" aria-hidden>
            🎧
          </span>
          <div>
            <h1>Audiolibro PDF</h1>
            <p className="header__subtitle">Escucha tus libros</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => setSettingsOpen(true)}
          aria-label="Ajustes"
        >
          ⚙
        </button>
      </header>

      <InstallBanner />

      <main className="main">
        <FileUpload onFileSelect={handleFile} loading={loading} progress={uploadProgress} />

        {loadError && <p className="error-banner">{loadError}</p>}
        {(appNotice || player.notice) && (
          <p className="info-banner">{player.notice ?? appNotice}</p>
        )}

        <section className="card">
          <h2 className="section-title">Biblioteca</h2>
          <BookList
            books={books}
            progressMap={progressMap}
            activeId={activeBook?.id ?? null}
            onSelect={selectBook}
            onDelete={handleDelete}
          />
        </section>

        {activeBook && (
          <section className="card now-playing">
            <h2 className="section-title">Reproduciendo</h2>
            <div className="now-playing__art" aria-hidden>
              📚
            </div>
            <h3 className="now-playing__title">{activeBook.title}</h3>
            <p className="now-playing__page">
              Página {player.currentPage} de {activeBook.totalPages} · {player.progressPercent}%
            </p>
            <p
              className={`now-playing__text ${player.status === 'playing' ? 'now-playing__text--playing' : ''}`}
            >
              {player.currentText || 'Página sin texto legible.'}
            </p>
            {player.error && <p className="error-banner">{player.error}</p>}
            <PlayerControls
              status={player.status}
              currentPage={player.currentPage}
              totalPages={activeBook.totalPages}
              progressPercent={player.progressPercent}
              onPlay={player.play}
              onPause={player.pause}
              onStop={player.stop}
              onSkipBack={player.skipBackward}
              onSkipForward={player.skipForward}
              onPageChange={player.goToPage}
            />
          </section>
        )}
      </main>

      {showMiniPlayer && activeBook && (
        <div className="mini-player">
          <button
            type="button"
            className="player__btn-main"
            style={{ width: 48, height: 48, fontSize: '1.1rem' }}
            onClick={player.status === 'playing' ? player.pause : player.play}
            aria-label={player.status === 'playing' ? 'Pausar' : 'Reproducir'}
          >
            {player.status === 'playing' ? '⏸' : '▶'}
          </button>
          <div className="mini-player__info">
            <div className="mini-player__title">{activeBook.title}</div>
            <div className="mini-player__sub">
              Pág. {player.currentPage}/{activeBook.totalPages}
            </div>
          </div>
        </div>
      )}

      {settings && (
        <SettingsPanel
          settings={settings}
          open={settingsOpen}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;

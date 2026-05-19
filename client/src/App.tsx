import { useCallback, useEffect, useState } from 'react';
import { BookList } from './components/BookList';
import { FileUpload } from './components/FileUpload';
import { PlayerControls } from './components/PlayerControls';
import { SettingsPanel } from './components/SettingsPanel';
import { useAudiobookPlayer } from './hooks/useAudiobookPlayer';
import { extractTextFromPdf } from './services/pdfExtractor';
import { checkServerHealth, isBrowserTtsLikelyAvailable } from './services/ttsService';
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

  const player = useAudiobookPlayer({
    book: activeBook,
    settings: settings ?? { ttsMode: 'browser', speechRate: 1, speechPitch: 1, serverVoice: 'es-ES-ElviraNeural' },
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

      if (serverOk && !browserOk && merged.ttsMode === 'browser') {
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

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Audiolibro PDF</h1>
          <p className="header__subtitle">Lee con los ojos cerrados</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setSettingsOpen(true)}
          aria-label="Ajustes"
        >
          ⚙
        </button>
      </header>

      <main className="main">
        <FileUpload onFileSelect={handleFile} loading={loading} progress={uploadProgress} />
        {loadError && <p className="error-banner">{loadError}</p>}

        <section className="section">
          <h2>Biblioteca</h2>
          <BookList
            books={books}
            progressMap={progressMap}
            activeId={activeBook?.id ?? null}
            onSelect={selectBook}
            onDelete={handleDelete}
          />
        </section>

        {activeBook && (
          <section className="section reader">
            <h2>{activeBook.title}</h2>
            <p className="reader__text">{player.currentText || 'Página sin texto legible.'}</p>
            {player.error && <p className="error-banner">{player.error}</p>}
            <PlayerControls
              status={player.status}
              currentPage={player.currentPage}
              totalPages={activeBook.totalPages}
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

      {settings && (
        <SettingsPanel
          settings={settings}
          open={settingsOpen}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <footer className="footer">
        <p>Instala como app: menú del navegador → Instalar / Añadir a inicio</p>
      </footer>
    </div>
  );
}

export default App;

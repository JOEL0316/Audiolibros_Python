import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, Book, ReadingProgress } from '../types';
import { DEFAULT_SETTINGS } from '../types';

interface AudiolibroDB extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: { 'by-updated': number };
  };
  progress: {
    key: string;
    value: ReadingProgress;
  };
  settings: {
    key: 'app';
    value: AppSettings;
  };
}

const DB_NAME = 'audiolibro-pdf';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AudiolibroDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<AudiolibroDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const books = db.createObjectStore('books', { keyPath: 'id' });
        books.createIndex('by-updated', 'updatedAt');
        db.createObjectStore('progress', { keyPath: 'bookId' });
        db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
}

export async function saveBook(book: Book): Promise<void> {
  const db = await getDb();
  await db.put('books', { ...book, updatedAt: Date.now() });
}

export async function getBook(id: string): Promise<Book | undefined> {
  const db = await getDb();
  return db.get('books', id);
}

export async function listBooks(): Promise<Book[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('books', 'by-updated');
  return all.reverse();
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('books', id);
  await db.delete('progress', id);
}

export async function saveProgress(progress: ReadingProgress): Promise<void> {
  const db = await getDb();
  await db.put('progress', { ...progress, updatedAt: Date.now() });
}

export async function getProgress(bookId: string): Promise<ReadingProgress | undefined> {
  const db = await getDb();
  return db.get('progress', bookId);
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const stored = await db.get('settings', 'app');
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.put('settings', settings, 'app');
}

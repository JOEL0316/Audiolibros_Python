import * as pdfjsLib from 'pdfjs-dist';
import type { Book, BookPage } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function cleanText(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\u00ad/g, '')
    .trim();
}

export async function extractTextFromPdf(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Book> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: BookPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = cleanText(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' '),
    );
    pages.push({ pageNumber: i, text });
    onProgress?.(Math.round((i / pdf.numPages) * 100));
  }

  const title = file.name.replace(/\.pdf$/i, '') || 'Sin título';
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    title,
    fileName: file.name,
    totalPages: pdf.numPages,
    pages,
    createdAt: now,
    updatedAt: now,
  };
}

export function splitIntoSentences(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

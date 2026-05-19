import type { Book, ReadingProgress } from '../types';

interface BookListProps {
  books: Book[];
  progressMap: Record<string, ReadingProgress>;
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BookList({ books, progressMap, activeId, onSelect, onDelete }: BookListProps) {
  if (books.length === 0) {
    return <p className="empty-hint">Aún no hay libros. Sube tu primer PDF arriba.</p>;
  }

  return (
    <ul className="book-list">
      {books.map((book) => {
        const prog = progressMap[book.id];
        const pct = prog
          ? Math.round((prog.currentPage / book.totalPages) * 100)
          : 0;
        return (
          <li key={book.id} className={activeId === book.id ? 'book-item--active' : ''}>
            <button type="button" className="book-item" onClick={() => onSelect(book.id)}>
              <span className="book-item__title">{book.title}</span>
              <span className="book-item__meta">
                {book.totalPages} págs · {pct}% leído
              </span>
            </button>
            <button
              type="button"
              className="book-item__delete"
              aria-label={`Eliminar ${book.title}`}
              onClick={() => onDelete(book.id)}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

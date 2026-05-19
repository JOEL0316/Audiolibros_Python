import type { PlayerStatus } from '../hooks/useAudiobookPlayer';

interface PlayerControlsProps {
  status: PlayerStatus;
  currentPage: number;
  totalPages: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onPageChange: (page: number) => void;
}

export function PlayerControls({
  status,
  currentPage,
  totalPages,
  onPlay,
  onPause,
  onStop,
  onSkipBack,
  onSkipForward,
  onPageChange,
}: PlayerControlsProps) {
  const isPlaying = status === 'playing' || status === 'loading';

  return (
    <div className="player">
      <div className="player__page">
        <label htmlFor="page-slider">Página</label>
        <input
          id="page-slider"
          type="range"
          min={1}
          max={totalPages}
          value={currentPage}
          onChange={(e) => onPageChange(Number(e.target.value))}
        />
        <span>
          {currentPage} / {totalPages}
        </span>
      </div>

      <div className="player__buttons">
        <button type="button" className="btn btn--ghost" onClick={onSkipBack} aria-label="Anterior">
          ⏮
        </button>
        {isPlaying ? (
          <button type="button" className="btn btn--primary" onClick={onPause} aria-label="Pausar">
            ⏸
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={onPlay} aria-label="Reproducir">
            ▶
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onStop} aria-label="Detener">
          ⏹
        </button>
        <button type="button" className="btn btn--ghost" onClick={onSkipForward} aria-label="Siguiente">
          ⏭
        </button>
      </div>

      {status === 'loading' && <p className="player__status">Generando audio…</p>}
    </div>
  );
}

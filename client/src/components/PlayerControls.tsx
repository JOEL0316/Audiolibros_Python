import type { PlayerStatus } from '../hooks/useAudiobookPlayer';

interface PlayerControlsProps {
  status: PlayerStatus;
  currentPage: number;
  totalPages: number;
  progressPercent: number;
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
  progressPercent,
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
        <span>Pág. {currentPage}</span>
        <input
          id="page-slider"
          type="range"
          min={1}
          max={totalPages}
          value={currentPage}
          aria-label="Ir a página"
          onChange={(e) => onPageChange(Number(e.target.value))}
        />
        <span>{totalPages}</span>
      </div>

      <div className="progress-bar" style={{ marginBottom: '1rem' }}>
        <span
          className="progress-bar__fill"
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={progressPercent}
        />
      </div>

      <div className="player__buttons">
        <button type="button" className="player__btn-side" onClick={onSkipBack} aria-label="Anterior">
          ⏮
        </button>
        <button type="button" className="player__btn-side" onClick={onStop} aria-label="Detener">
          ⏹
        </button>
        {isPlaying ? (
          <button type="button" className="player__btn-main" onClick={onPause} aria-label="Pausar">
            ⏸
          </button>
        ) : (
          <button type="button" className="player__btn-main" onClick={onPlay} aria-label="Reproducir">
            ▶
          </button>
        )}
        <button
          type="button"
          className="player__btn-side"
          onClick={onSkipForward}
          aria-label="Siguiente"
        >
          ⏭
        </button>
      </div>

      <p className="player__status">
        {status === 'loading' && 'Generando audio…'}
        {status === 'playing' && 'Reproduciendo — controles en pantalla de bloqueo'}
        {status === 'paused' && 'En pausa'}
        {status === 'idle' && 'Listo para reproducir'}
      </p>
    </div>
  );
}

export interface MediaSessionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export interface MediaSessionMeta {
  title: string;
  artist: string;
  album?: string;
}

export function isMediaSessionSupported(): boolean {
  return 'mediaSession' in navigator;
}

export function updateMediaSession(
  meta: MediaSessionMeta,
  handlers: MediaSessionHandlers,
  playing: boolean,
): void {
  if (!isMediaSessionSupported()) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: meta.title,
    artist: meta.artist,
    album: meta.album ?? 'Audiolibro PDF',
  });

  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';

  try {
    navigator.mediaSession.setActionHandler('play', handlers.onPlay);
    navigator.mediaSession.setActionHandler('pause', handlers.onPause);
    navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
    navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrevious);
    navigator.mediaSession.setActionHandler('seekforward', handlers.onNext);
    navigator.mediaSession.setActionHandler('seekbackward', handlers.onPrevious);
  } catch {
    /* Algunos navegadores no soportan todas las acciones */
  }
}

export function clearMediaSession(): void {
  if (!isMediaSessionSupported()) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
  const actions = [
    'play',
    'pause',
    'nexttrack',
    'previoustrack',
    'seekforward',
    'seekbackward',
  ] as const;
  for (const action of actions) {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch {
      /* ignore */
    }
  }
}

export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

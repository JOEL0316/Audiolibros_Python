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

function getDefaultArtwork(): MediaImage[] {
  if (typeof window === 'undefined') return [];
  return [
    {
      src: `${window.location.origin}/icons/icon-512.png`,
      sizes: '512x512',
      type: 'image/png',
    },
  ];
}

function setMediaSessionAction(
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    /* Algunos navegadores no soportan todas las acciones */
  }
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
    artwork: getDefaultArtwork(),
  });

  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';

  setMediaSessionAction('play', handlers.onPlay);
  setMediaSessionAction('pause', handlers.onPause);
  setMediaSessionAction('stop', handlers.onPause);
  setMediaSessionAction('nexttrack', handlers.onNext);
  setMediaSessionAction('previoustrack', handlers.onPrevious);
  setMediaSessionAction('seekforward', handlers.onNext);
  setMediaSessionAction('seekbackward', handlers.onPrevious);
}

export function clearMediaSession(): void {
  if (!isMediaSessionSupported()) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
  const actions = [
    'play',
    'pause',
    'stop',
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

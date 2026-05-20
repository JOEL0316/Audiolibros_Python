import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBip);
    if (isIos() && !isStandalone()) setShowIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (isStandalone() || dismissed) return null;

  const handleInstall = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setDeferred(null);
      return;
    }
    if (isIos()) setShowIosHint(true);
  };

  return (
    <div className="install-banner">
      <span className="install-banner__icon" aria-hidden>
        📲
      </span>
      <div className="install-banner__body">
        <strong>Instala la app</strong>
        <p>
          {showIosHint && !deferred
            ? 'Safari: Compartir → «Añadir a pantalla de inicio». Así funciona mejor el audio en segundo plano.'
            : 'Acceso rápido, pantalla completa y controles en la pantalla de bloqueo.'}
        </p>
      </div>
      <div className="install-banner__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => void handleInstall()}>
          Instalar
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

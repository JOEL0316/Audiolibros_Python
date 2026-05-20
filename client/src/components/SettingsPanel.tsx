import { useEffect, useState } from 'react';
import type { AppSettings } from '../types';
import {
  checkServerHealth,
  fetchServerVoices,
  getBrowserVoices,
  isBrowserTtsLikelyAvailable,
  waitForVoices,
} from '../services/ttsService';

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ settings, open, onChange, onClose }: SettingsPanelProps) {
  const [serverOnline, setServerOnline] = useState(false);
  const [serverVoices, setServerVoices] = useState<string[]>([]);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [browserTtsOk, setBrowserTtsOk] = useState(true);

  useEffect(() => {
    const loadVoices = async () => {
      await waitForVoices();
      setBrowserVoices(getBrowserVoices());
      setBrowserTtsOk(await isBrowserTtsLikelyAvailable());
    };
    void loadVoices();
    speechSynthesis.onvoiceschanged = () => void loadVoices();
    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void checkServerHealth().then(async (ok) => {
      setServerOnline(ok);
      if (ok) {
        try {
          const voices = await fetchServerVoices();
          setServerVoices(voices.filter((v) => v.startsWith('es')));
        } catch {
          setServerVoices([]);
        }
      }
    });
  }, [open, settings.ttsMode]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal settings"
        role="dialog"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id="settings-title">Ajustes de voz</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div className="settings__group">
          <label className="settings__label">Motor de voz</label>
          <select
            value={settings.ttsMode}
            onChange={(e) =>
              onChange({ ...settings, ttsMode: e.target.value as AppSettings['ttsMode'] })
            }
          >
            <option value="browser">Navegador (sin servidor)</option>
            <option value="server">Servidor (pantalla bloqueada + bloqueo)</option>
          </select>
          <p className="settings__status" style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}>
            Para audio con pantalla apagada y controles en bloqueo, usa modo Servidor (Render).
          </p>
          {settings.ttsMode === 'server' && (
            <p className={`settings__status ${serverOnline ? 'ok' : 'warn'}`}>
              {serverOnline ? 'Servidor conectado' : 'Servidor no disponible — inicia el backend'}
            </p>
          )}
        </div>

        {settings.ttsMode === 'browser' ? (
          <>
            {!browserTtsOk && (
              <p className="settings__status warn">
                Voces del navegador no detectadas. Recomendado: «Servidor (mejor calidad)».
              </p>
            )}
            <div className="settings__group">
              <label className="settings__label" htmlFor="voice-select">
                Voz
              </label>
              <select
                id="voice-select"
                value={settings.voiceUri ?? ''}
                onChange={(e) => onChange({ ...settings, voiceUri: e.target.value || undefined })}
              >
                <option value="">Predeterminada del sistema</option>
                {browserVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
            <div className="settings__group">
              <label htmlFor="rate">Velocidad: {settings.speechRate.toFixed(1)}</label>
              <input
                id="rate"
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={settings.speechRate}
                onChange={(e) => onChange({ ...settings, speechRate: Number(e.target.value) })}
              />
            </div>
            <div className="settings__group">
              <label htmlFor="pitch">Tono: {settings.speechPitch.toFixed(1)}</label>
              <input
                id="pitch"
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={settings.speechPitch}
                onChange={(e) => onChange({ ...settings, speechPitch: Number(e.target.value) })}
              />
            </div>
          </>
        ) : (
          <div className="settings__group">
            <label className="settings__label" htmlFor="server-voice">
              Voz del servidor
            </label>
            <select
              id="server-voice"
              value={settings.serverVoice}
              onChange={(e) => onChange({ ...settings, serverVoice: e.target.value })}
            >
              {serverVoices.length === 0 ? (
                <option value={settings.serverVoice}>{settings.serverVoice}</option>
              ) : (
                serverVoices.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
      </section>
    </div>
  );
}

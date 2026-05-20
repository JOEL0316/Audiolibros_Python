/** Reproductor HTML5 único — necesario para audio en segundo plano y pantalla de bloqueo */
class AudioPlayerService {
  private audio: HTMLAudioElement;
  private objectUrl: string | null = null;
  private onEnd: (() => void) | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.setAttribute('playsinline', 'true');
    this.audio.crossOrigin = 'anonymous';
    this.audio.addEventListener('ended', () => this.onEnd?.());
    this.audio.addEventListener('error', () => this.onEnd?.());
  }

  get element(): HTMLAudioElement {
    return this.audio;
  }

  get isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended;
  }

  private revokeUrl() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  async playBlob(blob: Blob, onEnd: () => void): Promise<void> {
    this.stop();
    this.onEnd = onEnd;
    this.objectUrl = URL.createObjectURL(blob);
    this.audio.src = this.objectUrl;
    await this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  async resume(): Promise<void> {
    if (this.audio.src) await this.audio.play();
  }

  stop() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.revokeUrl();
    this.onEnd = null;
  }
}

export const audioPlayer = new AudioPlayerService();

// Moteur audio HTML5 optimisé et fiable
export class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';

    this.isPlaying = false;
    this.isMuted = false;
    this.maxDuration = 30; // Les extraits iTunes durent 30 secondes
    this.fadeInterval = null;

    this.onTimeUpdateCallback = null;
    this.onEndedCallback = null;
    this.onErrorCallback = null;

    this.audio.addEventListener('timeupdate', () => {
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback({
          currentTime: this.audio.currentTime,
          duration: this.audio.duration || this.maxDuration,
          progress: (this.audio.currentTime / (this.audio.duration || this.maxDuration)) * 100
        });
      }
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('Erreur lecture audio:', e);
      if (this.onErrorCallback) {
        this.onErrorCallback(e);
      }
    });
  }

  setMuted(muted) {
    this.isMuted = muted;
    this.audio.muted = muted;
  }

  // Jouer un morceau
  async playTrack(url) {
    this.stop();

    return new Promise((resolve, reject) => {
      this.audio.src = url;
      this.audio.muted = this.isMuted;
      this.audio.volume = 1.0;
      this.audio.currentTime = 0;

      const onCanPlay = () => {
        this.audio.removeEventListener('canplay', onCanPlay);

        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.isPlaying = true;
              resolve();
            })
            .catch((err) => {
              console.warn('Lecture automatique bloquée par le navigateur:', err);
              this.isPlaying = false;
              reject(err);
            });
        }
      };

      this.audio.addEventListener('canplay', onCanPlay);
      this.audio.load();
    });
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
  }

  resume() {
    if (this.audio.src) {
      this.audio.play();
      this.isPlaying = true;
    }
  }

  // Arrêt propre
  stop() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
  }

  // Fondu de sortie (fade out) lors de la validation d'une réponse
  fadeOut(durationMs = 800) {
    if (!this.isPlaying) return;
    const step = 0.05;
    const intervalTime = durationMs * step;
    
    if (this.fadeInterval) clearInterval(this.fadeInterval);

    this.fadeInterval = setInterval(() => {
      if (this.audio.volume > step) {
        this.audio.volume = Math.max(0, this.audio.volume - step);
      } else {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        this.stop();
        this.audio.volume = 1.0;
      }
    }, intervalTime);
  }

  onTimeUpdate(callback) {
    this.onTimeUpdateCallback = callback;
  }

  onEnded(callback) {
    this.onEndedCallback = callback;
  }

  onError(callback) {
    this.onErrorCallback = callback;
  }
}

export const audioEngine = new AudioEngine();

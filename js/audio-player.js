// Moteur audio HTML5 avec support du départ aléatoire et transitions de volume

export class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';

    this.isPlaying = false;
    this.startMode = 'start'; // 'start' (0s) ou 'random' (milieu de l'extrait)
    this.randomOffset = 0;
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

  setStartMode(mode) {
    this.startMode = mode; // 'start' ou 'random'
  }

  // Jouer un morceau avec gestion du point de départ
  async playTrack(url, startMode = null) {
    this.stop();
    const mode = startMode || this.startMode;

    return new Promise((resolve, reject) => {
      this.audio.src = url;
      this.audio.volume = 1.0;

      const onCanPlay = () => {
        this.audio.removeEventListener('canplay', onCanPlay);

        // Détermination du point de départ
        if (mode === 'random') {
          // Les extraits font 30s. On démarre entre 5s et 15s pour avoir un passage dynamique
          const offset = Math.floor(Math.random() * 10) + 5;
          this.randomOffset = offset;
          try {
            this.audio.currentTime = offset;
          } catch (e) {
            console.warn('Impossible de régler currentTime immédiatement:', e);
          }
        } else {
          this.randomOffset = 0;
          this.audio.currentTime = 0;
        }

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

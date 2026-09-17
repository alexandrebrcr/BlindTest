// Moteur audio HTML5 avec support du départ aléatoire et transitions de volume

export class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';

    this.isPlaying = false;
    this.isMuted = false;
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

  setMuted(muted) {
    this.isMuted = muted;
    this.audio.muted = muted;
  }

  // Jouer un morceau avec gestion du point de départ
  async playTrack(url, startMode = null) {
    this.stop();
    const mode = startMode || this.startMode;

    return new Promise((resolve, reject) => {
      this.audio.src = url;
      this.audio.muted = this.isMuted;
      this.audio.volume = 1.0;

      // Détermination de l'offset cible
      // Extraits iTunes de 30s : on démarre entre 7s et 16s pour tomber directement au milieu/refrain !
      const targetOffset = (mode === 'random')
        ? (Math.floor(Math.random() * 10) + 7) // 7s à 16s
        : 0;

      this.randomOffset = targetOffset;

      const enforceOffset = () => {
        if (targetOffset > 0 && Math.abs(this.audio.currentTime - targetOffset) > 1.5) {
          try {
            this.audio.currentTime = targetOffset;
          } catch (err) {
            console.warn('Erreur réglage currentTime audio:', err);
          }
        }
      };

      // Événement 'playing' : le flux audio a réellement commencé à jouer
      const onPlaying = () => {
        this.audio.removeEventListener('playing', onPlaying);
        enforceOffset();
        setTimeout(enforceOffset, 120);
      };
      this.audio.addEventListener('playing', onPlaying);

      const onCanPlay = () => {
        this.audio.removeEventListener('canplay', onCanPlay);

        if (targetOffset > 0) {
          enforceOffset();
        } else {
          this.audio.currentTime = 0;
        }

        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.isPlaying = true;
              enforceOffset();
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

// Moteur multijoueur : Mode Buzzer sur même écran & Mode Maître du Jeu pour soirées
import { sfx } from './sfx.js';
import { audioEngine } from './audio-player.js';

export const PLAYERS_CONFIG = [
  { id: 1, name: 'Joueur 1', color: '#00f2fe', bgGrad: 'linear-gradient(135deg, #00f2fe, #4facfe)' },
  { id: 2, name: 'Joueur 2', color: '#ff007f', bgGrad: 'linear-gradient(135deg, #ff007f, #7928ca)' },
  { id: 3, name: 'Joueur 3', color: '#ffd200', bgGrad: 'linear-gradient(135deg, #ffd200, #ff6a00)' },
  { id: 4, name: 'Joueur 4', color: '#00ff88', bgGrad: 'linear-gradient(135deg, #00ff88, #00b09b)' }
];

export class BuzzerEngine {
  constructor() {
    this.playerCount = 2; // 2, 3 ou 4 joueurs
    this.players = [];
    this.tracks = [];
    this.currentIndex = 0;
    this.startAudioMode = 'start';
    this.activeBuzzerPlayer = null;
    this.buzzerLocked = false;
    this.answerCountdown = 5;
    this.answerTimer = null;
    this.lockedPlayersThisRound = new Set(); // Joueurs ayant fait une fausse réponse ce tour
    this.isRevealed = false;

    this.onStateChange = null;
    this.onBuzzed = null;
    this.onGameOver = null;
  }

  initSession(tracks, playerCount = 2, startAudioMode = 'start', customNames = []) {
    this.tracks = tracks;
    this.playerCount = playerCount;
    this.startAudioMode = startAudioMode;
    this.currentIndex = 0;
    this.isRevealed = false;

    this.players = PLAYERS_CONFIG.slice(0, playerCount).map((cfg, idx) => ({
      ...cfg,
      name: customNames[idx] || cfg.name,
      score: 0
    }));

    this.loadRound();
  }

  getCurrentTrack() {
    return this.tracks[this.currentIndex];
  }

  loadRound() {
    if (this.currentIndex >= this.tracks.length) {
      this.endGame();
      return;
    }

    this.activeBuzzerPlayer = null;
    this.buzzerLocked = false;
    this.lockedPlayersThisRound.clear();
    this.isRevealed = false;

    const track = this.getCurrentTrack();

    // Démarrage de la musique
    audioEngine.playTrack(track.previewUrl, this.startAudioMode).catch(e => console.warn(e));

    if (this.onStateChange) {
      this.onStateChange({
        type: 'round_started',
        trackIndex: this.currentIndex,
        totalTracks: this.tracks.length,
        track,
        players: this.players,
        activeBuzzerPlayer: null,
        isRevealed: false
      });
    }
  }

  // Clic ou toucher sur un buzzer
  buzz(playerId) {
    if (this.buzzerLocked || this.activeBuzzerPlayer !== null || this.isRevealed) {
      return false;
    }

    // Le joueur a-t-il déjà échoué sur ce morceau ?
    if (this.lockedPlayersThisRound.has(playerId)) {
      return false;
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;

    this.activeBuzzerPlayer = player;
    this.buzzerLocked = true;

    // Pause audio immédiate pour laisser le joueur répondre
    audioEngine.pause();
    sfx.playBuzzer();

    // Compte à rebours de 5 secondes pour donner le titre
    this.answerCountdown = 5;
    if (this.answerTimer) clearInterval(this.answerTimer);

    this.answerTimer = setInterval(() => {
      this.answerCountdown--;
      if (this.answerCountdown <= 0) {
        clearInterval(this.answerTimer);
        // Temps écoulé pour le joueur : considéré comme faux
        this.judgeAnswer(false);
      } else {
        sfx.playTick(true);
        if (this.onStateChange) {
          this.onStateChange({
            type: 'answer_tick',
            countdown: this.answerCountdown,
            player: this.activeBuzzerPlayer
          });
        }
      }
    }, 1000);

    if (this.onBuzzed) {
      this.onBuzzed(player);
    }

    return true;
  }

  // Validation de la réponse orale par le groupe / arbitre
  judgeAnswer(isCorrect) {
    if (this.answerTimer) {
      clearInterval(this.answerTimer);
      this.answerTimer = null;
    }

    if (!this.activeBuzzerPlayer) return;

    if (isCorrect) {
      sfx.playCorrect();
      this.activeBuzzerPlayer.score += 1;
      this.isRevealed = true;
      this.buzzerLocked = true;

      if (this.onStateChange) {
        this.onStateChange({
          type: 'round_resolved',
          winner: this.activeBuzzerPlayer,
          isCorrect: true,
          track: this.getCurrentTrack(),
          players: this.players
        });
      }
    } else {
      sfx.playWrong();
      this.lockedPlayersThisRound.add(this.activeBuzzerPlayer.id);

      const stillCanBuzz = this.players.some(p => !this.lockedPlayersThisRound.has(p.id));

      if (stillCanBuzz) {
        // Relance de la musique pour les autres joueurs !
        this.activeBuzzerPlayer = null;
        this.buzzerLocked = false;
        audioEngine.resume();

        if (this.onStateChange) {
          this.onStateChange({
            type: 'buzz_failed_continue',
            lockedPlayers: Array.from(this.lockedPlayersThisRound),
            players: this.players
          });
        }
      } else {
        // Tout le monde a raté : on révèle la réponse
        this.isRevealed = true;
        this.buzzerLocked = true;
        this.activeBuzzerPlayer = null;

        if (this.onStateChange) {
          this.onStateChange({
            type: 'round_resolved',
            winner: null,
            isCorrect: false,
            track: this.getCurrentTrack(),
            players: this.players
          });
        }
      }
    }
  }

  // Forcer la révélation du morceau (si personne ne sait)
  revealSong() {
    if (this.answerTimer) clearInterval(this.answerTimer);
    this.isRevealed = true;
    this.buzzerLocked = true;
    this.activeBuzzerPlayer = null;

    if (this.onStateChange) {
      this.onStateChange({
        type: 'round_resolved',
        winner: null,
        isCorrect: false,
        track: this.getCurrentTrack(),
        players: this.players
      });
    }
  }

  nextRound() {
    this.currentIndex++;
    this.loadRound();
  }

  endGame() {
    if (this.answerTimer) clearInterval(this.answerTimer);
    audioEngine.stop();
    sfx.playFanfare();

    // Tri des joueurs par score décroissant
    const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);

    if (this.onGameOver) {
      this.onGameOver({
        rankings: sortedPlayers,
        totalTracks: this.tracks.length
      });
    }
  }
}

export const buzzerEngine = new BuzzerEngine();

// Moteur de jeu Solo (QCM 4 choix & Saisie libre avec tolérance orthographique)
import { sfx } from './sfx.js';
import { audioEngine } from './audio-player.js';

// Nettoyage et normalisation de chaîne pour comparaison tolérante
export function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9]/g, ' ')     // Garde lettres et chiffres
    .replace(/\s+/g, ' ')
    .trim();
}

// Distance de Levenshtein pour tolérer les fautes de frappe
export function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // suppression
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Vérification de la réponse saisie par l'utilisateur
export function checkAnswerSimilarity(userInput, targetTitle, targetArtist) {
  const cleanInput = normalizeString(userInput);
  const cleanTitle = normalizeString(targetTitle);
  const cleanArtist = normalizeString(targetArtist);

  if (cleanInput.length < 2) return { isCorrect: false, type: null };

  // 1. Match exact ou inclusion
  if (cleanTitle.includes(cleanInput) || cleanInput.includes(cleanTitle)) {
    return { isCorrect: true, type: 'title' };
  }
  if (cleanArtist.includes(cleanInput) || cleanInput.includes(cleanArtist)) {
    return { isCorrect: true, type: 'artist' };
  }

  // 2. Tolérance aux fautes (Levenshtein)
  const distTitle = levenshteinDistance(cleanInput, cleanTitle);
  const maxAllowedDistTitle = Math.max(1, Math.floor(cleanTitle.length * 0.25));
  if (distTitle <= maxAllowedDistTitle) {
    return { isCorrect: true, type: 'title_approx' };
  }

  const distArtist = levenshteinDistance(cleanInput, cleanArtist);
  const maxAllowedDistArtist = Math.max(1, Math.floor(cleanArtist.length * 0.25));
  if (distArtist <= maxAllowedDistArtist) {
    return { isCorrect: true, type: 'artist_approx' };
  }

  return { isCorrect: false, type: null };
}

export class GameEngine {
  constructor() {
    this.tracks = [];
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.gameMode = 'qcm'; // 'qcm' ou 'text'
    this.roundDuration = 20; // 20 secondes par manche
    this.timeLeft = 20;
    this.timerInterval = null;
    this.isRoundOver = false;
    this.history = [];

    this.onStateChange = null;
    this.onRoundEnd = null;
    this.onGameOver = null;
  }

  startSession(tracks, mode = 'qcm', startMode = 'start') {
    this.tracks = tracks;
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.gameMode = mode;
    this.startAudioMode = startMode;
    this.history = [];
    this.isRoundOver = false;

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

    const track = this.getCurrentTrack();
    this.timeLeft = this.roundDuration;
    this.isRoundOver = false;

    // Démarre la lecture audio avec le mode choisi (standard ou aléatoire)
    audioEngine.playTrack(track.previewUrl, this.startAudioMode).catch((err) => {
      console.warn('Lecture auto:', err);
    });

    // Démarrage du chronomètre
    this.startTimer();

    if (this.onStateChange) {
      this.onStateChange({
        type: 'round_started',
        trackIndex: this.currentIndex,
        totalTracks: this.tracks.length,
        track: track,
        timeLeft: this.timeLeft,
        score: this.score,
        streak: this.streak,
        gameMode: this.gameMode
      });
    }
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.isRoundOver) return;

      this.timeLeft--;

      if (this.timeLeft <= 5 && this.timeLeft > 0) {
        sfx.playTick(true);
      } else if (this.timeLeft > 0) {
        sfx.playTick(false);
      }

      if (this.onStateChange) {
        this.onStateChange({
          type: 'tick',
          timeLeft: this.timeLeft,
          progress: (this.timeLeft / this.roundDuration) * 100
        });
      }

      if (this.timeLeft <= 0) {
        this.submitAnswer(null); // Temps écoulé !
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Soumission d'une réponse (soit un objet option QCM, soit une chaîne saisie)
  submitAnswer(answer) {
    if (this.isRoundOver) return;
    this.isRoundOver = true;
    this.stopTimer();

    const track = this.getCurrentTrack();
    let isCorrect = false;
    let pointsGained = 0;

    if (this.gameMode === 'qcm') {
      if (answer && answer.isCorrect) {
        isCorrect = true;
      }
    } else {
      // Mode Saisie Libre
      if (answer && typeof answer === 'string') {
        const check = checkAnswerSimilarity(answer, track.title, track.artist);
        isCorrect = check.isCorrect;
      }
    }

    if (isCorrect) {
      this.correctCount++;
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;

      // Calcul des points : 100 de base + bonus rapidité + multiplicateur streak
      const speedBonus = Math.round((this.timeLeft / this.roundDuration) * 100);
      const streakMultiplier = this.streak >= 5 ? 2 : this.streak >= 3 ? 1.5 : 1;
      pointsGained = Math.round((100 + speedBonus) * streakMultiplier);
      this.score += pointsGained;

      sfx.playCorrect();
    } else {
      this.streak = 0;
      sfx.playWrong();
    }

    this.history.push({
      track,
      isCorrect,
      userAnswer: answer,
      pointsGained,
      timeLeft: this.timeLeft
    });

    if (this.onRoundEnd) {
      this.onRoundEnd({
        track,
        isCorrect,
        pointsGained,
        score: this.score,
        streak: this.streak,
        chosenAnswer: answer
      });
    }
  }

  nextRound() {
    this.currentIndex++;
    this.loadRound();
  }

  endGame() {
    this.stopTimer();
    audioEngine.stop();
    sfx.playFanfare();

    if (this.onGameOver) {
      this.onGameOver({
        score: this.score,
        correctCount: this.correctCount,
        totalTracks: this.tracks.length,
        accuracy: Math.round((this.correctCount / this.tracks.length) * 100),
        maxStreak: this.maxStreak,
        history: this.history
      });
    }
  }
}

export const gameEngine = new GameEngine();

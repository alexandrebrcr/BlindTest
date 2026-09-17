// Application Principale BlindTest Party - Orchestrateur & UI Controller
import { CATEGORIES, getCategoryById } from './categories.js';
import { preparePlaylist } from './itunes-api.js';
import { audioEngine } from './audio-player.js';
import { sfx } from './sfx.js';
import { gameEngine } from './game-engine.js';
import { buzzerEngine } from './buzzer-engine.js';
import { roomHost, roomClient, PLAYER_COLORS } from './room-peer.js';
import { getGeminiApiKey, setGeminiApiKey, testGeminiApiKey } from './ai-generator.js';

// État Global de l'Application
const state = {
  currentMode: 'qcm',          // 'qcm', 'text', 'buzzer', 'host', 'room-host', 'room-join'
  selectedCategoryId: 'rap_fr',
  trackCount: 10,
  startAudioMode: 'start',     // 'start' (0s) ou 'random' (milieu de l'extrait)
  buzzerPlayerCount: 2,
  clientSelectedColor: PLAYER_COLORS[0].hex,
  currentPlaylist: [],
  hostTeamScores: [
    { name: 'Équipe A', score: 0 },
    { name: 'Équipe B', score: 0 },
    { name: 'Équipe C', score: 0 },
    { name: 'Équipe D', score: 0 }
  ]
};

// ==========================================================================
// 1. Navigation entre écrans
// ==========================================================================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const buzzerScreen = document.getElementById('screen-buzzer');
  if (buzzerScreen) buzzerScreen.classList.remove('active');

  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// ==========================================================================
// ==========================================================================
// PWA Installation & Réglages IA
// ==========================================================================
let deferredPrompt = null;

// Intercepte et bloque TOUTE invite ou notification automatique d'installation de Chrome
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBanner = document.getElementById('pwa-install-banner');
  if (installBanner) installBanner.style.display = 'none';
});

function initPwaInstall() {
  const installBanner = document.getElementById('pwa-install-banner');
  if (installBanner) {
    installBanner.style.display = 'none';
  }

  window.addEventListener('appinstalled', () => {
    if (installBanner) installBanner.style.display = 'none';
    deferredPrompt = null;
  });
}

function initAiSettings() {
  const btnAi = document.getElementById('btn-ai-settings');
  const modalAi = document.getElementById('modal-ai-settings');
  const btnClose = document.getElementById('btn-close-ai-modal');
  const inputKey = document.getElementById('input-gemini-key');
  const btnToggleEye = document.getElementById('btn-toggle-key-visibility');
  const btnTest = document.getElementById('btn-test-gemini-key');
  const btnClear = document.getElementById('btn-clear-gemini-key');
  const btnSave = document.getElementById('btn-save-ai-settings');
  const statusEl = document.getElementById('ai-key-status');

  const updateStatus = () => {
    if (!statusEl) return;
    const key = getGeminiApiKey();
    if (key) {
      statusEl.className = 'ai-key-status success';
      statusEl.textContent = '✅ Clé Google Gemini active (génération < 1s)';
    } else {
      statusEl.className = 'ai-key-status';
      statusEl.textContent = 'ℹ️ Aucune clé (mode IA gratuit automatique activé)';
    }
  };

  const openAiModal = () => {
    if (modalAi) {
      modalAi.classList.add('active');
      modalAi.style.display = 'flex';
    }
    if (inputKey) inputKey.value = getGeminiApiKey();
    updateStatus();
  };

  const closeAiModal = () => {
    if (modalAi) {
      modalAi.classList.remove('active');
      modalAi.style.display = 'none';
    }
  };

  // Expose globalement pour que les déclencheurs HTML fonctionnent en toute circonstance
  window.openAiModal = openAiModal;
  window.closeAiModal = closeAiModal;

  if (btnAi) {
    btnAi.addEventListener('click', (e) => {
      e.preventDefault();
      sfx.init();
      openAiModal();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', closeAiModal);
  }

  if (modalAi) {
    modalAi.addEventListener('click', (e) => {
      if (e.target === modalAi) closeAiModal();
    });
  }

  if (btnToggleEye && inputKey) {
    btnToggleEye.addEventListener('click', () => {
      inputKey.type = inputKey.type === 'password' ? 'text' : 'password';
      btnToggleEye.textContent = inputKey.type === 'password' ? '👁️' : '🙈';
    });
  }

  if (btnTest && inputKey) {
    btnTest.addEventListener('click', async () => {
      const keyVal = inputKey.value.trim();
      if (!keyVal) {
        statusEl.className = 'ai-key-status error';
        statusEl.textContent = '⚠️ Veuillez entrer une clé avant de tester.';
        return;
      }
      statusEl.className = 'ai-key-status loading';
      statusEl.textContent = '⏳ Test de connexion à Google Gemini en cours...';
      btnTest.disabled = true;

      const res = await testGeminiApiKey(keyVal);
      btnTest.disabled = false;
      if (res.success) {
        statusEl.className = 'ai-key-status success';
        statusEl.textContent = res.message;
        setGeminiApiKey(keyVal);
      } else {
        statusEl.className = 'ai-key-status error';
        statusEl.textContent = '❌ ' + (res.message || '');
      }
    });
  }

  if (btnClear && inputKey) {
    btnClear.addEventListener('click', () => {
      inputKey.value = '';
      setGeminiApiKey('');
      updateStatus();
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      if (inputKey) setGeminiApiKey(inputKey.value);
      closeAiModal();
    });
  }
}

// 2. Initialisation des Catégories & Sélecteurs
// ==========================================================================
function initCategories() {
  const container = document.getElementById('categories-container');
  if (!container) return;

  container.innerHTML = CATEGORIES.map((cat, idx) => `
    <div class="cat-card ${cat.id === state.selectedCategoryId ? 'selected' : ''}" data-cat-id="${cat.id}">
      <span class="cat-icon">${cat.icon}</span>
      <div class="cat-info">
        <span class="cat-name">${cat.name}</span>
        <span class="cat-sub">${cat.description}</span>
      </div>
    </div>
  `).join('');

  const customThemeBox = document.getElementById('box-custom-theme');
  const customThemeInput = document.getElementById('input-custom-theme');

  // Gestion de la visibilité de l'encart Thème Personnalisé IA
  const updateCustomThemeVisibility = (catId) => {
    if (customThemeBox) {
      if (catId === 'custom_theme') {
        customThemeBox.style.display = 'block';
        if (customThemeInput) {
          customThemeInput.focus();
        }
      } else {
        customThemeBox.style.display = 'none';
      }
    }
  };

  // Clic sur les suggestions de thèmes
  document.querySelectorAll('.theme-suggest-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      sfx.init();
      if (customThemeInput) {
        customThemeInput.value = pill.dataset.theme;
        customThemeInput.focus();
      }
    });
  });

  container.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', () => {
      sfx.init();
      container.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedCategoryId = card.dataset.catId;
      updateCustomThemeVisibility(state.selectedCategoryId);
    });
  });

  updateCustomThemeVisibility(state.selectedCategoryId);
}

function initSettings() {
  // Sélection du mode de jeu
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      sfx.init();
      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.currentMode = card.dataset.mode;

      const rowPlayerCount = document.getElementById('row-player-count');
      if (rowPlayerCount) {
        rowPlayerCount.style.display = (state.currentMode === 'buzzer' || state.currentMode === 'host') ? 'flex' : 'none';
      }

      const btnStart = document.getElementById('btn-start-game');
      if (state.currentMode === 'room-host') {
        btnStart.innerHTML = '<span>CRÉER LE SALON EN LIGNE</span> 🌐';
      } else if (state.currentMode === 'room-join') {
        showScreen('screen-room-client-join');
      } else {
        btnStart.innerHTML = '<span>LANCER LA PARTIE</span> 🎵';
      }
    });
  });

  // Nombre de morceaux
  const trackCountOpts = document.querySelectorAll('#opt-track-count .pill-option');
  trackCountOpts.forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.init();
      trackCountOpts.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.trackCount = parseInt(btn.dataset.value, 10);
    });
  });

  // Départ audio (Classique 0s vs Aléatoire)
  const startModeOpts = document.querySelectorAll('#opt-start-mode .pill-option');
  startModeOpts.forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.init();
      startModeOpts.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.startAudioMode = btn.dataset.value;
    });
  });

  // Nombre de joueurs pour le buzzer
  const playerCountOpts = document.querySelectorAll('#opt-player-count .pill-option');
  playerCountOpts.forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.init();
      playerCountOpts.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.buzzerPlayerCount = parseInt(btn.dataset.value, 10);
    });
  });

  // Bouton Lancer la partie
  document.getElementById('btn-start-game').addEventListener('click', () => {
    if (state.currentMode === 'room-host') {
      initRoomHostFlow();
    } else if (state.currentMode === 'room-join') {
      showScreen('screen-room-client-join');
    } else {
      startGame();
    }
  });

  // Boutons Retour Accueil & Rejouer
  document.getElementById('btn-brand-home').addEventListener('click', () => {
    audioEngine.stop();
    gameEngine.stopTimer();
    showScreen('screen-home');
  });

  document.getElementById('btn-back-menu').addEventListener('click', () => {
    showScreen('screen-home');
  });

  document.getElementById('btn-replay-same').addEventListener('click', startGame);

  // Boutons pour quitter les écrans salon
  document.getElementById('btn-quit-lobby').onclick = () => {
    roomHost.destroy();
    showScreen('screen-home');
  };

  document.getElementById('btn-quit-client-join').onclick = () => {
    showScreen('screen-home');
  };

  // Toggle Son (Bruitages ET Musique)
  const btnSound = document.getElementById('btn-sound-toggle');
  btnSound.addEventListener('click', () => {
    const willMute = sfx.enabled; // Si le son était activé, on mute
    sfx.enabled = !willMute;
    audioEngine.setMuted(willMute);
    btnSound.textContent = willMute ? '🔇' : '🔊';
  });

  // Modale d'instructions
  const modalInfo = document.getElementById('modal-instructions');
  document.getElementById('btn-info-modal').addEventListener('click', () => {
    modalInfo.classList.add('active');
  });
  document.getElementById('btn-close-instructions').addEventListener('click', () => {
    modalInfo.classList.remove('active');
  });

  // Sélecteur de couleur pour le client
  initColorPicker();
  initRoomClientJoinForm();
}

// ==========================================================================
// 3. Lancement de la Partie & Chargement
// ==========================================================================
async function startGame() {
  sfx.init();
  const category = getCategoryById(state.selectedCategoryId);

  const customPrompt = state.selectedCategoryId === 'custom_theme'
    ? (document.getElementById('input-custom-theme')?.value.trim() || null)
    : null;

  showScreen('screen-loading');
  const catDisplayName = (state.selectedCategoryId === 'custom_theme' && customPrompt)
    ? `✨ ${customPrompt}`
    : `${category.icon} ${category.name}`;
  document.getElementById('loading-category-name').textContent = catDisplayName;
  document.getElementById('loading-subtext').textContent = 'Extraction des pépites musicales...';
  const progressFill = document.getElementById('loading-progress-fill');
  progressFill.style.width = '10%';

  try {
    const tracks = await preparePlaylist(category, state.trackCount, (percent, msg) => {
      progressFill.style.width = `${Math.max(10, percent)}%`;
      if (msg) {
        document.getElementById('loading-subtext').textContent = msg;
      }
    }, customPrompt);

    if (!tracks || tracks.length === 0) {
      alert("Impossible de charger les morceaux pour cette catégorie. Vérifiez votre connexion internet.");
      showScreen('screen-home');
      return;
    }

    state.currentPlaylist = tracks;

    if (state.currentMode === 'buzzer') {
      startBuzzerGame(tracks);
    } else if (state.currentMode === 'host') {
      startHostGame(tracks);
    } else {
      startSoloGame(tracks);
    }
  } catch (err) {
    console.error('Erreur au lancement:', err);
    alert("Une erreur est survenue lors du chargement des morceaux.");
    showScreen('screen-home');
  }
}

// ==========================================================================
// 4. Mode Solo (QCM & Saisie Libre)
// ==========================================================================
function startSoloGame(tracks) {
  showScreen('screen-solo');

  const qcmContainer = document.getElementById('solo-qcm-container');
  const textForm = document.getElementById('solo-text-form');
  const textInput = document.getElementById('solo-text-input');
  const btnNext = document.getElementById('btn-solo-next');
  const btnSkip = document.getElementById('btn-solo-skip');
  const vinylCover = document.getElementById('solo-album-cover');
  const mysteryIcon = document.getElementById('solo-mystery-icon');
  const vinylDisc = document.getElementById('solo-vinyl-disc');
  const timerFill = document.getElementById('solo-timer-fill');

  qcmContainer.style.display = state.currentMode === 'qcm' ? 'grid' : 'none';
  textForm.style.display = state.currentMode === 'text' ? 'flex' : 'none';

  // Réaction aux événements du moteur de jeu
  gameEngine.onStateChange = (e) => {
    if (e.type === 'round_started') {
      document.getElementById('solo-round-display').textContent = `Manche ${e.trackIndex + 1} / ${e.totalTracks}`;
      document.getElementById('solo-score-display').textContent = `${e.score} pts`;

      const streakBadge = document.getElementById('solo-streak-badge');
      if (e.streak >= 2) {
        streakBadge.style.display = 'flex';
        streakBadge.textContent = `🔥 x${e.streak >= 5 ? 2 : 1.5}`;
      } else {
        streakBadge.style.display = 'none';
      }

      // Réinitialisation de la pochette et du vinyle
      vinylCover.src = e.track.artworkUrl || './assets/icons/icon.svg';
      vinylCover.classList.remove('revealed');
      mysteryIcon.classList.remove('hidden');
      vinylDisc.classList.add('spinning');

      // Réinitialisation des textes
      document.getElementById('solo-reveal-title').textContent = 'Écoutez bien...';
      document.getElementById('solo-reveal-artist').textContent = 'Quel est ce titre / artiste ?';
      document.getElementById('solo-reveal-meta').textContent = '';

      btnNext.style.display = 'none';
      btnSkip.style.display = 'block';

      // Remplissage QCM
      if (state.currentMode === 'qcm') {
        qcmContainer.innerHTML = e.track.options.map((opt, i) => `
          <button class="qcm-btn" data-index="${i}">
            <div>
              <div class="qcm-btn-title">${opt.title}</div>
              <div class="qcm-btn-artist">${opt.artist}</div>
            </div>
            <span class="qcm-icon">🎵</span>
          </button>
        `).join('');

        qcmContainer.querySelectorAll('.qcm-btn').forEach((btn, idx) => {
          btn.addEventListener('click', () => {
            const chosen = e.track.options[idx];
            gameEngine.submitAnswer(chosen);
          });
        });
      } else {
        textInput.value = '';
        textInput.focus();
      }
    } else if (e.type === 'tick') {
      timerFill.style.width = `${e.progress}%`;
      if (e.timeLeft <= 5) {
        timerFill.classList.add('urgent');
      } else {
        timerFill.classList.remove('urgent');
      }
    }
  };

  // Résolution de manche
  gameEngine.onRoundEnd = (res) => {
    // Dévoilement visuel
    vinylCover.classList.add('revealed');
    mysteryIcon.classList.add('hidden');
    timerFill.style.width = '0%';

    document.getElementById('solo-reveal-title').textContent = res.track.title;
    document.getElementById('solo-reveal-artist').textContent = res.track.artist;
    document.getElementById('solo-reveal-meta').textContent = `Sortie en ${res.track.year || 'Inconnue'} • ${res.track.genre || ''}`;

    document.getElementById('solo-score-display').textContent = `${res.score} pts`;

    // Coloration des boutons QCM
    if (state.currentMode === 'qcm') {
      const qcmBtns = qcmContainer.querySelectorAll('.qcm-btn');
      qcmBtns.forEach((btn, idx) => {
        btn.disabled = true;
        const opt = res.track.options[idx];
        if (opt.isCorrect) {
          btn.classList.add('correct');
        } else if (res.chosenAnswer && res.chosenAnswer.title === opt.title && !opt.isCorrect) {
          btn.classList.add('wrong');
        }
      });
    }

    btnSkip.style.display = 'none';
    btnNext.style.display = 'block';
  };

  // Fin de partie
  gameEngine.onGameOver = (summary) => {
    showScreen('screen-gameover');
    document.getElementById('gameover-score').textContent = summary.score;
    document.getElementById('gameover-accuracy').textContent = `${summary.accuracy}%`;
    document.getElementById('gameover-correct').textContent = `${summary.correctCount}/${summary.totalTracks}`;
    document.getElementById('gameover-maxstreak').textContent = summary.maxStreak;

    // Historique des morceaux avec réécoute
    const listEl = document.getElementById('gameover-history-list');
    listEl.innerHTML = summary.history.map(item => `
      <div class="history-item">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <img src="${item.track.artworkUrl}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover;">
          <div>
            <div style="font-weight: 700;">${item.track.title}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${item.track.artist} (${item.track.year})</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button class="icon-btn btn-history-play" data-url="${item.track.previewUrl}" style="width: 32px; height: 32px; font-size: 0.8rem;" title="Réécouter">▶️</button>
          <span class="history-status">${item.isCorrect ? '✅' : '❌'}</span>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.btn-history-play').forEach(btn => {
      btn.addEventListener('click', () => {
        audioEngine.playTrack(btn.dataset.url, 'start');
      });
    });
  };

  // Validation formulaire saisie libre
  textForm.onsubmit = (e) => {
    e.preventDefault();
    const val = textInput.value.trim();
    if (val.length > 0) {
      gameEngine.submitAnswer(val);
    }
  };

  // Bouton suivant & passer
  btnNext.onclick = () => gameEngine.nextRound();
  btnSkip.onclick = () => gameEngine.submitAnswer(null);

  // Lancement
  gameEngine.startSession(tracks, state.currentMode, state.startAudioMode);
}

// ==========================================================================
// 5. Mode Multijoueur Buzzer (2 à 4 joueurs sur un même écran)
// ==========================================================================
function startBuzzerGame(tracks) {
  const buzzerScreen = document.getElementById('screen-buzzer');
  buzzerScreen.classList.add('active');

  const buzzersContainer = document.getElementById('buzzers-container');
  const buzzerModal = document.getElementById('buzzer-modal');
  const buzzerRevealModal = document.getElementById('buzzer-reveal-modal');

  // Ajustement de la classe CSS selon le nombre de joueurs (2, 3 ou 4)
  buzzersContainer.className = `buzzers-layout players-${state.buzzerPlayerCount}`;

  // Génération des quadrants de buzzers
  const pColors = ['buzzer-p1', 'buzzer-p2', 'buzzer-p3', 'buzzer-p4'];
  buzzersContainer.innerHTML = Array.from({ length: state.buzzerPlayerCount }).map((_, i) => `
    <div class="buzzer-quadrant ${pColors[i]}" data-player-id="${i + 1}" id="buzzer-pad-${i + 1}">
      <div class="buzzer-content">
        <div class="buzzer-player-name">Joueur ${i + 1}</div>
        <div class="buzzer-score-pill"><span id="buzzer-score-val-${i + 1}">0</span> pts</div>
        <div class="buzzer-action-label">BUZZ !</div>
      </div>
    </div>
  `).join('');

  // Gestion des appuis tactiles / clics sur les buzzers
  buzzersContainer.querySelectorAll('.buzzer-quadrant').forEach(pad => {
    const handleBuzz = (e) => {
      e.preventDefault();
      const pId = parseInt(pad.dataset.playerId, 10);
      buzzerEngine.buzz(pId);
    };
    pad.addEventListener('touchstart', handleBuzz, { passive: false });
    pad.addEventListener('mousedown', handleBuzz);
  });

  // Réactions aux événements du buzzer engine
  buzzerEngine.onStateChange = (evt) => {
    if (evt.type === 'round_started') {
      document.getElementById('buzzer-hud-round').textContent = `Manche ${evt.trackIndex + 1} / ${evt.totalTracks}`;
      document.getElementById('buzzer-hud-status').textContent = 'Écoutez et buzzez !';
      buzzerModal.classList.remove('active');
      buzzerRevealModal.classList.remove('active');

      // Mise à jour des scores affichés sur chaque buzzer
      evt.players.forEach(p => {
        const el = document.getElementById(`buzzer-score-val-${p.id}`);
        if (el) el.textContent = p.score;
        const pad = document.getElementById(`buzzer-pad-${p.id}`);
        if (pad) pad.classList.remove('locked-out');
      });
    } else if (evt.type === 'answer_tick') {
      document.getElementById('buzz-modal-countdown').textContent = evt.countdown;
    } else if (evt.type === 'buzz_failed_continue') {
      buzzerModal.classList.remove('active');
      evt.lockedPlayers.forEach(pId => {
        const pad = document.getElementById(`buzzer-pad-${pId}`);
        if (pad) pad.classList.add('locked-out');
      });
      document.getElementById('buzzer-hud-status').textContent = 'Reprise ! Les autres peuvent buzzer.';
    } else if (evt.type === 'round_resolved') {
      buzzerModal.classList.remove('active');
      buzzerRevealModal.classList.add('active');

      document.getElementById('buzzer-reveal-img').src = evt.track.artworkUrl || './assets/icons/icon.svg';
      document.getElementById('buzzer-reveal-title').textContent = evt.track.title;
      document.getElementById('buzzer-reveal-artist').textContent = evt.track.artist;
      document.getElementById('buzzer-reveal-meta').textContent = `${evt.track.year || ''} • ${evt.track.genre || ''}`;

      const pointAwardedEl = document.getElementById('buzzer-point-awarded');
      if (evt.winner) {
        pointAwardedEl.textContent = `🎉 +1 point pour ${evt.winner.name} !`;
        pointAwardedEl.style.color = evt.winner.color;
      } else {
        pointAwardedEl.textContent = '🤷‍♂️ Aucun point attribué ce tour.';
        pointAwardedEl.style.color = 'var(--text-muted)';
      }
    }
  };

  buzzerEngine.onBuzzed = (player) => {
    buzzerModal.classList.add('active');
    const winnerEl = document.getElementById('buzz-winner-name');
    winnerEl.textContent = `${player.name} a buzzé !`;
    winnerEl.style.color = player.color;
    document.getElementById('buzz-modal-countdown').textContent = '5';
  };

  // Boutons du verdict de l'arbitre
  document.getElementById('btn-buzz-correct').onclick = () => buzzerEngine.judgeAnswer(true);
  document.getElementById('btn-buzz-wrong').onclick = () => buzzerEngine.judgeAnswer(false);

  // Bouton "Personne ne sait"
  document.getElementById('btn-buzzer-nobody').onclick = () => buzzerEngine.revealSong();

  // Bouton Morceau suivant du mode buzzer
  document.getElementById('btn-buzzer-next-round').onclick = () => buzzerEngine.nextRound();

  // Bouton Quitter
  document.getElementById('btn-buzzer-exit').onclick = () => {
    audioEngine.stop();
    buzzerScreen.classList.remove('active');
    showScreen('screen-home');
  };

  buzzerEngine.onGameOver = (res) => {
    buzzerScreen.classList.remove('active');
    showScreen('screen-gameover');

    const winner = res.rankings[0];
    document.getElementById('gameover-score').textContent = winner ? winner.score : 0;
    document.getElementById('gameover-accuracy').textContent = winner ? winner.name : 'Égalité';
    document.getElementById('gameover-correct').textContent = `${res.totalTracks} manches`;
    document.getElementById('gameover-maxstreak').textContent = 'Podium';

    const listEl = document.getElementById('gameover-history-list');
    listEl.innerHTML = res.rankings.map((p, idx) => `
      <div class="history-item">
        <div style="font-weight: 800; font-size: 1.1rem; color: ${p.color};">
          #${idx + 1} ${p.name}
        </div>
        <div style="font-size: 1.1rem; font-weight: 900;">${p.score} pts</div>
      </div>
    `).join('');
  };

  buzzerEngine.initSession(tracks, state.buzzerPlayerCount, state.startAudioMode);
}

// ==========================================================================
// 6. Mode Maître du Jeu (Soirées & Enceinte Bluetooth)
// ==========================================================================
function startHostGame(tracks) {
  showScreen('screen-host');
  let currentTrackIdx = 0;

  const roundDisplay = document.getElementById('host-round-display');
  const secretBox = document.getElementById('host-secret-box');
  const revealedBox = document.getElementById('host-revealed-box');
  const btnPlayPause = document.getElementById('btn-host-playpause');
  const btnNext = document.getElementById('btn-host-next');
  const btnRewind = document.getElementById('btn-host-rewind');
  const btnReveal = document.getElementById('btn-host-reveal-toggle');

  // Initialisation des équipes
  const teamsContainer = document.getElementById('host-teams-container');
  const colors = ['#00f2fe', '#ff007f', '#ffd200', '#00ff88'];
  
  function renderTeams() {
    teamsContainer.innerHTML = state.hostTeamScores.slice(0, state.buzzerPlayerCount).map((t, idx) => `
      <div class="glass-card" style="padding: 0.8rem; text-align: center; border-color: ${colors[idx]}">
        <div style="font-weight: 800; color: ${colors[idx]}; margin-bottom: 0.3rem;">${t.name}</div>
        <div style="font-size: 1.6rem; font-weight: 900; margin-bottom: 0.4rem;" id="team-score-${idx}">${t.score}</div>
        <div style="display: flex; justify-content: center; gap: 0.4rem;">
          <button class="icon-btn btn-team-sub" data-team="${idx}" style="width: 32px; height: 32px;">-</button>
          <button class="icon-btn btn-team-add" data-team="${idx}" style="width: 32px; height: 32px; background: ${colors[idx]}; color: #000; font-weight: 800;">+</button>
        </div>
      </div>
    `).join('');

    teamsContainer.querySelectorAll('.btn-team-add').forEach(b => {
      b.onclick = () => {
        const teamIdx = parseInt(b.dataset.team, 10);
        state.hostTeamScores[teamIdx].score++;
        sfx.playCorrect();
        renderTeams();
      };
    });

    teamsContainer.querySelectorAll('.btn-team-sub').forEach(b => {
      b.onclick = () => {
        const teamIdx = parseInt(b.dataset.team, 10);
        state.hostTeamScores[teamIdx].score = Math.max(0, state.hostTeamScores[teamIdx].score - 1);
        renderTeams();
      };
    });
  }

  function loadHostTrack(index) {
    if (index >= tracks.length) {
      sfx.playFanfare();
      alert("Toutes les musiques de la session ont été jouées !");
      showScreen('screen-home');
      return;
    }

    currentTrackIdx = index;
    const track = tracks[currentTrackIdx];
    roundDisplay.textContent = `Morceau ${currentTrackIdx + 1} / ${tracks.length}`;

    secretBox.style.display = 'block';
    revealedBox.style.display = 'none';

    document.getElementById('host-cover-img').src = track.artworkUrl || './assets/icons/icon.svg';
    document.getElementById('host-track-title').textContent = track.title;
    document.getElementById('host-track-artist').textContent = track.artist;
    document.getElementById('host-track-year').textContent = `${track.year || ''} • ${track.genre || ''}`;

    audioEngine.playTrack(track.previewUrl, state.startAudioMode);
    btnPlayPause.textContent = '⏸️';
  }

  btnReveal.onclick = () => {
    secretBox.style.display = 'none';
    revealedBox.style.display = 'block';
  };

  btnPlayPause.onclick = () => {
    if (audioEngine.isPlaying) {
      audioEngine.pause();
      btnPlayPause.textContent = '▶️';
    } else {
      audioEngine.resume();
      btnPlayPause.textContent = '⏸️';
    }
  };

  btnRewind.onclick = () => {
    const track = tracks[currentTrackIdx];
    audioEngine.playTrack(track.previewUrl, state.startAudioMode);
    btnPlayPause.textContent = '⏸️';
  };

  btnNext.onclick = () => {
    loadHostTrack(currentTrackIdx + 1);
  };

  document.getElementById('btn-host-quit').onclick = () => {
    audioEngine.stop();
    showScreen('screen-home');
  };

  renderTeams();
  loadHostTrack(0);
}

// ==========================================================================
// 7. Mode Salon en Ligne (Hôte TV & Client Smartphone)
// ==========================================================================

function initColorPicker() {
  const container = document.getElementById('client-color-picker');
  if (!container) return;

  container.innerHTML = PLAYER_COLORS.map((c, i) => `
    <div class="color-dot ${i === 0 ? 'selected' : ''}" style="background: ${c.grad};" data-color="${c.hex}" title="${c.name}"></div>
  `).join('');

  container.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      container.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      state.clientSelectedColor = dot.dataset.color;
    });
  });
}

function initRoomClientJoinForm() {
  const form = document.getElementById('form-join-room');
  if (!form) return;

  form.onsubmit = (e) => {
    e.preventDefault();
    const code = document.getElementById('input-room-code').value.trim();
    const name = document.getElementById('input-player-name').value.trim();
    if (!code || !name) return;

    initRoomClientFlow(code, name, state.clientSelectedColor);
  };
}

// Flux Hôte (Création salon, QR Code, attente des joueurs)
function initRoomHostFlow() {
  showScreen('screen-room-host-lobby');
  const codeDisplay = document.getElementById('room-code-display');
  const playersList = document.getElementById('room-players-list');
  const playersCount = document.getElementById('room-players-count');
  const btnStart = document.getElementById('btn-start-room-game');
  const qrcodeContainer = document.getElementById('room-qrcode-container');
  const btnCopy = document.getElementById('btn-copy-room-link');

  codeDisplay.textContent = 'CONNEXION...';
  playersList.innerHTML = '<span style="color: var(--text-dim); font-size: 0.85rem;">Création du salon...</span>';
  playersCount.textContent = '0';
  btnStart.disabled = true;
  qrcodeContainer.innerHTML = '';

  roomHost.initRoom((roomCode) => {
    codeDisplay.textContent = roomCode;

    // URL complète pour rejoindre avec le code pré-rempli
    const joinUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

    // Génération du QR Code
    if (window.QRCode) {
      qrcodeContainer.innerHTML = '';
      new window.QRCode(qrcodeContainer, {
        text: joinUrl,
        width: 160,
        height: 160,
        colorDark: '#0b0c16',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }

    btnCopy.onclick = () => {
      navigator.clipboard.writeText(joinUrl).then(() => {
        btnCopy.textContent = '✅ Lien copié !';
        setTimeout(() => { btnCopy.textContent = '📋 Copier le lien d\'invitation'; }, 2000);
      });
    };

    playersList.innerHTML = '<span style="color: var(--text-dim); font-size: 0.85rem;">En attente des premiers joueurs...</span>';
  });

  // Mise à jour de la liste des joueurs connectés
  const updatePlayersUI = (players) => {
    playersCount.textContent = players.length;
    if (players.length === 0) {
      playersList.innerHTML = '<span style="color: var(--text-dim); font-size: 0.85rem;">En attente des premiers joueurs...</span>';
      btnStart.disabled = true;
    } else {
      playersList.innerHTML = players.map(p => `
        <div class="room-player-tag" style="background: ${p.color};">
          <span>👤 ${p.name}</span>
        </div>
      `).join('');
      btnStart.disabled = false;
    }
  };

  roomHost.onPlayerJoined = updatePlayersUI;
  roomHost.onPlayerLeft = updatePlayersUI;

  // Lancement effectif de la partie par l'Hôte
  btnStart.onclick = async () => {
    const category = getCategoryById(state.selectedCategoryId);
    const customPrompt = state.selectedCategoryId === 'custom_theme'
      ? (document.getElementById('input-custom-theme')?.value.trim() || null)
      : null;

    showScreen('screen-loading');
    const catDisplayName = (state.selectedCategoryId === 'custom_theme' && customPrompt)
      ? customPrompt
      : category.name;
    document.getElementById('loading-category-name').textContent = `Salon ${roomHost.roomCode} - ${catDisplayName}`;
    document.getElementById('loading-subtext').textContent = 'Préparation des morceaux...';

    const progressFill = document.getElementById('loading-progress-fill');
    if (progressFill) progressFill.style.width = '10%';

    const tracks = await preparePlaylist(category, state.trackCount, (percent, msg) => {
      if (progressFill) progressFill.style.width = `${Math.max(10, percent)}%`;
      if (msg) {
        const subtext = document.getElementById('loading-subtext');
        if (subtext) subtext.textContent = msg;
      }
    }, customPrompt);

    if (tracks && tracks.length > 0) {
      startOnlineHostGame(tracks);
    } else {
      alert("Erreur lors de la préparation des morceaux.");
      showScreen('screen-room-host-lobby');
    }
  };
}

// Jeu Hôte en Ligne (Diffusion audio sur TV/enceinte + gestion des buzzers distants)
function startOnlineHostGame(tracks) {
  showScreen('screen-room-host-game');
  let currentIdx = 0;

  const roundEl = document.getElementById('online-host-round');
  const timerFill = document.getElementById('online-host-timer');
  const coverImg = document.getElementById('online-album-cover');
  const mysteryIcon = document.getElementById('online-mystery-icon');
  const vinylDisc = document.getElementById('online-vinyl-disc');

  const buzzWaiting = document.getElementById('online-buzz-waiting');
  const buzzActive = document.getElementById('online-buzz-active');
  const buzzReveal = document.getElementById('online-reveal-box');
  const buzzPlayerTitle = document.getElementById('online-buzzed-player-title');
  const leaderboardList = document.getElementById('online-leaderboard-list');

  function updateLeaderboard(players) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    leaderboardList.innerHTML = sorted.map(p => `
      <div class="room-player-tag" style="background: ${p.color};">
        <span>${p.name}</span>
        <span style="background: rgba(0,0,0,0.3); padding: 0.1rem 0.5rem; border-radius: 99px; margin-left: 0.3rem;">${p.score} pts</span>
      </div>
    `).join('');
  }

  function loadOnlineRound(index) {
    if (index >= tracks.length) {
      sfx.playFanfare();
      alert("Partie terminée ! Félicitations à tous les joueurs !");
      roomHost.destroy();
      showScreen('screen-home');
      return;
    }

    currentIdx = index;
    const track = tracks[currentIdx];
    roundEl.textContent = `Manche ${currentIdx + 1} / ${tracks.length}`;

    // Réinitialisation de l'affichage
    coverImg.src = track.artworkUrl || './assets/icons/icon.svg';
    coverImg.classList.remove('revealed');
    mysteryIcon.classList.remove('hidden');
    vinylDisc.classList.add('spinning');
    timerFill.style.width = '100%';

    buzzWaiting.style.display = 'block';
    buzzActive.style.display = 'none';
    buzzReveal.style.display = 'none';

    // Démarrage audio et broadcast aux téléphones
    audioEngine.playTrack(track.previewUrl, state.startAudioMode);
    roomHost.startRound(currentIdx, tracks.length);
    updateLeaderboard(roomHost.getPlayersList());
  }

  // Événement quand un joueur distant buzze sur son téléphone
  roomHost.onPlayerBuzzed = (player) => {
    audioEngine.pause();
    sfx.playBuzzer();

    buzzWaiting.style.display = 'none';
    buzzActive.style.display = 'block';
    buzzReveal.style.display = 'none';

    buzzPlayerTitle.textContent = `${player.name} a buzzé ! ⚡`;
    buzzPlayerTitle.style.color = player.color;
  };

  // Verdict Hôte : Bonne réponse (+1)
  document.getElementById('btn-online-verdict-correct').onclick = () => {
    sfx.playCorrect();
    const track = tracks[currentIdx];
    roomHost.judgeAnswer(true, track);

    coverImg.classList.add('revealed');
    mysteryIcon.classList.add('hidden');

    buzzActive.style.display = 'none';
    buzzReveal.style.display = 'block';
    document.getElementById('online-reveal-title').textContent = track.title;
    document.getElementById('online-reveal-artist').textContent = track.artist;
    document.getElementById('online-reveal-meta').textContent = `${track.year || ''} • ${track.genre || ''}`;

    updateLeaderboard(roomHost.getPlayersList());
  };

  // Verdict Hôte : Faux (Relance pour les autres joueurs)
  document.getElementById('btn-online-verdict-wrong').onclick = () => {
    sfx.playWrong();
    const track = tracks[currentIdx];
    roomHost.judgeAnswer(false, track);

    // Si d'autres joueurs peuvent encore buzzer, on relance la musique
    const stillCanBuzz = Array.from(roomHost.players.values()).some(p => !roomHost.lockedPlayersThisRound.has(p.id));
    if (stillCanBuzz) {
      buzzActive.style.display = 'none';
      buzzWaiting.style.display = 'block';
      audioEngine.resume();
    } else {
      // Tout le monde a raté
      coverImg.classList.add('revealed');
      mysteryIcon.classList.add('hidden');
      buzzActive.style.display = 'none';
      buzzReveal.style.display = 'block';
      document.getElementById('online-reveal-title').textContent = track.title;
      document.getElementById('online-reveal-artist').textContent = track.artist;
      document.getElementById('online-reveal-meta').textContent = `${track.year || ''} • ${track.genre || ''}`;
    }
  };

  // Bouton "Personne ne sait"
  document.getElementById('btn-online-nobody').onclick = () => {
    const track = tracks[currentIdx];
    audioEngine.stop();
    roomHost.skipRound(track);

    coverImg.classList.add('revealed');
    mysteryIcon.classList.add('hidden');
    buzzWaiting.style.display = 'none';
    buzzActive.style.display = 'none';
    buzzReveal.style.display = 'block';
    document.getElementById('online-reveal-title').textContent = track.title;
    document.getElementById('online-reveal-artist').textContent = track.artist;
    document.getElementById('online-reveal-meta').textContent = `${track.year || ''} • ${track.genre || ''}`;
  };

  // Bouton Manche suivante
  document.getElementById('btn-online-next-round').onclick = () => {
    loadOnlineRound(currentIdx + 1);
  };

  // Quitter
  document.getElementById('btn-online-host-quit').onclick = () => {
    audioEngine.stop();
    roomHost.destroy();
    showScreen('screen-home');
  };

  loadOnlineRound(0);
}

// Flux Client (Smartphone individuel du joueur)
function initRoomClientFlow(roomCode, playerName, playerColor) {
  showScreen('screen-room-client-buzzer');

  const badgeName = document.getElementById('client-badge-name');
  const badgeScore = document.getElementById('client-badge-score');
  const roomTag = document.getElementById('client-room-code-tag');
  const statusEl = document.getElementById('client-room-status');
  const buzzBtn = document.getElementById('btn-client-buzzer');

  badgeName.textContent = playerName;
  badgeName.style.background = playerColor;
  roomTag.textContent = roomCode.toUpperCase();
  badgeScore.textContent = '0 pts';

  buzzBtn.className = 'client-buzzer-btn locked';
  buzzBtn.style.background = playerColor;
  statusEl.textContent = 'Connexion au salon...';

  roomClient.joinRoom(roomCode, playerName, playerColor);

  roomClient.onStateChange = (stateName, payload) => {
    if (stateName === 'lobby') {
      statusEl.textContent = 'Connecté ! En attente du lancement de la partie...';
      buzzBtn.className = 'client-buzzer-btn locked';
      buzzBtn.innerHTML = '<span>⏳</span><span>EN ATTENTE</span>';
    } else if (stateName === 'active_round') {
      statusEl.textContent = `Manche en cours • Écoutez la musique !`;
      buzzBtn.className = 'client-buzzer-btn';
      buzzBtn.style.background = playerColor;
      buzzBtn.innerHTML = '<span style="font-size: 4rem;">🚨</span><span>BUZZ !</span>';
    } else if (stateName === 'player_buzzed') {
      if (payload.isMe) {
        statusEl.textContent = '🎉 VOUS AVEZ LA MAIN ! Donnez votre réponse !';
        buzzBtn.className = 'client-buzzer-btn winner';
        buzzBtn.innerHTML = '<span>⚡</span><span>À VOUS !</span>';
      } else {
        statusEl.textContent = `⚡ ${payload.winnerName} a buzzé !`;
        buzzBtn.className = 'client-buzzer-btn locked';
        buzzBtn.innerHTML = '<span>🔒</span><span>VERROUILLÉ</span>';
      }
    } else if (stateName === 'locked_out') {
      statusEl.textContent = 'Mauvaise réponse. Vous ne pouvez plus buzzer ce tour.';
      buzzBtn.className = 'client-buzzer-btn locked';
      buzzBtn.innerHTML = '<span>❌</span><span>HORS-JEU</span>';
    } else if (stateName === 'round_ended') {
      const myInfo = payload.players ? payload.players.find(p => p.name === playerName) : null;
      if (myInfo) {
        badgeScore.textContent = `${myInfo.score} pts`;
      }
      statusEl.textContent = `Morceau : ${payload.trackTitle || ''} - ${payload.trackArtist || ''}`;
      buzzBtn.className = 'client-buzzer-btn locked';
      buzzBtn.innerHTML = '<span>🎵</span><span>FIN DU TOUR</span>';
    }
  };

  // Clic ou toucher sur le buzzer personnel
  const onBuzz = (e) => {
    e.preventDefault();
    if (roomClient.state === 'active_round') {
      roomClient.buzz();
    }
  };
  buzzBtn.addEventListener('touchstart', onBuzz, { passive: false });
  buzzBtn.addEventListener('mousedown', onBuzz);
}

// ==========================================================================
// Démarrage initial au chargement du DOM
// ==========================================================================
function initApp() {
  initCategories();
  initSettings();
  initPwaInstall();
  initAiSettings();

  // Détection du paramètre URL ?room=CODE (scan de QR Code)
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room');
  if (room) {
    showScreen('screen-room-client-join');
    const input = document.getElementById('input-room-code');
    if (input) input.value = room.toUpperCase();
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
// Module de communication WebRTC PeerJS pour le mode 'Chacun son smartphone'

const PEER_PREFIX = 'blindtest-room-';

// Génération d'un code de salon à 4 lettres mémorable
const WORDS = ['BEAT', 'ROCK', 'STAR', 'WAVE', 'LION', 'CLUB', 'DISC', 'SOLO', 'VIBE', 'JAZZ', 'FUNK', 'SHOW', 'SLAM', 'TUBE', 'HITS'];
export function generateRoomCode() {
  return WORDS[Math.floor(Math.random() * WORDS.length)] + Math.floor(10 + Math.random() * 90);
}

// Couleurs de buzzers disponibles pour les joueurs
export const PLAYER_COLORS = [
  { name: 'Cyan', hex: '#00f2fe', grad: 'linear-gradient(135deg, #00f2fe, #4facfe)' },
  { name: 'Rose', hex: '#ff007f', grad: 'linear-gradient(135deg, #ff007f, #7928ca)' },
  { name: 'Jaune', hex: '#ffd200', grad: 'linear-gradient(135deg, #ffd200, #ff6a00)' },
  { name: 'Vert', hex: '#00ff88', grad: 'linear-gradient(135deg, #00ff88, #00b09b)' },
  { name: 'Violet', hex: '#b300ff', grad: 'linear-gradient(135deg, #b300ff, #ff007f)' },
  { name: 'Orange', hex: '#ff6600', grad: 'linear-gradient(135deg, #ff6600, #ff3300)' }
];

// ==========================================================================
// HÔTE DU SALON (Écran principal / TV / Ordinateur)
// ==========================================================================
export class RoomHost {
  constructor() {
    this.peer = null;
    this.roomCode = '';
    this.players = new Map(); // id -> { id, conn, name, color, score }
    this.activeBuzzerPlayer = null;
    this.buzzerLocked = false;
    this.lockedPlayersThisRound = new Set();
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onPlayerBuzzed = null;
    this.onError = null;
  }

  initRoom(onReady) {
    this.roomCode = generateRoomCode();
    const peerId = PEER_PREFIX + this.roomCode;

    // Fermer une éventuelle session précédente
    if (this.peer) this.peer.destroy();

    try {
      this.peer = new window.Peer(peerId, {
        debug: 1
      });

      this.peer.on('open', (id) => {
        console.log('Salon WebRTC ouvert avec l\'ID:', id);
        if (onReady) onReady(this.roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('Erreur PeerJS Hôte:', err);
        // Si l'ID est déjà pris, on régénère un code
        if (err.type === 'unavailable-id') {
          setTimeout(() => this.initRoom(onReady), 500);
        } else if (this.onError) {
          this.onError(err);
        }
      });
    } catch (err) {
      console.error('Impossible d\'initialiser PeerJS:', err);
      if (this.onError) this.onError(err);
    }
  }

  handleIncomingConnection(conn) {
    conn.on('data', (data) => {
      if (!data || !data.type) return;

      if (data.type === 'JOIN') {
        const player = {
          id: conn.peer,
          conn,
          name: data.name || `Joueur ${this.players.size + 1}`,
          color: data.color || PLAYER_COLORS[this.players.size % PLAYER_COLORS.length].hex,
          score: 0
        };

        this.players.set(conn.peer, player);

        // Envoyer la confirmation au joueur
        conn.send({
          type: 'WELCOME',
          roomCode: this.roomCode,
          player: { id: player.id, name: player.name, color: player.color }
        });

        // Notifier l'interface hôte
        if (this.onPlayerJoined) {
          this.onPlayerJoined(this.getPlayersList());
        }

        // Informer tous les joueurs de la liste mise à jour
        this.broadcastPlayersList();
      }

      if (data.type === 'BUZZ') {
        this.handlePlayerBuzz(conn.peer);
      }
    });

    conn.on('close', () => {
      if (this.players.has(conn.peer)) {
        this.players.delete(conn.peer);
        if (this.onPlayerLeft) this.onPlayerLeft(this.getPlayersList());
        this.broadcastPlayersList();
      }
    });
  }

  handlePlayerBuzz(peerId) {
    if (this.buzzerLocked || this.activeBuzzerPlayer !== null) return;
    if (this.lockedPlayersThisRound.has(peerId)) return;

    const player = this.players.get(peerId);
    if (!player) return;

    this.activeBuzzerPlayer = player;
    this.buzzerLocked = true;

    // Diffuser à tous les téléphones qui a buzzé
    this.broadcast({
      type: 'PLAYER_BUZZED',
      winnerId: player.id,
      winnerName: player.name,
      winnerColor: player.color
    });

    if (this.onPlayerBuzzed) {
      this.onPlayerBuzzed(player);
    }
  }

  // Résolution de la réponse par l'arbitre / hôte
  judgeAnswer(isCorrect, currentTrack) {
    if (!this.activeBuzzerPlayer) return;

    if (isCorrect) {
      this.activeBuzzerPlayer.score += 1;
      this.broadcast({
        type: 'ROUND_WON',
        winnerName: this.activeBuzzerPlayer.name,
        trackTitle: currentTrack.title,
        trackArtist: currentTrack.artist,
        trackArtwork: currentTrack.artworkUrl,
        players: this.getPlayersList()
      });
      this.activeBuzzerPlayer = null;
      this.buzzerLocked = true;
    } else {
      this.lockedPlayersThisRound.add(this.activeBuzzerPlayer.id);
      this.activeBuzzerPlayer = null;

      // Reste-t-il des joueurs pouvant buzzer ?
      const stillCanBuzz = Array.from(this.players.values()).some(p => !this.lockedPlayersThisRound.has(p.id));

      if (stillCanBuzz) {
        this.buzzerLocked = false;
        this.broadcast({
          type: 'BUZZ_RESUME',
          lockedPlayerIds: Array.from(this.lockedPlayersThisRound)
        });
      } else {
        // Tous ont raté
        this.buzzerLocked = true;
        this.broadcast({
          type: 'ROUND_LOST',
          trackTitle: currentTrack.title,
          trackArtist: currentTrack.artist,
          trackArtwork: currentTrack.artworkUrl,
          players: this.getPlayersList()
        });
      }
    }
  }

  // Démarrer une nouvelle manche
  startRound(trackIndex, totalTracks) {
    this.activeBuzzerPlayer = null;
    this.buzzerLocked = false;
    this.lockedPlayersThisRound.clear();

    this.broadcast({
      type: 'ROUND_STARTED',
      trackIndex,
      totalTracks,
      players: this.getPlayersList()
    });
  }

  // Révéler le morceau sans gagnant
  skipRound(currentTrack) {
    this.buzzerLocked = true;
    this.activeBuzzerPlayer = null;
    this.broadcast({
      type: 'ROUND_LOST',
      trackTitle: currentTrack.title,
      trackArtist: currentTrack.artist,
      trackArtwork: currentTrack.artworkUrl,
      players: this.getPlayersList()
    });
  }

  broadcast(message) {
    this.players.forEach((player) => {
      if (player.conn && player.conn.open) {
        try {
          player.conn.send(message);
        } catch (e) {
          console.warn('Erreur envoi message au joueur:', e);
        }
      }
    });
  }

  broadcastPlayersList() {
    this.broadcast({
      type: 'PLAYERS_UPDATE',
      players: this.getPlayersList()
    });
  }

  getPlayersList() {
    return Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score
    }));
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.players.clear();
  }
}

// ==========================================================================
// CLIENT JOUEUR (Sur smartphone individuel)
// ==========================================================================
export class RoomClient {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.playerInfo = null;
    this.state = 'connecting'; // 'connecting', 'lobby', 'ready', 'buzzing', 'locked', 'winner'
    this.onStateChange = null;
    this.onError = null;
  }

  joinRoom(roomCode, playerName, playerColor) {
    const formattedCode = roomCode.trim().toUpperCase();
    const hostPeerId = PEER_PREFIX + formattedCode;

    if (this.peer) this.peer.destroy();

    try {
      this.peer = new window.Peer(null, { debug: 1 });

      this.peer.on('open', () => {
        this.conn = this.peer.connect(hostPeerId, { reliable: true });

        this.conn.on('open', () => {
          this.conn.send({
            type: 'JOIN',
            name: playerName || 'Joueur',
            color: playerColor || '#00f2fe'
          });
        });

        this.conn.on('data', (data) => {
          this.handleHostMessage(data);
        });

        this.conn.on('close', () => {
          this.setState('disconnected', { message: 'Déconnecté du salon.' });
        });
      });

      this.peer.on('error', (err) => {
        console.warn('Erreur Peer Client:', err);
        if (this.onError) this.onError(err);
      });
    } catch (e) {
      if (this.onError) this.onError(e);
    }
  }

  handleHostMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'WELCOME':
        this.playerInfo = msg.player;
        this.setState('lobby', { roomCode: msg.roomCode, player: this.playerInfo });
        break;

      case 'PLAYERS_UPDATE':
        this.setState('players_update', { players: msg.players });
        break;

      case 'ROUND_STARTED':
        this.setState('active_round', {
          trackIndex: msg.trackIndex,
          totalTracks: msg.totalTracks,
          players: msg.players
        });
        break;

      case 'PLAYER_BUZZED':
        const isMe = this.playerInfo && this.playerInfo.name === msg.winnerName;
        if (isMe && navigator.vibrate) {
          navigator.vibrate([150, 50, 150]); // Vibration haptique immédiate sur le téléphone !
        }
        this.setState('player_buzzed', {
          winnerName: msg.winnerName,
          winnerColor: msg.winnerColor,
          isMe
        });
        break;

      case 'BUZZ_RESUME':
        const iAmLocked = msg.lockedPlayerIds && msg.lockedPlayerIds.includes(this.peer.id);
        this.setState(iAmLocked ? 'locked_out' : 'active_round');
        break;

      case 'ROUND_WON':
      case 'ROUND_LOST':
        this.setState('round_ended', msg);
        break;
    }
  }

  // Appui sur le buzzer tactile du smartphone
  buzz() {
    if (this.conn && this.conn.open) {
      if (navigator.vibrate) navigator.vibrate(80);
      this.conn.send({
        type: 'BUZZ',
        timestamp: Date.now()
      });
    }
  }

  setState(newState, payload = {}) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState, payload);
    }
  }

  destroy() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}

export const roomHost = new RoomHost();
export const roomClient = new RoomClient();

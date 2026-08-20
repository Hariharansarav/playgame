// backend/store/gameStore.js
import { 
  createMultiDeck, 
  shuffleDeck, 
  isCardJoker, 
  validateDeclaration,
  calculateHandScore
} from '../engine/rummyEngine.js';

class GameStore {
  constructor() {
    this.rooms = new Map(); // roomCode -> room data
    this.socketToPlayer = new Map(); // socketId -> { roomCode, playerId }
  }

  // Create a room with code and settings
  createRoom(code, settings = {}) {
    const room = {
      code,
      status: 'LOBBY', // LOBBY, PLAYING, ROUND_END, GAME_OVER
      settings: {
        maxPlayers: settings.maxPlayers || 6,
        turnDuration: settings.turnDuration || 30, // in seconds
        pointsLimit: settings.pointsLimit || 101, // drop out limit
        allowDrop: settings.allowDrop !== undefined ? settings.allowDrop : true,
      },
      players: [],
      deck: [],
      discardPile: [],
      wildJoker: null,
      currentPlayerIdx: -1,
      turnStartTime: null,
      roundNumber: 0,
      winnerId: null,
      declareState: null, // { declarantId, groups, timeRemaining, answersSubmitted: {} }
      gameLogs: [],
      chatLogs: [],
      createdAt: Date.now()
    };
    this.rooms.set(code, room);
    this.addLog(code, `Room ${code} created.`);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  removeRoom(code) {
    const room = this.rooms.get(code);
    if (room) {
      room.players.forEach(p => {
        if (p.socketId) this.socketToPlayer.delete(p.socketId);
      });
      this.rooms.delete(code);
    }
  }

  // Add log to room
  addLog(code, text) {
    const room = this.rooms.get(code);
    if (room) {
      room.gameLogs.push({
        id: Math.random().toString(36).substr(2, 9),
        text,
        timestamp: Date.now()
      });
      // Cap log size
      if (room.gameLogs.length > 50) room.gameLogs.shift();
    }
  }

  // Add chat message
  addChat(code, sender, text) {
    const room = this.rooms.get(code);
    if (room) {
      const msg = {
        id: Math.random().toString(36).substr(2, 9),
        sender,
        text,
        timestamp: Date.now()
      };
      room.chatLogs.push(msg);
      if (room.chatLogs.length > 50) room.chatLogs.shift();
      return msg;
    }
    return null;
  }

  // Add player
  addPlayer(code, socketId, nickname, avatar) {
    const room = this.rooms.get(code);
    if (!room) return null;

    // Check if room is full
    if (room.players.length >= room.settings.maxPlayers && !room.players.find(p => p.nickname === nickname)) {
      return { error: 'Room is full' };
    }

    // Check if player with same nickname already exists (reconnection case)
    let player = room.players.find(p => p.nickname.toLowerCase() === nickname.toLowerCase());

    if (player) {
      // Reconnect player
      const oldSocketId = player.socketId;
      if (oldSocketId) this.socketToPlayer.delete(oldSocketId);
      
      player.socketId = socketId;
      player.disconnected = false;
      player.disconnectTime = null;
      this.addLog(code, `${player.nickname} reconnected.`);
    } else {
      // New player joining
      if (room.status !== 'LOBBY') {
        return { error: 'Game already in progress. Cannot join now.' };
      }
      player = {
        id: Math.random().toString(36).substr(2, 9),
        socketId,
        nickname,
        avatar: avatar || '🥷',
        score: 0,
        roundScore: 0,
        hand: [],
        groups: [],
        isReady: false,
        hasDropped: false,
        dropType: null,
        disconnected: false,
        hasDrawn: false, // Turn-based safety check
        disconnectTime: null
      };
      room.players.push(player);
      this.addLog(code, `${player.nickname} joined the lobby.`);
    }

    this.socketToPlayer.set(socketId, { roomCode: code, playerId: player.id });
    return player;
  }

  // Handle Player Ready
  toggleReady(code, socketId) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const player = room.players.find(p => p.socketId === socketId);
    if (player) {
      player.isReady = !player.isReady;
      this.addLog(code, `${player.nickname} is ${player.isReady ? 'READY' : 'NOT READY'}.`);
    }
    return room;
  }

  // Start Rummy Game Round
  startRound(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    room.status = 'PLAYING';
    room.roundNumber += 1;
    room.winnerId = null;
    room.declareState = null;

    // Reset player round states
    room.players.forEach(p => {
      p.hand = [];
      p.groups = [];
      p.roundScore = 0;
      p.hasDropped = false;
      p.dropType = null;
      p.hasDrawn = false;
    });

    // Create and shuffle decks
    const multiDeck = createMultiDeck(room.settings.maxPlayers);
    const shuffled = shuffleDeck(multiDeck);

    // Deal cards (13 cards to each player)
    for (let i = 0; i < 13; i++) {
      room.players.forEach(p => {
        p.hand.push(shuffled.pop());
      });
    }

    // Auto-initialize group for each player (1 group containing all cards initially)
    room.players.forEach(p => {
      // Sort hand by suit first for convenience
      const sortedHand = [...p.hand].sort((a, b) => {
        if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
        return a.rank.localeCompare(b.rank);
      });
      p.hand = sortedHand;
      p.groups = [sortedHand];
    });

    // Open wild joker
    // Drawn from deck. Place back in or keep at bottom.
    // In Rummy, a card is opened face up and placed sideways under the closed deck.
    // If it's a printed Joker, all Aces become Wild Jokers.
    let jokerCard = shuffled.pop();
    room.wildJoker = jokerCard;

    // Open one card to start the discard pile (cannot be printed joker, if so, draw another)
    let initialDiscard = shuffled.pop();
    while (initialDiscard.suit === 'J' && initialDiscard.rank === 'JOKER') {
      shuffled.unshift(initialDiscard); // Put it back at bottom of deck
      initialDiscard = shuffled.pop();
    }
    
    room.deck = shuffled;
    room.discardPile = [initialDiscard];

    // Pick first player randomly from non-dropped players
    room.currentPlayerIdx = Math.floor(Math.random() * room.players.length);
    room.turnStartTime = Date.now();

    this.addLog(code, `Round ${room.roundNumber} started! Joker card is ${jokerCard.rank} of ${jokerCard.suit === 'J' ? 'Jokers' : jokerCard.suit}.`);
    this.addLog(code, `First turn belongs to ${room.players[room.currentPlayerIdx].nickname}.`);

    return room;
  }

  // Draw card from Closed Deck or Discard Pile
  drawCard(code, socketId, source) {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'PLAYING') return { error: 'Invalid game status' };

    const currentPlayer = room.players[room.currentPlayerIdx];
    if (!currentPlayer || currentPlayer.socketId !== socketId) {
      return { error: 'Not your turn' };
    }

    if (currentPlayer.hasDrawn) {
      return { error: 'Already drawn a card' };
    }

    let drawnCard = null;

    if (source === 'deck') {
      if (room.deck.length === 0) {
        // Recycle discard pile (keep top card and shuffle the rest to make new deck)
        if (room.discardPile.length <= 1) {
          return { error: 'No cards left in deck or discard pile to draw!' };
        }
        const topCard = room.discardPile.pop();
        room.deck = shuffleDeck(room.discardPile);
        room.discardPile = [topCard];
        this.addLog(code, `Closed deck exhausted. Discard pile recycled and shuffled.`);
      }
      drawnCard = room.deck.pop();
      this.addLog(code, `${currentPlayer.nickname} drew from Closed Deck.`);
    } else if (source === 'discard') {
      if (room.discardPile.length === 0) {
        return { error: 'Discard pile is empty' };
      }
      // You cannot draw your own discard immediately, but since it's the start of turn, it's fine.
      drawnCard = room.discardPile.pop();
      this.addLog(code, `${currentPlayer.nickname} drew ${drawnCard.rank} of ${drawnCard.suit} from Discard Pile.`);
    } else {
      return { error: 'Invalid draw source' };
    }

    // Add to player's hand and to their first group
    currentPlayer.hand.push(drawnCard);
    if (currentPlayer.groups.length === 0) {
      currentPlayer.groups = [[drawnCard]];
    } else {
      currentPlayer.groups[0].push(drawnCard);
    }
    currentPlayer.hasDrawn = true;

    return { room, drawnCard };
  }

  // Discard card to the discard pile
  discardCard(code, socketId, cardId, isFinish = false) {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'PLAYING') return { error: 'Invalid game status' };

    const currentPlayer = room.players[room.currentPlayerIdx];
    if (!currentPlayer || currentPlayer.socketId !== socketId) {
      return { error: 'Not your turn' };
    }

    if (!currentPlayer.hasDrawn) {
      return { error: 'Must draw a card first' };
    }

    // Find card in hand
    const cardIndex = currentPlayer.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return { error: 'Card not in hand' };
    }

    const cardToDiscard = currentPlayer.hand[cardIndex];

    // Remove from player's hand
    currentPlayer.hand.splice(cardIndex, 1);

    // Remove from groups
    currentPlayer.groups = currentPlayer.groups.map(group => 
      group.filter(c => c.id !== cardId)
    ).filter(group => group.length > 0);

    currentPlayer.hasDrawn = false;

    if (isFinish) {
      // Put in declare state: game switches to DECLARING mode.
      // Other players get 20 seconds to arrange their final cards.
      room.status = 'DECLARING';
      room.declareState = {
        declarantId: currentPlayer.id,
        declarantSocketId: socketId,
        finishCard: cardToDiscard,
        timeRemaining: 30, // seconds to finish submitting hands
        answersSubmitted: {} // playerId -> groups submitted
      };
      
      this.addLog(code, `${currentPlayer.nickname} finished the game with ${cardToDiscard.rank} of ${cardToDiscard.suit}! Waiting for declarations.`);
      return { room, isFinish: true };
    } else {
      // Standard discard
      room.discardPile.push(cardToDiscard);
      this.addLog(code, `${currentPlayer.nickname} discarded ${cardToDiscard.rank} of ${cardToDiscard.suit}.`);

      // Switch to next active player
      this.nextTurn(code);
      return { room, isFinish: false };
    }
  }

  // Drop from the game round
  dropRound(code, socketId) {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'PLAYING') return { error: 'Invalid game status' };

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return { error: 'Player not found' };

    const playerIdx = room.players.indexOf(player);
    const isCurrentTurn = room.currentPlayerIdx === playerIdx;

    // Check if player has already drawn this turn. If they're dropping, they must do it on their turn BEFORE drawing.
    // Actually, players can drop on their turn before drawing, or even out of turn (first drop vs middle drop).
    // In standard Indian Rummy:
    // First Drop: Dropping without making a single play (drawing any card). Points: 20.
    // Middle Drop: Dropping after making at least one play. Points: 40.
    
    // Determine drop type
    const hasPlayed = player.hand.length !== 13 || room.discardPile.length > 1 || room.roundNumber > 1 || player.hasDrawn;
    // Let's simplify: if the discard pile has only 1 card (initial open) and this player hasn't drawn any card, it's a first drop.
    const isFirstDrop = !player.hasDrawn && player.hand.length === 13 && room.discardPile.length === 1 && (isCurrentTurn || room.currentPlayerIdx === 0);
    
    player.hasDropped = true;
    player.dropType = isFirstDrop ? 'FIRST' : 'MIDDLE';
    player.roundScore = isFirstDrop ? 20 : 40;
    player.score += player.roundScore;

    this.addLog(code, `${player.nickname} DROPPED (${player.dropType} drop, +${player.roundScore} points).`);

    // Check if only one player remains active
    const activePlayers = room.players.filter(p => !p.hasDropped && !p.disconnected);
    if (activePlayers.length === 1) {
      // Last standing player wins the round automatically (gets 0 points)
      const roundWinner = activePlayers[0];
      roundWinner.roundScore = 0;
      this.endRound(code, roundWinner.id);
      return { room, finished: true };
    }

    if (isCurrentTurn) {
      this.nextTurn(code);
    }

    return { room, finished: false };
  }

  // Switch to next player's turn
  nextTurn(code) {
    const room = this.rooms.get(code);
    if (!room) return;

    const startingIdx = room.currentPlayerIdx;
    let nextIdx = (startingIdx + 1) % room.players.length;

    // Find next player who is not dropped and not disconnected
    while (nextIdx !== startingIdx) {
      const p = room.players[nextIdx];
      if (!p.hasDropped && !p.disconnected) {
        room.currentPlayerIdx = nextIdx;
        room.turnStartTime = Date.now();
        room.players[nextIdx].hasDrawn = false; // Reset draw state
        this.addLog(code, `It's now ${p.nickname}'s turn.`);
        return;
      }
      nextIdx = (nextIdx + 1) % room.players.length;
    }
  }

  // Group cards for a player (called when the player rearranges their cards)
  groupCards(code, socketId, groups) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const player = room.players.find(p => p.socketId === socketId);
    if (player) {
      player.groups = groups;
    }
    return room;
  }

  // Submit final hand declaration (when round ends/declaring)
  submitDeclaration(code, socketId, groups) {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'DECLARING') return null;

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return null;

    room.declareState.answersSubmitted[player.id] = groups;
    player.groups = groups;

    // Check if everyone (except the declarant and dropped/disconnected players) has submitted
    const activeNonDeclarantCount = room.players.filter(p => 
      p.id !== room.declareState.declarantId && 
      !p.hasDropped && 
      !p.disconnected
    ).length;

    const submissionsCount = Object.keys(room.declareState.answersSubmitted).length;

    if (submissionsCount >= activeNonDeclarantCount) {
      this.processDeclarationResults(code);
    }

    return room;
  }

  // Force close/process declaration when timer expires
  processDeclarationResults(code) {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'DECLARING') return;

    const declarant = room.players.find(p => p.id === room.declareState.declarantId);
    if (!declarant) return;

    // 1. Validate the declarant's hand
    const declarantGroups = declarant.groups;
    const validation = validateDeclaration(declarantGroups, room.wildJoker);

    if (validation.isValid) {
      // Declarant wins! Points = 0.
      declarant.roundScore = 0;
      this.addLog(code, `${declarant.nickname} made a VALID declaration!`);
      
      // Calculate scores for everyone else
      room.players.forEach(p => {
        if (p.id === declarant.id) return;
        if (p.hasDropped) return; // Dropped points already added when they dropped

        // Get groups (use submitted or fallback to current hand)
        let playerGroups = room.declareState.answersSubmitted[p.id] || p.groups || [p.hand];
        
        // Safety: flatten and ensure all cards in hand are represented
        const totalInGroups = playerGroups.reduce((acc, g) => acc + g.length, 0);
        if (totalInGroups !== p.hand.length) {
          playerGroups = [p.hand]; // Reset if malformed
        }

        const score = calculateHandScore(playerGroups, room.wildJoker);
        p.roundScore = score;
        p.score += score;
        this.addLog(code, `${p.nickname} score for round: ${score} points.`);
      });

      this.endRound(code, declarant.id);
    } else {
      // Declarant made an INCORRECT declaration! Gets 80 points.
      declarant.roundScore = 80;
      declarant.score += 80;
      this.addLog(code, `${declarant.nickname} made an INVALID declaration (+80 points)!`);
      
      // If declaration is incorrect, the round continues! 
      // Switch back to PLAYING mode, return the discard card to the discard pile, and resume.
      // Wait, in standard Rummy, if it's incorrect declaration:
      // The incorrect declarant is suspended/removed from the round (treated as dropped with 80 points)
      // and the round continues for the remaining players.
      declarant.hasDropped = true;
      declarant.dropType = 'INVALID_DECLARE';
      
      const activePlayers = room.players.filter(p => !p.hasDropped && !p.disconnected);
      if (activePlayers.length <= 1) {
        // Round ends if only 1 active player remains
        const winner = activePlayers[0] || room.players.find(p => p.id !== declarant.id);
        if (winner) winner.roundScore = 0;
        this.endRound(code, winner ? winner.id : declarant.id);
      } else {
        // Put the finish card back to discard pile
        room.discardPile.push(room.declareState.finishCard);
        room.status = 'PLAYING';
        room.declareState = null;
        this.nextTurn(code);
      }
    }
  }

  // End the round and calculate totals
  endRound(code, winnerId) {
    const room = this.rooms.get(code);
    if (!room) return;

    room.status = 'ROUND_END';
    room.winnerId = winnerId;

    // Check if any player has crossed the points limit (GAME OVER)
    const eliminated = room.players.filter(p => p.score >= room.settings.pointsLimit);
    
    // Sort players by total score (lowest is best)
    const sorted = [...room.players].sort((a, b) => a.score - b.score);
    
    if (eliminated.length > 0) {
      // Check if we need to end the whole game
      // In tournament style, when someone reaches pointsLimit, they are knocked out.
      // The game is over when only 1 player remains, or we can end when *anyone* exceeds pointsLimit
      // and the player with the lowest score wins! Let's end the game when someone exceeds points limit.
      room.status = 'GAME_OVER';
      this.addLog(code, `Game over! ${sorted[0].nickname} wins the match with ${sorted[0].score} points!`);
    } else {
      this.addLog(code, `Round finished. Winner is ${room.players.find(p => p.id === winnerId).nickname}. Ready up for next round!`);
    }
  }

  // Disconnect player
  handleDisconnect(socketId) {
    const mapped = this.socketToPlayer.get(socketId);
    if (!mapped) return null;

    const { roomCode, playerId } = mapped;
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.disconnected = true;
      player.disconnectTime = Date.now();
      this.addLog(roomCode, `${player.nickname} disconnected.`);

      // If in lobby, remove player immediately
      if (room.status === 'LOBBY') {
        room.players = room.players.filter(p => p.id !== playerId);
        this.socketToPlayer.delete(socketId);
        this.addLog(roomCode, `${player.nickname} left the lobby.`);
        
        // If room is empty, delete it
        if (room.players.length === 0) {
          this.removeRoom(roomCode);
          return null;
        }
      } else {
        // If in game, check if it was their turn
        const activePlayers = room.players.filter(p => !p.hasDropped && !p.disconnected);
        
        if (activePlayers.length <= 1) {
          // End game if too few active players
          const winner = activePlayers[0];
          if (winner) winner.roundScore = 0;
          this.endRound(roomCode, winner ? winner.id : player.id);
        } else if (room.status === 'PLAYING' && room.players[room.currentPlayerIdx].id === playerId) {
          // Switch turn
          this.nextTurn(roomCode);
        }
      }
    }
    return room;
  }
}

export default new GameStore();

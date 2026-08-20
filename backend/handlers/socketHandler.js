// backend/handlers/socketHandler.js
import gameStore from '../store/gameStore.js';

// Timer dictionary to hold intervals for active room codes
const roomIntervals = new Map();

export default function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    // console.log(`Socket connected: ${socket.id}`);

    // Helper to broadcast room updates
    const broadcastRoomUpdate = (roomCode) => {
      const room = gameStore.getRoom(roomCode);
      if (room) {
        // Strip socket ids or sensitive internal details if needed, but for our app, simple json is fine
        io.to(roomCode).emit('roomUpdated', room);
      }
    };

    // 1. Create Room
    socket.on('createRoom', ({ nickname, avatar, settings }, callback) => {
      // Generate a unique 5-letter uppercase room code
      let roomCode = '';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      do {
        roomCode = '';
        for (let i = 0; i < 5; i++) {
          roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
      } while (gameStore.getRoom(roomCode));

      gameStore.createRoom(roomCode, settings);
      const player = gameStore.addPlayer(roomCode, socket.id, nickname, avatar);

      if (player.error) {
        return callback({ error: player.error });
      }

      socket.join(roomCode);
      startRoomGameLoop(io, roomCode);

      // Return room details to client
      const room = gameStore.getRoom(roomCode);
      callback({ success: true, roomCode, player, room });
      broadcastRoomUpdate(roomCode);
    });

    // 2. Join Room
    socket.on('joinRoom', ({ roomCode, nickname, avatar }, callback) => {
      const formattedCode = roomCode.toUpperCase().trim();
      const room = gameStore.getRoom(formattedCode);

      if (!room) {
        return callback({ error: 'Room not found' });
      }

      const player = gameStore.addPlayer(formattedCode, socket.id, nickname, avatar);

      if (player.error) {
        return callback({ error: player.error });
      }

      socket.join(formattedCode);
      startRoomGameLoop(io, formattedCode);

      callback({ success: true, roomCode: formattedCode, player, room });
      broadcastRoomUpdate(formattedCode);
    });

    // 3. Toggle Ready Status
    socket.on('toggleReady', ({ roomCode }) => {
      const room = gameStore.toggleReady(roomCode, socket.id);
      if (room) {
        broadcastRoomUpdate(roomCode);
      }
    });

    // 4. Start Game
    socket.on('startGame', ({ roomCode }) => {
      const room = gameStore.getRoom(roomCode);
      if (!room) return;

      // Verify that all players are ready (or at least 2 players are in room)
      if (room.players.length < 2) {
        return socket.emit('errorMsg', 'Need at least 2 players to start Rummy!');
      }

      // Start first round
      gameStore.startRound(roomCode);
      broadcastRoomUpdate(roomCode);
    });

    // 5. Draw Card
    socket.on('drawCard', ({ roomCode, source }) => {
      const result = gameStore.drawCard(roomCode, socket.id, source);
      if (result.error) {
        socket.emit('errorMsg', result.error);
      } else {
        broadcastRoomUpdate(roomCode);
      }
    });

    // 6. Discard Card
    socket.on('discardCard', ({ roomCode, cardId, isFinish }) => {
      const result = gameStore.discardCard(roomCode, socket.id, cardId, isFinish);
      if (result.error) {
        socket.emit('errorMsg', result.error);
      } else {
        broadcastRoomUpdate(roomCode);
      }
    });

    // 7. Drop Round
    socket.on('dropRound', ({ roomCode }) => {
      const result = gameStore.dropRound(roomCode, socket.id);
      if (result.error) {
        socket.emit('errorMsg', result.error);
      } else {
        broadcastRoomUpdate(roomCode);
      }
    });

    // 8. Re-group Cards (saves state as user drags/sorts)
    socket.on('groupCards', ({ roomCode, groups }) => {
      const room = gameStore.groupCards(roomCode, socket.id, groups);
      if (room) {
        broadcastRoomUpdate(roomCode);
      }
    });

    // 9. Submit Declare Hand
    socket.on('submitDeclaration', ({ roomCode, groups }) => {
      const room = gameStore.submitDeclaration(roomCode, socket.id, groups);
      if (room) {
        broadcastRoomUpdate(roomCode);
      }
    });

    // 10. Start Next Round (after round has ended)
    socket.on('startNextRound', ({ roomCode }) => {
      const room = gameStore.getRoom(roomCode);
      if (!room || (room.status !== 'ROUND_END' && room.status !== 'GAME_OVER')) return;

      // Start new round
      gameStore.startRound(roomCode);
      broadcastRoomUpdate(roomCode);
    });

    // 11. Send Chat Message
    socket.on('sendChatMessage', ({ roomCode, text }) => {
      const mapped = gameStore.socketToPlayer.get(socket.id);
      if (mapped) {
        const room = gameStore.getRoom(roomCode);
        const player = room.players.find(p => p.id === mapped.playerId);
        if (player) {
          const chatMsg = gameStore.addChat(roomCode, player.nickname, text);
          if (chatMsg) {
            io.to(roomCode).emit('chatMessageReceived', chatMsg);
          }
        }
      }
    });

    // 12. Reset Game (from Game Over back to lobby)
    socket.on('resetToLobby', ({ roomCode }) => {
      const room = gameStore.getRoom(roomCode);
      if (room) {
        room.status = 'LOBBY';
        room.roundNumber = 0;
        room.players.forEach(p => {
          p.score = 0;
          p.roundScore = 0;
          p.isReady = false;
        });
        gameStore.addLog(roomCode, "Game reset back to Lobby.");
        broadcastRoomUpdate(roomCode);
      }
    });

    // 13. Disconnect
    socket.on('disconnect', () => {
      const room = gameStore.handleDisconnect(socket.id);
      if (room) {
        broadcastRoomUpdate(room.code);
        // If room becomes empty, stop the loop
        if (room.players.length === 0) {
          stopRoomGameLoop(room.code);
        }
      }
    });
  });
}

// Room specific loop to manage timers (turn limits and declare limits)
function startRoomGameLoop(io, roomCode) {
  if (roomIntervals.has(roomCode)) return;

  const interval = setInterval(() => {
    const room = gameStore.getRoom(roomCode);
    if (!room) {
      stopRoomGameLoop(roomCode);
      return;
    }

    // 1. Handle PLAYING turn timeouts
    if (room.status === 'PLAYING' && room.currentPlayerIdx !== -1) {
      const currentPlayer = room.players[room.currentPlayerIdx];
      if (currentPlayer) {
        const elapsed = Math.floor((Date.now() - room.turnStartTime) / 1000);
        const turnLimit = room.settings.turnDuration;

        if (elapsed >= turnLimit) {
          // Time is up! Perform automated move for player to prevent stalling
          gameStore.addLog(roomCode, `${currentPlayer.nickname} ran out of time! Auto-playing...`);

          if (!currentPlayer.hasDrawn) {
            // Auto draw from closed deck
            gameStore.drawCard(roomCode, currentPlayer.socketId, 'deck');
          }

          // Fetch fresh state to ensure they have cards
          const updatedPlayer = room.players.find(p => p.id === currentPlayer.id);
          if (updatedPlayer && updatedPlayer.hand.length > 0) {
            // Auto discard their last card
            const lastCard = updatedPlayer.hand[updatedPlayer.hand.length - 1];
            gameStore.discardCard(roomCode, updatedPlayer.socketId, lastCard.id, false);
          }
          
          io.to(roomCode).emit('roomUpdated', room);
        }
      }
    }

    // 2. Handle DECLARING countdowns
    if (room.status === 'DECLARING' && room.declareState) {
      room.declareState.timeRemaining -= 1;
      
      if (room.declareState.timeRemaining <= 0) {
        // Trigger auto submit results
        gameStore.addLog(roomCode, `Declare submission time expired! Evaluating results.`);
        gameStore.processDeclarationResults(roomCode);
        io.to(roomCode).emit('roomUpdated', room);
      } else {
        // Just broadcast timer tick
        io.to(roomCode).emit('declareTimerTick', room.declareState.timeRemaining);
      }
    }
  }, 1000);

  roomIntervals.set(roomCode, interval);
}

function stopRoomGameLoop(roomCode) {
  const interval = roomIntervals.get(roomCode);
  if (interval) {
    clearInterval(interval);
    roomIntervals.delete(roomCode);
  }
}

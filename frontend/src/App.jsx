// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby.jsx';
import GameBoard from './components/GameBoard.jsx';
import { Volume2, VolumeX } from 'lucide-react';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null); // Local player details
  const [screen, setScreen] = useState('LOBBY'); // LOBBY, PLAYING, ROUND_END, GAME_OVER
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    // Connect to the hosted Render backend
    const backendUrl = 'https://playgame-fnku.onrender.com';
    
    console.log(`Connecting to Rummy server at: ${backendUrl}`);
    const newSocket = io(backendUrl, {
      transports: ['polling', 'websocket']
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to socket server:', newSocket.id);
      setError('');
    });

    newSocket.on('connect_error', () => {
      setError('Cannot connect to game server. Make sure the server is running and accessible on your network.');
    });

    newSocket.on('roomUpdated', (updatedRoom) => {
      setRoom(updatedRoom);
      
      // Update local player state
      if (player) {
        const freshPlayer = updatedRoom.players.find(p => p.id === player.id);
        if (freshPlayer) {
          setPlayer(freshPlayer);
        }
      }

      // Route screen based on room status
      if (updatedRoom.status === 'LOBBY') {
        setScreen('LOBBY');
      } else if (updatedRoom.status === 'PLAYING') {
        setScreen('PLAYING');
      } else if (updatedRoom.status === 'DECLARING') {
        setScreen('PLAYING'); // Declaring is shown overlay on the board
      } else if (updatedRoom.status === 'ROUND_END') {
        setScreen('ROUND_END');
      } else if (updatedRoom.status === 'GAME_OVER') {
        setScreen('GAME_OVER');
      }
    });

    newSocket.on('errorMsg', (msg) => {
      alert(msg);
    });

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Update local player if room list changes (useful after initial login/create)
  useEffect(() => {
    if (room && player) {
      const fresh = room.players.find(p => p.id === player.id);
      if (fresh) {
        setPlayer(fresh);
      }
    }
  }, [room]);

  return (
    <div className="min-h-screen felt-radial flex flex-col items-center justify-between text-gray-100 relative font-sans">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CiAgPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA0KSIgLz4KPC9zdmc+')] pointer-events-none" />

      {/* Header bar */}
      <header className="w-full max-w-7xl px-6 py-4 flex items-center justify-between z-10 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <span className="text-3xl filter drop-shadow-[0_2px_8px_rgba(234,179,8,0.3)] animate-pulse">♠️</span>
          <div>
            <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-300 bg-clip-text text-transparent tracking-widest uppercase font-sans">
              Championship Rummy
            </h1>
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping"></span>
              <p className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Live Table Server</p>
            </div>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center space-x-4">
          {room && (
            <div className="hidden sm:flex items-center bg-black/45 border border-amber-500/25 px-4.5 py-2 rounded-full text-xs shadow-inner">
              <span className="text-[10px] text-amber-500/70 mr-2 font-bold tracking-wider uppercase">TABLE CODE</span>
              <span className="font-extrabold text-amber-400 tracking-widest text-sm">{room.code}</span>
            </div>
          )}
          
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white hover:border-amber-500/30 transition-all shadow-md"
            title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
          >
            {soundEnabled ? <Volume2 size={18} className="text-amber-400" /> : <VolumeX size={18} />}
          </button>
        </div>
      </header>

      {/* Error alert */}
      {error && (
        <div className="w-full max-w-md mx-auto my-3 z-20 px-4">
          <div className="bg-red-950/90 border-2 border-red-500/50 p-4.5 rounded-2xl text-center shadow-2xl backdrop-blur-md">
            <span className="text-red-400 font-bold block text-sm mb-1 uppercase tracking-wider">Connection Issue</span>
            <p className="text-xs text-red-200 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Primary screens */}
      <main className="w-full flex-grow flex items-center justify-center p-4 max-w-7xl z-10">
        {screen === 'LOBBY' && (
          <Lobby 
            socket={socket} 
            setPlayer={setPlayer} 
            setRoom={setRoom} 
            room={room}
            player={player}
          />
        )}
        
        {screen === 'PLAYING' && (
          <GameBoard 
            socket={socket} 
            room={room} 
            player={player}
            soundEnabled={soundEnabled}
          />
        )}

        {(screen === 'ROUND_END' || screen === 'GAME_OVER') && (
          <div className="w-full max-w-2xl bg-slate-950/85 border border-amber-500/40 p-8 rounded-[2rem] shadow-2xl backdrop-blur-xl flex flex-col items-center animate-deal-card">
            <span className="text-6xl filter drop-shadow-[0_4px_12px_rgba(234,179,8,0.4)] mb-4 animate-bounce">
              {screen === 'GAME_OVER' ? '🏆' : '🏁'}
            </span>
            <h2 className="text-3xl font-black bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent mb-1 uppercase tracking-wider">
              {screen === 'GAME_OVER' ? 'Tournament Over!' : 'Round Complete'}
            </h2>
            <p className="text-xs text-gray-400 mb-6 font-medium tracking-wide">
              {screen === 'GAME_OVER' ? 'A champion has taken the table!' : `Round ${room.roundNumber} scoring results.`}
            </p>

            {/* Score List */}
            <div className="w-full max-h-72 overflow-y-auto mb-8 border border-white/10 rounded-2xl bg-black/40 p-5 shadow-inner">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase font-bold tracking-widest">
                    <th className="pb-3 pl-2">Player Seat</th>
                    <th className="pb-3 text-center">Round Score</th>
                    <th className="pb-3 pr-2 text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody>
                  {[...room.players].sort((a, b) => a.score - b.score).map((p, idx) => {
                    const isWinner = p.id === room.winnerId;
                    return (
                      <tr 
                        key={p.id} 
                        className={`border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${
                          isWinner ? 'bg-amber-500/10 text-amber-300' : ''
                        }`}
                      >
                        <td className="py-3.5 pl-2 flex items-center space-x-3">
                          <span className="text-2xl w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center">
                            {p.avatar}
                          </span>
                          <div>
                            <span className="font-extrabold text-sm flex items-center">
                              {p.nickname}
                              {isWinner && (
                                <span className="text-[9px] font-black uppercase bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded ml-2 tracking-wide shadow-sm">
                                  Winner
                                </span>
                              )}
                            </span>
                            {p.hasDropped && (
                              <span className="text-[9px] font-bold text-red-400 uppercase tracking-tight">
                                {p.dropType === 'FIRST' ? 'First Drop' : 'Middle Drop'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 text-center font-mono font-bold">
                          {p.hasDropped ? (
                            <span className="text-red-400">+{p.roundScore}</span>
                          ) : p.roundScore === 0 ? (
                            <span className="text-green-400 font-extrabold">0 pts</span>
                          ) : (
                            <span>+{p.roundScore} pts</span>
                          )}
                        </td>
                        <td className="py-3.5 pr-2 text-right font-black font-mono text-sm">
                          <span className={p.score >= room.settings.pointsLimit ? 'text-red-500 line-through' : ''}>
                            {p.score}
                          </span>
                          <span className="text-xs text-gray-500 font-normal"> / {room.settings.pointsLimit}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              {screen === 'GAME_OVER' ? (
                <>
                  <button
                    onClick={() => socket.emit('resetToLobby', { roomCode: room.code })}
                    className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 font-black rounded-2xl shadow-lg hover:shadow-glow-yellow transition-all uppercase tracking-wider text-xs"
                  >
                    Play Again (Lobby)
                  </button>
                  <button
                    onClick={() => {
                      setRoom(null);
                      setPlayer(null);
                      setScreen('LOBBY');
                    }}
                    className="px-8 py-3.5 bg-slate-900 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 font-bold rounded-2xl transition-all uppercase tracking-wider text-xs"
                  >
                    Leave Room
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => socket.emit('startNextRound', { roomCode: room.code })}
                    className="px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:brightness-110 active:scale-95 text-white font-black rounded-2xl shadow-lg hover:shadow-green-500/20 transition-all uppercase tracking-wider text-xs"
                  >
                    Start Next Round
                  </button>
                  <button
                    onClick={() => {
                      setRoom(null);
                      setPlayer(null);
                      setScreen('LOBBY');
                    }}
                    className="px-8 py-3.5 bg-slate-900 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 font-bold rounded-2xl transition-all uppercase tracking-wider text-xs"
                  >
                    Leave Game
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer bar */}
      <footer className="w-full py-4 text-center text-[10px] text-gray-500 border-t border-white/5 bg-black/40 backdrop-blur-md z-10">
        <p className="font-medium tracking-wider uppercase">♠️ Championship Rummy ♣️ Modern Deluxe Seating Platform © 2026</p>
      </footer>
    </div>
  );
}

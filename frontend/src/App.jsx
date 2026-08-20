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
    // Dynamically connect to backend
    // If we are in dev (served on Vite port 5173), connect to backend port 5000.
    // In production, connect directly to the origin host that served the frontend!
    const isDev = window.location.port === '5173';
    const backendUrl = isDev 
      ? `http://${window.location.hostname}:5000` 
      : window.location.origin;
    
    console.log(`Connecting to Rummy server at: ${backendUrl}`);
    const newSocket = io(backendUrl, {
      transports: ['websocket', 'polling']
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
    <div className="min-h-screen felt-radial flex flex-col items-center justify-between text-gray-100 relative">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.5)_100%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CiAgPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgLz4KPC9zdmc+')] pointer-events-none" />

      {/* Header bar */}
      <header className="w-full max-w-7xl px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2">
          <span className="text-3xl">♠️</span>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent tracking-wider uppercase font-sans">
              Championship Rummy
            </h1>
            <p className="text-xs text-green-400 font-medium">Online Multiplayer</p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center space-x-4">
          {room && (
            <div className="hidden sm:flex items-center bg-black/40 border border-green-800 px-3 py-1.5 rounded-full text-sm">
              <span className="text-xs text-gray-400 mr-2">ROOM CODE:</span>
              <span className="font-bold text-amber-400 tracking-widest">{room.code}</span>
            </div>
          )}
          
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </header>

      {/* Error alert */}
      {error && (
        <div className="w-full max-w-md mx-auto my-2 z-20 px-4">
          <div className="bg-red-950/80 border-2 border-red-700 p-4 rounded-xl text-center shadow-lg backdrop-blur-md">
            <span className="text-red-400 font-semibold block text-sm mb-1">Network Error</span>
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
          <div className="w-full max-w-2xl bg-slate-900/90 border border-amber-500/30 p-8 rounded-3xl shadow-2xl backdrop-blur-lg flex flex-col items-center">
            <span className="text-5xl mb-4">{screen === 'GAME_OVER' ? '🏆' : '🏁'}</span>
            <h2 className="text-3xl font-extrabold text-amber-400 mb-2">
              {screen === 'GAME_OVER' ? 'Match Complete!' : 'Round Finished'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {screen === 'GAME_OVER' ? 'We have a tournament champion!' : `Round ${room.roundNumber} is over.`}
            </p>

            {/* Score List */}
            <div className="w-full max-h-72 overflow-y-auto mb-8 border border-white/5 rounded-xl bg-black/30 p-4">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-xs">
                    <th className="pb-2">Player</th>
                    <th className="pb-2 text-center">Round Score</th>
                    <th className="pb-2 text-right">Cumulative Score</th>
                  </tr>
                </thead>
                <tbody>
                  {[...room.players].sort((a, b) => a.score - b.score).map((p, idx) => (
                    <tr 
                      key={p.id} 
                      className={`border-b border-white/5 last:border-0 ${p.id === room.winnerId ? 'bg-amber-500/10 text-amber-300' : ''}`}
                    >
                      <td className="py-3 flex items-center space-x-2">
                        <span className="text-lg">{p.avatar}</span>
                        <div>
                          <span className="font-semibold">{p.nickname}</span>
                          {p.id === room.winnerId && <span className="text-xs text-amber-400 ml-1.5 font-medium">(Winner)</span>}
                          {p.hasDropped && <span className="text-xs text-gray-500 ml-1.5">({p.dropType === 'FIRST' ? 'First Drop' : 'Middle Drop'})</span>}
                        </div>
                      </td>
                      <td className="py-3 text-center font-mono">
                        {p.hasDropped ? `+${p.roundScore}` : p.roundScore} pts
                      </td>
                      <td className="py-3 text-right font-bold font-mono">
                        {p.score} / {room.settings.pointsLimit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full justify-center">
              {screen === 'GAME_OVER' ? (
                <>
                  <button
                    onClick={() => socket.emit('resetToLobby', { roomCode: room.code })}
                    className="px-8 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all font-sans text-sm"
                  >
                    Play Again (Lobby)
                  </button>
                  <button
                    onClick={() => {
                      setRoom(null);
                      setPlayer(null);
                      setScreen('LOBBY');
                    }}
                    className="px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 font-bold rounded-xl transition-all text-sm"
                  >
                    Leave Room
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => socket.emit('startNextRound', { roomCode: room.code })}
                    className="px-8 py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all font-sans text-sm"
                  >
                    Start Next Round
                  </button>
                  <button
                    onClick={() => {
                      setRoom(null);
                      setPlayer(null);
                      setScreen('LOBBY');
                    }}
                    className="px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 font-bold rounded-xl transition-all text-sm"
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
      <footer className="w-full py-4 text-center text-xs text-gray-500 border-t border-white/5 bg-black/20 z-10">
        <p>© 2026 Championship Rummy. Designed with premium visual felt-felt aesthetics.</p>
      </footer>
    </div>
  );
}

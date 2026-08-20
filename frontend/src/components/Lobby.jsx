// frontend/src/components/Lobby.jsx
import React, { useState } from 'react';
import { Copy, Check, Users, Settings, Play, ShieldAlert } from 'lucide-react';

const AVATARS = ['🥷', '🦊', '🐼', '🦁', '🐯', '🐨', '🐔', '🦄', '🦖', '🐙', '🐸', '🦉', '🐱', '🐶'];

export default function Lobby({ socket, setPlayer, setRoom, room, player }) {
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Custom game settings
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [turnDuration, setTurnDuration] = useState(30);
  const [pointsLimit, setPointsLimit] = useState(101);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return alert('Please enter a nickname!');
    
    socket.emit('createRoom', {
      nickname: nickname.trim(),
      avatar: selectedAvatar,
      settings: {
        maxPlayers: parseInt(maxPlayers, 10),
        turnDuration: parseInt(turnDuration, 10),
        pointsLimit: parseInt(pointsLimit, 10)
      }
    }, (response) => {
      if (response.error) {
        alert(response.error);
      } else {
        setPlayer(response.player);
        setRoom(response.room);
      }
    });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return alert('Please enter a nickname!');
    if (!roomCodeInput.trim()) return alert('Please enter a Room Code!');

    socket.emit('joinRoom', {
      roomCode: roomCodeInput.trim(),
      nickname: nickname.trim(),
      avatar: selectedAvatar
    }, (response) => {
      if (response.error) {
        alert(response.error);
      } else {
        setPlayer(response.player);
        setRoom(response.room);
      }
    });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If already in a room lobby, show the lobby waiting screen
  if (room) {
    const isHost = room.players[0] && room.players[0].id === player?.id;
    const readyPlayersCount = room.players.filter(p => p.isReady).length;
    const canStart = room.players.length >= 2;

    return (
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 animate-deal-card">
        {/* Left Column: Player seating */}
        <div className="md:col-span-2 bg-slate-900/80 border border-white/5 rounded-3xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
            <div>
              <h2 className="text-xl font-bold flex items-center space-x-2">
                <Users size={20} className="text-amber-400" />
                <span>Club Room Lobby</span>
              </h2>
              <p className="text-xs text-gray-400">Players currently seated at the table</p>
            </div>
            <span className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-1 rounded-full font-bold border border-amber-500/20">
              {room.players.length} / {room.settings.maxPlayers} Seated
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-1">
            {room.players.map((p, idx) => (
              <div 
                key={p.id} 
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  p.id === player?.id 
                    ? 'bg-amber-500/5 border-amber-500/20 shadow-md' 
                    : 'bg-black/20 border-white/5'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl p-2 rounded-xl bg-slate-800 border border-white/5">{p.avatar}</span>
                  <div>
                    <span className="font-semibold text-sm flex items-center">
                      {p.nickname}
                      {idx === 0 && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded ml-1.5">Host</span>}
                      {p.id === player?.id && <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded ml-1.5">You</span>}
                    </span>
                    <span className="text-xs text-gray-400">Seat {idx + 1}</span>
                  </div>
                </div>

                <div>
                  {idx === 0 ? (
                    <span className="text-xs font-semibold text-amber-400 border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 rounded-full">
                      Organizer
                    </span>
                  ) : p.isReady ? (
                    <span className="text-xs font-semibold text-green-400 border border-green-500/20 bg-green-500/5 px-2.5 py-1 rounded-full">
                      Ready
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-gray-500 border border-white/5 bg-white/5 px-2.5 py-1 rounded-full">
                      Waiting
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-white/5 gap-4">
            <button
              onClick={() => socket.emit('disconnect')}
              className="px-6 py-3 border border-white/10 hover:border-red-500/20 hover:bg-red-500/10 font-bold rounded-xl transition-all text-sm w-full sm:w-auto"
            >
              Leave Room
            </button>
            
            {isHost ? (
              <button
                onClick={() => socket.emit('startGame', { roomCode: room.code })}
                disabled={!canStart}
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 disabled:from-slate-800 disabled:to-slate-800 hover:brightness-110 disabled:brightness-100 disabled:opacity-40 text-slate-950 font-bold rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/10 transition-all text-sm w-full sm:w-auto"
              >
                <Play size={16} fill="currentColor" />
                <span>Start Match ({room.players.length} Players)</span>
              </button>
            ) : (
              <button
                onClick={() => socket.emit('toggleReady', { roomCode: room.code })}
                className={`px-8 py-3 font-bold rounded-xl shadow-lg transition-all text-sm w-full sm:w-auto ${
                  player?.isReady 
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/10' 
                    : 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/10'
                }`}
              >
                {player?.isReady ? 'Not Ready' : 'Ready Up'}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Room details & Share code */}
        <div className="space-y-6">
          {/* Room Code Card */}
          <div className="bg-slate-900/80 border border-white/5 rounded-3xl p-6 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center">
            <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Room Share Code</span>
            <div className="bg-black/30 border border-white/5 px-6 py-3 rounded-2xl flex items-center justify-between space-x-3 w-full mb-4">
              <span className="text-2xl font-bold font-mono tracking-widest text-amber-400 select-all">{room.code}</span>
              <button 
                onClick={copyRoomCode}
                className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all"
              >
                {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Copy this code and send it to your friends to play from different computers, phones, or tablets!
            </p>
          </div>

          {/* Room Settings Card */}
          <div className="bg-slate-900/80 border border-white/5 rounded-3xl p-6 shadow-xl backdrop-blur-md">
            <h3 className="font-bold text-sm text-gray-300 flex items-center space-x-2 mb-4 pb-2 border-b border-white/5">
              <Settings size={16} className="text-amber-400" />
              <span>Room Game Settings</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Maximum Players:</span>
                <span className="font-semibold text-gray-200">{room.settings.maxPlayers} Players</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Turn Timer Limit:</span>
                <span className="font-semibold text-gray-200">{room.settings.turnDuration} Seconds</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Points Dropout Limit:</span>
                <span className="font-semibold text-gray-200">{room.settings.pointsLimit} Points</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Deck Configuration:</span>
                <span className="font-semibold text-amber-500">
                  {room.settings.maxPlayers <= 3 ? '2 Decks (108 cards)' : room.settings.maxPlayers <= 6 ? '3 Decks (162 cards)' : '4 Decks (216 cards)'}
                </span>
              </div>
            </div>
            
            {!canStart && (
              <div className="mt-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start space-x-2 text-[11px] text-amber-300 leading-relaxed">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <span>Waiting for other players to join. You need a minimum of 2 players to start a Rummy match.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Login Screen (Create / Join form)
  return (
    <div className="w-full max-w-lg bg-slate-900/80 border border-white/5 p-8 rounded-3xl shadow-2xl backdrop-blur-md animate-deal-card">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-extrabold text-white tracking-wide">Enter the Card Room</h2>
        <p className="text-xs text-gray-400 mt-1">Configure your seat and join a Rummy room</p>
      </div>

      {/* Nickname & Avatar Selection */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Choose Your Avatar
          </label>
          <div className="flex items-center justify-between gap-2 overflow-x-auto py-2 px-1 border border-white/5 rounded-2xl bg-black/20">
            {AVATARS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedAvatar(emoji)}
                className={`text-2xl p-2 rounded-xl border transition-all hover:scale-110 active:scale-95 shrink-0 ${
                  selectedAvatar === emoji 
                    ? 'border-amber-400 bg-amber-500/10 shadow-inner' 
                    : 'border-transparent bg-transparent hover:bg-white/5'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="nickname" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Enter Nickname
          </label>
          <input
            id="nickname"
            type="text"
            placeholder="E.g., AcePlayer"
            maxLength={12}
            value={nickname}
            onChange={(e) => setNickname(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))}
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white transition-all text-sm font-semibold"
          />
        </div>
      </div>

      {/* Mode selectors */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setIsCreating(false)}
          className={`py-3 font-semibold rounded-2xl border transition-all text-sm ${
            !isCreating 
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' 
              : 'bg-black/20 border-white/5 text-gray-400 hover:text-white'
          }`}
        >
          Join a Room
        </button>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className={`py-3 font-semibold rounded-2xl border transition-all text-sm ${
            isCreating 
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' 
              : 'bg-black/20 border-white/5 text-gray-400 hover:text-white'
          }`}
        >
          Create a Room
        </button>
      </div>

      {/* Conditional Forms */}
      {isCreating ? (
        <form onSubmit={handleCreateRoom} className="space-y-5 animate-deal-card">
          <div className="space-y-4 bg-black/20 border border-white/5 p-4 rounded-2xl">
            {/* Max Players Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400 font-medium">Max Players</label>
                <span className="text-xs font-bold text-amber-400">{maxPlayers} Players</span>
              </div>
              <input 
                type="range" 
                min={2} 
                max={10} 
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <p className="text-[10px] text-gray-500 mt-1">Indian Rummy supports up to 10 players by dynamically adding decks.</p>
            </div>

            {/* Turn Timer slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400 font-medium">Turn Duration Limit</label>
                <span className="text-xs font-bold text-amber-400">{turnDuration} seconds</span>
              </div>
              <input 
                type="range" 
                min={15} 
                max={90} 
                step={5}
                value={turnDuration}
                onChange={(e) => setTurnDuration(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Target Score Limit */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400 font-medium">Dropout Score Limit</label>
                <span className="text-xs font-bold text-amber-400">{pointsLimit} points</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[60, 101, 201].map(score => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setPointsLimit(score)}
                    className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                      pointsLimit === score 
                        ? 'border-amber-400 bg-amber-500/10 text-amber-300' 
                        : 'border-white/5 bg-black/20 text-gray-400 hover:text-white'
                    }`}
                  >
                    {score} Points
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/10 transition-all text-sm font-sans"
          >
            Create Table & Seating
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoinRoom} className="space-y-5 animate-deal-card">
          <div>
            <label htmlFor="roomCode" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Enter 5-Letter Room Code
            </label>
            <input
              id="roomCode"
              type="text"
              placeholder="E.g., XLKWD"
              maxLength={5}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white tracking-widest font-mono text-center text-lg font-bold transition-all placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/10 transition-all text-sm font-sans"
          >
            Join Seated Game
          </button>
        </form>
      )}
    </div>
  );
}

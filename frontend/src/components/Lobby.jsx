// frontend/src/components/Lobby.jsx
import React, { useState } from 'react';
import { Copy, Check, Users, Settings, Play, ShieldAlert, Sparkles, User, Clock, Award, HelpCircle } from 'lucide-react';

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
  const [jokerMode, setJokerMode] = useState('open');

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return alert('Please enter a nickname!');
    
    socket.emit('createRoom', {
      nickname: nickname.trim(),
      avatar: selectedAvatar,
      settings: {
        maxPlayers: parseInt(maxPlayers, 10),
        turnDuration: parseInt(turnDuration, 10),
        pointsLimit: parseInt(pointsLimit, 10),
        jokerMode: jokerMode
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
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 animate-deal-card font-sans">
        {/* Left Column: Player seating */}
        <div className="md:col-span-2 bg-slate-950/80 border border-white/10 rounded-[2rem] p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
            <div>
              <h2 className="text-xl font-black flex items-center space-x-2.5 text-white uppercase tracking-wider">
                <Users size={20} className="text-amber-400" />
                <span>Card Table Lobby</span>
              </h2>
              <p className="text-xs text-gray-400">Players currently seated at the table</p>
            </div>
            <span className="bg-amber-500/10 text-amber-400 text-xs px-3.5 py-1.5 rounded-full font-extrabold border border-amber-500/25">
              {room.players.length} / {room.settings.maxPlayers} Seated
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-1">
            {room.players.map((p, idx) => {
              const isLocalPlayer = p.id === player?.id;
              const isHostPlayer = idx === 0;
              return (
                <div 
                  key={p.id} 
                  className={`flex items-center justify-between p-4.5 rounded-2xl border transition-all ${
                    isLocalPlayer 
                      ? 'bg-amber-500/5 border-amber-500/30 shadow-md ring-1 ring-amber-500/10' 
                      : 'bg-black/35 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <span className="text-2xl p-2.5 rounded-2xl bg-slate-900 border border-white/10 shadow-inner shrink-0">
                      {p.avatar}
                    </span>
                    <div>
                      <span className="font-extrabold text-sm flex items-center text-white">
                        {p.nickname}
                        {isHostPlayer && (
                          <span className="text-[8px] font-black uppercase bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded ml-1.5 tracking-wider">
                            Host
                          </span>
                        )}
                        {isLocalPlayer && (
                          <span className="text-[8px] font-black uppercase bg-green-500 text-slate-950 px-1.5 py-0.5 rounded ml-1.5 tracking-wider">
                            You
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Seat #{idx + 1}</span>
                    </div>
                  </div>

                  <div>
                    {isHostPlayer ? (
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 rounded-full">
                        Organizer
                      </span>
                    ) : p.isReady ? (
                      <span className="text-[10px] font-black uppercase tracking-wider text-green-400 border border-green-500/35 bg-green-500/5 px-2.5 py-1.5 rounded-full animate-pulse-glow">
                        Ready
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 border border-white/10 bg-white/5 px-2.5 py-1.5 rounded-full">
                        Waiting
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-white/5 gap-4">
            <button
              onClick={() => socket.emit('disconnect')}
              className="px-6 py-3.5 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 font-bold rounded-2xl transition-all text-xs w-full sm:w-auto text-gray-300 hover:text-white uppercase tracking-wider"
            >
              Leave Room
            </button>
            
            {isHost ? (
              <button
                onClick={() => socket.emit('startGame', { roomCode: room.code })}
                disabled={!canStart}
                className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 disabled:from-slate-800 disabled:to-slate-800 hover:brightness-110 disabled:brightness-100 disabled:opacity-40 text-slate-950 font-black rounded-2xl flex items-center justify-center space-x-2.5 shadow-lg hover:shadow-glow-yellow transition-all text-xs w-full sm:w-auto uppercase tracking-wider"
              >
                <Play size={14} fill="currentColor" />
                <span>Start Match ({room.players.length} Players)</span>
              </button>
            ) : (
              <button
                onClick={() => socket.emit('toggleReady', { roomCode: room.code })}
                className={`px-8 py-3.5 font-black rounded-2xl shadow-lg transition-all text-xs w-full sm:w-auto uppercase tracking-wider ${
                  player?.isReady 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:brightness-110 text-white shadow-red-600/10' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:brightness-110 text-white shadow-green-600/10'
                }`}
              >
                {player?.isReady ? 'Cancel Ready' : 'Ready Up'}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Room details & Share code */}
        <div className="space-y-6">
          {/* Room Code Card */}
          <div className="bg-slate-950/80 border border-white/10 rounded-[2rem] p-6 shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-15">
              <Sparkles size={48} className="text-amber-400" />
            </div>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2">Share Room Invitation</span>
            <div className="bg-black/40 border border-white/10 px-5 py-3 rounded-2xl flex items-center justify-between space-x-3 w-full mb-4.5 shadow-inner">
              <span className="text-2xl font-black font-mono tracking-[0.25em] text-amber-400 pl-2">{room.code}</span>
              <button 
                onClick={copyRoomCode}
                className="p-2 bg-white/5 border border-white/5 hover:border-amber-500/20 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all active:scale-90 shadow"
                title="Copy code"
              >
                {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
              Copy this code and send it to other players. They can join your private rummy table instantly.
            </p>
          </div>

          {/* Room Settings Card */}
          <div className="bg-slate-950/80 border border-white/10 rounded-[2rem] p-6 shadow-2xl backdrop-blur-xl">
            <h3 className="font-extrabold text-sm text-white flex items-center space-x-2 mb-4 pb-2.5 border-b border-white/5 uppercase tracking-wider">
              <Settings size={16} className="text-amber-400" />
              <span>Room Rules</span>
            </h3>

            <div className="space-y-4 text-xs font-semibold">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-400 flex items-center gap-1.5"><User size={13} /> Max Players</span>
                <span className="text-gray-200">{room.settings.maxPlayers} Players</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-400 flex items-center gap-1.5"><Clock size={13} /> Turn Timer</span>
                <span className="text-gray-200">{room.settings.turnDuration}s Limit</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-400 flex items-center gap-1.5"><Award size={13} /> Dropout Limit</span>
                <span className="text-gray-200 font-mono">{room.settings.pointsLimit} Points</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-400 flex items-center gap-1.5">🃏 Joker Mode</span>
                <span className="text-amber-400 capitalize">{room.settings.jokerMode || 'open'}</span>
              </div>
              <div className="flex items-center justify-between last:border-0 last:pb-0">
                <span className="text-gray-400">🃏 Deck Size</span>
                <span className="text-amber-500 font-bold">
                  {room.settings.maxPlayers <= 3 ? '2 Decks (108c)' : room.settings.maxPlayers <= 6 ? '3 Decks (162c)' : '4 Decks (216c)'}
                </span>
              </div>
            </div>
            
            {!canStart && (
              <div className="mt-5 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/25 flex items-start space-x-2.5 text-[11px] text-amber-300/90 leading-relaxed shadow-sm">
                <ShieldAlert size={14} className="shrink-0 mt-0.5 text-amber-400" />
                <span>Need at least 2 players to deal cards and start the Rummy match.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Login Screen (Create / Join form)
  return (
    <div className="w-full max-w-lg bg-slate-950/80 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-xl animate-deal-card relative font-sans">
      <div className="absolute -top-12 -left-12 w-24 h-24 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-white uppercase tracking-wider">Casino Room Entry</h2>
        <p className="text-xs text-gray-400 mt-1">Select an avatar and enter your seated table</p>
      </div>

      {/* Nickname & Avatar Selection */}
      <div className="mb-6 space-y-5">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">
            Choose Table Identity
          </label>
          <div className="flex items-center justify-between gap-2 overflow-x-auto py-2 px-2 border border-white/5 rounded-2xl bg-black/40 shadow-inner">
            {AVATARS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedAvatar(emoji)}
                className={`text-2xl p-2 rounded-xl border transition-all hover:scale-110 shrink-0 ${
                  selectedAvatar === emoji 
                    ? 'border-amber-400 bg-amber-500/15 shadow-glow-yellow scale-105' 
                    : 'border-transparent bg-transparent hover:bg-white/5'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="nickname" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
            Enter Player Nickname
          </label>
          <input
            id="nickname"
            type="text"
            placeholder="E.g., AceRummy"
            maxLength={12}
            value={nickname}
            onChange={(e) => setNickname(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))}
            className="w-full bg-black/45 border border-white/10 rounded-2xl px-4 py-3.5 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none text-white transition-all text-sm font-bold placeholder:text-gray-600 shadow-inner"
          />
        </div>
      </div>

      {/* Mode selectors */}
      <div className="grid grid-cols-2 gap-3 mb-6 bg-black/20 p-1 rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => setIsCreating(false)}
          className={`py-3 font-extrabold rounded-xl transition-all text-xs uppercase tracking-wider ${
            !isCreating 
              ? 'bg-slate-900 border border-white/10 text-amber-400 shadow-md' 
              : 'text-gray-400 hover:text-white bg-transparent border-transparent'
          }`}
        >
          Join Private Room
        </button>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className={`py-3 font-extrabold rounded-xl transition-all text-xs uppercase tracking-wider ${
            isCreating 
              ? 'bg-slate-900 border border-white/10 text-amber-400 shadow-md' 
              : 'text-gray-400 hover:text-white bg-transparent border-transparent'
          }`}
        >
          Create Room Rules
        </button>
      </div>

      {/* Conditional Forms */}
      {isCreating ? (
        <form onSubmit={handleCreateRoom} className="space-y-6 animate-deal-card">
          <div className="space-y-4 bg-black/35 border border-white/5 p-5 rounded-2xl shadow-inner">
            {/* Max Players Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Maximum Seating</label>
                <span className="text-xs font-black text-amber-400 font-mono">{maxPlayers} Players</span>
              </div>
              <input 
                type="range" 
                min={2} 
                max={10} 
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <p className="text-[9px] text-gray-500 mt-1 font-medium"> ভারতীয় Rummy supports up to 10 players by dynamically adjusting decks.</p>
            </div>

            {/* Turn Timer slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Turn Clock Duration</label>
                <span className="text-xs font-black text-amber-400 font-mono">{turnDuration} seconds</span>
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
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Target Dropout Points</label>
                <span className="text-xs font-black text-amber-400 font-mono">{pointsLimit} points</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[60, 101, 201].map(score => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setPointsLimit(score)}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      pointsLimit === score 
                        ? 'border-amber-400 bg-amber-500/10 text-amber-300 shadow-glow-yellow' 
                        : 'border-white/5 bg-black/20 text-gray-400 hover:text-white'
                    }`}
                  >
                    {score} Points
                  </button>
                ))}
              </div>
            </div>

            {/* Joker Mode Selector */}
            <div>
              <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Wildcard Joker Settings</label>
              <div className="grid grid-cols-2 gap-2">
                {['open', 'secret'].map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setJokerMode(mode)}
                    className={`py-2.5 rounded-xl border text-xs font-bold capitalize transition-all ${
                      jokerMode === mode 
                        ? 'border-amber-400 bg-amber-500/10 text-amber-300 shadow-glow-yellow' 
                        : 'border-white/5 bg-black/20 text-gray-400 hover:text-white'
                    }`}
                  >
                    {mode === 'open' ? '📖 Open Joker' : '🔒 Secret Joker'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:brightness-110 active:scale-95 text-slate-950 font-black rounded-2xl shadow-xl hover:shadow-glow-yellow transition-all text-xs uppercase tracking-widest font-sans"
          >
            Create Private Table
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoinRoom} className="space-y-6 animate-deal-card">
          <div>
            <label htmlFor="roomCode" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-center">
              Enter 5-Letter Table Invite Code
            </label>
            <input
              id="roomCode"
              type="text"
              placeholder="E.g., RTWYQ"
              maxLength={5}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              className="w-full bg-black/45 border border-white/10 rounded-2xl px-4 py-4 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none text-white tracking-[0.3em] font-mono text-center text-xl font-black transition-all placeholder:font-sans placeholder:text-sm placeholder:tracking-normal shadow-inner"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:brightness-110 active:scale-95 text-slate-950 font-black rounded-2xl shadow-xl hover:shadow-glow-yellow transition-all text-xs uppercase tracking-widest font-sans"
          >
            Join Seated Game
          </button>
        </form>
      )}
    </div>
  );
}

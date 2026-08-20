// frontend/src/components/GameBoard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Play, LogOut, MessageSquare, Send, Sparkles, SlidersHorizontal, Trash2, ShieldAlert, Award } from 'lucide-react';
import confetti from 'canvas-confetti';

const SUIT_SYMBOLS = { H: '♥️', D: '♦️', C: '♣️', S: '♠️', J: '🃏' };
const SUIT_NAMES = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades', J: 'Joker' };

export default function GameBoard({ socket, room, player, soundEnabled }) {
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [declareTimer, setDeclareTimer] = useState(30);
  const chatEndRef = useRef(null);

  // Play audio note on events
  const playSound = (type) => {
    if (!soundEnabled) return;
    try {
      const frequencies = {
        draw: 600,
        discard: 400,
        group: 520,
        win: [523.25, 659.25, 783.99, 1046.50] // C major chord
      };
      
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      if (type === 'win') {
        frequencies.win.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1);
          gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.4);
          osc.start(ctx.currentTime + i * 0.1);
          osc.stop(ctx.currentTime + i * 0.1 + 0.5);
        });
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(frequencies[type] || 500, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      console.warn("Audio context not supported/allowed yet");
    }
  };

  // Trigger win confetti
  useEffect(() => {
    if (room.status === 'ROUND_END' && room.winnerId === player?.id) {
      playSound('win');
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  }, [room.status]);

  // Listen to declaration timer
  useEffect(() => {
    const handleTimerTick = (time) => {
      setDeclareTimer(time);
    };
    socket.on('declareTimerTick', handleTimerTick);
    return () => {
      socket.off('declareTimerTick', handleTimerTick);
    };
  }, [socket]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room.chatLogs, chatOpen]);

  if (!player || !room) return null;

  const isMyTurn = room.status === 'PLAYING' && room.players[room.currentPlayerIdx]?.id === player.id;
  const isDeclaringMode = room.status === 'DECLARING';
  const hasDrawn = player.hasDrawn;

  // Check if a card is acting as wild joker
  const isCardWildJoker = (card) => {
    if (!card) return false;
    if (card.suit === 'J' && card.rank === 'JOKER') return true; // Printed Joker
    if (room.wildJoker) {
      if (room.wildJoker.suit === 'J' && room.wildJoker.rank === 'JOKER') {
        return card.rank === 'A';
      }
      return card.rank === room.wildJoker.rank;
    }
    return false;
  };

  // Select card toggle
  const toggleSelectCard = (cardId) => {
    const next = new Set(selectedCardIds);
    if (next.has(cardId)) {
      next.delete(cardId);
    } else {
      next.add(cardId);
    }
    setSelectedCardIds(next);
  };

  // Sorting handlers
  const handleSort = (type) => {
    // Collect all cards currently in player's groups
    const allCards = player.groups.flat();
    if (allCards.length === 0) return;

    let sortedGroups = [];

    if (type === 'suit') {
      // Sort by suit (H, D, C, S)
      const suitsMap = { H: [], D: [], C: [], S: [], J: [] };
      allCards.forEach(c => {
        const targetSuit = isCardWildJoker(c) ? 'J' : c.suit; // Put wild cards together or in natural suit
        suitsMap[targetSuit].push(c);
      });

      // Sort cards within suits by numerical rank
      const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'JOKER'];
      Object.keys(suitsMap).forEach(s => {
        suitsMap[s].sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank));
        if (suitsMap[s].length > 0) {
          sortedGroups.push(suitsMap[s]);
        }
      });
    } else if (type === 'rank') {
      // Sort by rank
      const rankMap = {};
      allCards.forEach(c => {
        if (!rankMap[c.rank]) rankMap[c.rank] = [];
        rankMap[c.rank].push(c);
      });

      const rankOrder = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER'];
      rankOrder.forEach(r => {
        if (rankMap[r] && rankMap[r].length > 0) {
          sortedGroups.push(rankMap[r]);
        }
      });
    }

    socket.emit('groupCards', { roomCode: room.code, groups: sortedGroups });
    setSelectedCardIds(new Set());
    playSound('group');
  };

  // Group selected cards
  const handleGroupSelected = () => {
    if (selectedCardIds.size < 2) return alert('Select at least 2 cards to form a group.');

    const newGroup = [];
    const remainingCardsGroups = [];

    // Extract selected cards and keep non-selected cards
    player.groups.forEach(group => {
      const groupRem = [];
      group.forEach(card => {
        if (selectedCardIds.has(card.id)) {
          newGroup.push(card);
        } else {
          groupRem.push(card);
        }
      });
      if (groupRem.length > 0) {
        remainingCardsGroups.push(groupRem);
      }
    });

    const finalGroups = [...remainingCardsGroups, newGroup];
    socket.emit('groupCards', { roomCode: room.code, groups: finalGroups });
    setSelectedCardIds(new Set());
    playSound('group');
  };

  // Move selected cards to a specific group
  const handleMoveToGroup = (targetGroupIdx) => {
    if (selectedCardIds.size === 0) return;

    // Collect all selected cards
    const selectedCards = [];
    const updatedGroups = player.groups.map(group => {
      return group.filter(card => {
        if (selectedCardIds.has(card.id)) {
          selectedCards.push(card);
          return false;
        }
        return true;
      });
    }).filter(group => group.length > 0);

    // Insert selected cards into targeted group
    if (updatedGroups[targetGroupIdx]) {
      updatedGroups[targetGroupIdx] = [...updatedGroups[targetGroupIdx], ...selectedCards];
    } else {
      updatedGroups.push(selectedCards);
    }

    socket.emit('groupCards', { roomCode: room.code, groups: updatedGroups });
    setSelectedCardIds(new Set());
    playSound('group');
  };

  // Dissolve/Delete group (put all cards back to first group)
  const handleDissolveGroup = (groupIndex) => {
    if (player.groups.length <= 1) return;
    const targetGroup = player.groups[groupIndex];
    const newGroups = player.groups.filter((_, idx) => idx !== groupIndex);
    newGroups[0] = [...newGroups[0], ...targetGroup];

    socket.emit('groupCards', { roomCode: room.code, groups: newGroups });
    setSelectedCardIds(new Set());
    playSound('group');
  };

  // Draw card handler
  const handleDraw = (source) => {
    if (!isMyTurn) return;
    if (hasDrawn) return alert('You already drew a card! Discard one to complete turn.');
    socket.emit('drawCard', { roomCode: room.code, source });
    playSound('draw');
  };

  // Discard card handler
  const handleDiscard = (isFinish = false) => {
    if (!isMyTurn) return;
    if (!hasDrawn) return alert('Draw a card from the closed deck or open pile first!');
    if (selectedCardIds.size !== 1) return alert('Select exactly 1 card to discard.');

    const cardId = Array.from(selectedCardIds)[0];
    socket.emit('discardCard', { roomCode: room.code, cardId, isFinish });
    setSelectedCardIds(new Set());
    playSound('discard');
  };

  // Drop round handler
  const handleDrop = () => {
    const confirmDrop = window.confirm('Are you sure you want to Drop this round? (First Drop: 20 pts, Middle Drop: 40 pts)');
    if (confirmDrop) {
      socket.emit('dropRound', { roomCode: room.code });
    }
  };

  // Declare submit handler
  const handleSubmitDeclaration = () => {
    socket.emit('submitDeclaration', { roomCode: room.code, groups: player.groups });
    alert('Hand submitted for evaluation. Waiting for others.');
  };

  // Chat submit
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('sendChatMessage', { roomCode: room.code, text: chatInput.trim() });
    setChatInput('');
  };

  // Render a Single Playing Card component
  const renderCard = (card, groupIdx, cardIdx, options = {}) => {
    const isSelected = selectedCardIds.has(card.id);
    const isWild = isCardWildJoker(card);
    const isRed = ['H', 'D'].includes(card.suit);
    const suitSymbol = SUIT_SYMBOLS[card.suit] || '🃏';

    return (
      <div
        key={card.id}
        onClick={() => !options.disabled && toggleSelectCard(card.id)}
        style={{
          marginLeft: cardIdx > 0 ? '-2rem' : '0px',
          zIndex: 10 + cardIdx,
        }}
        className={`w-14 h-20 sm:w-16 sm:h-24 bg-white rounded-xl shadow-card select-none flex flex-col justify-between p-1.5 sm:p-2 border-2 cursor-pointer transition-all relative transform hover:-translate-y-2 active:scale-95 ${
          isSelected 
            ? 'border-amber-400 bg-amber-50 shadow-card-hover -translate-y-4 ring-2 ring-amber-400/50' 
            : 'border-slate-300'
        } ${isWild ? 'ring-2 ring-yellow-400' : ''}`}
      >
        {/* Wild card gold ribbon indicator */}
        {isWild && (
          <div className="absolute top-0 right-0 bg-yellow-400 text-slate-900 font-bold px-1 rounded-bl-lg rounded-tr-lg text-[8px] uppercase tracking-wider scale-90">
            Joker
          </div>
        )}

        {/* Top-Left Rank */}
        <div className="flex flex-col items-start leading-none">
          <span className={`text-xs sm:text-sm font-extrabold ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
            {card.rank === 'JOKER' ? 'JK' : card.rank}
          </span>
          <span className="text-[10px] sm:text-xs">{suitSymbol}</span>
        </div>

        {/* Large Central Suit symbol */}
        <div className="text-center text-lg sm:text-2xl leading-none my-1 select-none">
          {suitSymbol}
        </div>

        {/* Bottom-Right Rank flipped */}
        <div className="flex flex-col items-end leading-none rotate-180">
          <span className={`text-xs sm:text-sm font-extrabold ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
            {card.rank === 'JOKER' ? 'JK' : card.rank}
          </span>
          <span className="text-[10px] sm:text-xs">{suitSymbol}</span>
        </div>
      </div>
    );
  };

  // Seating grid around the table
  const renderSeatingGrid = () => {
    // Exclude the local player from the ring layout
    const otherPlayers = room.players.filter(p => p.id !== player.id);
    
    return (
      <div className="w-full grid grid-cols-2 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-5 gap-3 mb-6">
        {room.players.map((p, idx) => {
          const isCurrent = room.currentPlayerIdx === idx && room.status === 'PLAYING';
          const isMe = p.id === player.id;
          
          return (
            <div 
              key={p.id}
              className={`p-3 rounded-2xl flex flex-col items-center text-center justify-center relative transition-all border ${
                isCurrent 
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/5 animate-pulse-glow' 
                  : p.disconnected 
                    ? 'bg-red-950/20 border-red-900/30 opacity-40' 
                    : p.hasDropped
                      ? 'bg-slate-900/40 border-white/5 opacity-50'
                      : isMe
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-black/20 border-white/5'
              }`}
            >
              {/* Profile emoji avatar */}
              <div className="relative">
                <span className="text-3xl p-1 bg-slate-800 rounded-full border border-white/10 block mb-1">{p.avatar}</span>
                {/* Active connection indicators */}
                {p.disconnected && (
                  <span className="absolute -top-1 -right-1 bg-red-600 border-2 border-slate-950 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold" title="Disconnected">
                    !
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute -bottom-1 -right-1 bg-amber-500 w-3 h-3 rounded-full border border-slate-950 animate-ping" />
                )}
              </div>

              {/* Player metadata */}
              <div className="text-xs max-w-full">
                <span className="font-semibold block truncate leading-tight text-gray-200">
                  {p.nickname}
                  {isMe && <span className="text-[9px] text-green-400 font-bold ml-0.5">(You)</span>}
                </span>
                
                {p.hasDropped ? (
                  <span className="text-[10px] text-red-400 font-bold mt-0.5 block uppercase tracking-wide">
                    {p.dropType === 'FIRST' ? 'First Drop' : p.dropType === 'MIDDLE' ? 'Mid Drop' : 'Folded'}
                  </span>
                ) : room.status === 'PLAYING' ? (
                  <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">
                    {p.hand?.length || 13} Cards
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-500 font-bold mt-0.5 block font-mono">
                    Score: {p.score}
                  </span>
                )}
              </div>

              {/* Turn Countdown Overlay */}
              {isCurrent && (
                <div className="absolute top-1 right-2 bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-bold font-mono text-[9px]">
                  {Math.max(0, room.settings.turnDuration - Math.floor((Date.now() - room.turnStartTime) / 1000))}s
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col justify-between items-center space-y-6">
      
      {/* 1. Seats Map */}
      {renderSeatingGrid()}

      {/* 2. Board Center Felt (Closed Deck, Open Deck, Wild Joker) */}
      <div className="w-full max-w-2xl bg-poker-felt border-4 border-poker-wood rounded-[3xl] p-6 shadow-felt-inner relative flex flex-col sm:flex-row items-center justify-around gap-6 select-none">
        
        {/* Closed Deck (Draw Pile) */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-green-300 font-semibold mb-2 uppercase tracking-wide">Draw Pile</span>
          
          <div 
            onClick={() => handleDraw('deck')}
            className={`w-20 h-28 bg-gradient-to-br from-red-800 to-red-950 border-2 border-amber-500 rounded-2xl shadow-card hover:shadow-card-hover flex items-center justify-center text-center cursor-pointer transition-all transform hover:-translate-y-1 active:scale-95 ${
              isMyTurn && !hasDrawn ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-green-800 animate-pulse' : ''
            }`}
          >
            {/* Pattern back of cards */}
            <div className="w-full h-full border border-red-700 rounded-xl m-1 flex flex-col items-center justify-center relative bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.4)_100%)]">
              <span className="text-xl">♣️</span>
              <span className="text-[10px] text-red-300 uppercase tracking-widest font-bold mt-1">RUMMY</span>
              <span className="absolute bottom-1 text-[9px] text-red-400 font-mono font-semibold">
                {room.deck?.length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Wild Joker Indicator (placed flat under closed deck in standard play, here we separate it for clarity) */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-yellow-300 font-semibold mb-2 uppercase tracking-wide">Wild Joker</span>
          {room.wildJoker ? (
            <div className="w-20 h-28 bg-white border-2 border-yellow-400 rounded-2xl shadow-card flex flex-col justify-between p-2 text-slate-900 relative">
              <span className="absolute top-0 right-0 bg-yellow-400 text-slate-950 font-bold px-1 rounded-bl-lg text-[8px] uppercase">Wild</span>
              <div className="leading-none text-xs font-extrabold flex flex-col">
                <span>{room.wildJoker.rank === 'JOKER' ? 'JK' : room.wildJoker.rank}</span>
                <span className="text-sm">{SUIT_SYMBOLS[room.wildJoker.suit]}</span>
              </div>
              <div className="text-center text-2xl my-1">{SUIT_SYMBOLS[room.wildJoker.suit]}</div>
              <div className="leading-none text-xs font-extrabold flex flex-col items-end rotate-180">
                <span>{room.wildJoker.rank === 'JOKER' ? 'JK' : room.wildJoker.rank}</span>
                <span className="text-sm">{SUIT_SYMBOLS[room.wildJoker.suit]}</span>
              </div>
            </div>
          ) : (
            <div className="w-20 h-28 bg-green-900/30 border border-green-800 border-dashed rounded-2xl flex items-center justify-center text-green-700">
              None
            </div>
          )}
        </div>

        {/* Discard Pile (Open Deck) */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-green-300 font-semibold mb-2 uppercase tracking-wide">Discard Pile</span>
          
          {room.discardPile && room.discardPile.length > 0 ? (
            <div 
              onClick={() => handleDraw('discard')}
              className={`w-20 h-28 bg-white text-slate-900 rounded-2xl shadow-card border-2 border-slate-200 flex flex-col justify-between p-2 cursor-pointer transition-all transform hover:-translate-y-1 active:scale-95 ${
                isMyTurn && !hasDrawn ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-green-800 animate-pulse' : ''
              }`}
            >
              {/* Show top card details */}
              {(() => {
                const topCard = room.discardPile[room.discardPile.length - 1];
                const isRed = ['H', 'D'].includes(topCard.suit);
                const isWild = isCardWildJoker(topCard);
                return (
                  <>
                    <div className="leading-none text-xs font-extrabold flex flex-col">
                      <span className={isRed ? 'text-red-600' : 'text-slate-950'}>
                        {topCard.rank === 'JOKER' ? 'JK' : topCard.rank}
                      </span>
                      <span className="text-sm">{SUIT_SYMBOLS[topCard.suit]}</span>
                    </div>
                    
                    <div className="text-center text-2xl my-1 relative">
                      {SUIT_SYMBOLS[topCard.suit]}
                      {isWild && <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-400 text-slate-900 font-bold px-0.5 rounded">W</span>}
                    </div>

                    <div className="leading-none text-xs font-extrabold flex flex-col items-end rotate-180">
                      <span className={isRed ? 'text-red-600' : 'text-slate-950'}>
                        {topCard.rank === 'JOKER' ? 'JK' : topCard.rank}
                      </span>
                      <span className="text-sm">{SUIT_SYMBOLS[topCard.suit]}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="w-20 h-28 bg-green-900/30 border border-green-800 border-dashed rounded-2xl flex items-center justify-center text-green-700">
              Empty
            </div>
          )}
        </div>
      </div>

      {/* 3. Player Hands Area (Bottom) */}
      <div className="w-full bg-slate-900/90 border border-white/5 p-6 rounded-3xl shadow-2xl backdrop-blur-md flex flex-col space-y-5">
        
        {/* Hand Actions Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <SlidersHorizontal size={18} />
            </span>
            <div>
              <h3 className="font-bold text-sm">Your Game Hand</h3>
              <p className="text-[10px] text-gray-400">Rearrange, group and match cards to declare</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSort('suit')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl border border-white/5 text-xs font-semibold flex items-center space-x-1.5 transition-all"
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Sort by Suit</span>
            </button>
            <button
              onClick={() => handleSort('rank')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl border border-white/5 text-xs font-semibold flex items-center space-x-1.5 transition-all"
            >
              <Sparkles size={13} className="text-yellow-400" />
              <span>Sort by Rank</span>
            </button>
            <button
              onClick={handleGroupSelected}
              disabled={selectedCardIds.size < 2}
              className="px-4 py-1.5 bg-amber-500 disabled:bg-slate-800 hover:bg-amber-600 disabled:text-gray-500 text-slate-950 rounded-xl font-bold text-xs transition-all"
            >
              Group Selected ({selectedCardIds.size})
            </button>
          </div>
        </div>

        {/* Card Groups */}
        <div className="flex flex-col space-y-4 max-h-[400px] overflow-y-auto pr-1">
          {player.groups?.map((group, groupIdx) => (
            <div 
              key={groupIdx} 
              className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4"
            >
              {/* Cards horizontal row */}
              <div className="flex items-center pl-4 py-2 flex-grow overflow-x-auto w-full md:w-auto">
                {group.map((card, cardIdx) => renderCard(card, groupIdx, cardIdx))}
              </div>

              {/* Group management tools */}
              <div className="flex items-center space-x-2 shrink-0">
                {/* Target Move controls */}
                {selectedCardIds.size > 0 && (
                  <button
                    onClick={() => handleMoveToGroup(groupIdx)}
                    className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold transition-all"
                  >
                    Add Here
                  </button>
                )}
                {player.groups.length > 1 && (
                  <button
                    onClick={() => handleDissolveGroup(groupIdx)}
                    className="p-2 bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-950/40 rounded-xl transition-all"
                    title="Dissolve Group"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {selectedCardIds.size > 0 && (
            <button
              onClick={() => handleMoveToGroup(player.groups.length)}
              className="py-3 border-2 border-dashed border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5 text-gray-400 hover:text-amber-300 rounded-2xl text-xs font-semibold tracking-wider transition-all"
            >
              + Create New Group with Selected Cards
            </button>
          )}
        </div>

        {/* Active game turn controls */}
        {isMyTurn && (
          <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-deal-card">
            <span className="text-xs text-amber-300 font-semibold flex items-center space-x-1.5">
              <Award size={15} />
              <span>It is your turn! Draw a card or discard a card.</span>
            </span>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                onClick={() => handleDiscard(false)}
                disabled={!hasDrawn || selectedCardIds.size !== 1}
                className="flex-grow sm:flex-grow-0 px-6 py-2.5 bg-slate-800 disabled:bg-slate-900 hover:bg-slate-700 disabled:text-gray-600 text-gray-200 border border-white/5 disabled:border-transparent font-bold rounded-xl text-xs transition-all"
              >
                Discard Card
              </button>
              
              <button
                onClick={() => handleDiscard(true)}
                disabled={!hasDrawn || selectedCardIds.size !== 1}
                className="flex-grow sm:flex-grow-0 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 disabled:from-slate-900 disabled:to-slate-900 disabled:text-gray-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-amber-500/5 hover:brightness-105"
                title="Finish & Declare"
              >
                Finish & Declare
              </button>

              {room.settings.allowDrop && (
                <button
                  onClick={handleDrop}
                  className="px-5 py-2.5 bg-red-950/30 hover:bg-red-950/50 border border-red-900/30 text-red-400 font-semibold rounded-xl text-xs transition-all"
                >
                  Drop
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Chat Slide Drawer / Toggle Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="p-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95"
        >
          <MessageSquare size={22} />
          {room.chatLogs?.length > 0 && (
            <span className="absolute top-0 right-0 bg-red-600 border border-slate-950 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
              {room.chatLogs.length}
            </span>
          )}
        </button>
      </div>

      {/* Chat pane */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-96 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden flex flex-col animate-deal-card">
          <div className="p-3 bg-black/40 border-b border-white/5 flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-gray-300">Room Chat & Logs</span>
            <button onClick={() => setChatOpen(false)} className="text-xs text-gray-500 hover:text-white">Close</button>
          </div>

          <div className="flex-grow overflow-y-auto p-3 space-y-2.5 text-xs">
            {/* Display combined chat logs and game events logs */}
            {(() => {
              const combined = [
                ...room.chatLogs.map(c => ({ ...c, type: 'chat' })),
                ...room.gameLogs.map(g => ({ ...g, type: 'log' }))
              ].sort((a, b) => a.timestamp - b.timestamp);

              return combined.map((item, idx) => {
                if (item.type === 'log') {
                  return (
                    <div key={`l-${item.id || idx}`} className="text-[10px] text-green-400/80 bg-green-500/5 border border-green-500/10 px-2 py-1 rounded-lg italic">
                      {item.text}
                    </div>
                  );
                }
                return (
                  <div key={`c-${item.id || idx}`} className="bg-black/30 border border-white/5 p-2 rounded-xl">
                    <span className="font-bold text-amber-400 block mb-0.5">{item.sender}</span>
                    <p className="text-gray-200">{item.text}</p>
                  </div>
                );
              });
            })()}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-2 bg-black/40 border-t border-white/5 flex items-center space-x-2">
            <input
              type="text"
              placeholder="Send message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-grow bg-black/40 border border-white/10 rounded-xl px-3 py-2 outline-none text-xs text-white focus:border-amber-500"
            />
            <button type="submit" className="p-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* 5. Declaring Overlay Screen */}
      {isDeclaringMode && room.declareState && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-xl bg-slate-900 border-2 border-amber-500/50 p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center max-h-[90vh] overflow-y-auto">
            <span className="text-5xl animate-bounce mb-3">🔔</span>
            <h2 className="text-2xl font-extrabold text-white">Declaration In Progress</h2>
            
            {room.declareState.declarantId === player.id ? (
              <p className="text-sm text-gray-400 mt-2 max-w-md">
                You finished the game! Waiting for other players to submit their card groupings for scoring evaluation.
              </p>
            ) : (
              <div className="w-full">
                <p className="text-sm text-amber-300 mt-2 font-medium">
                  {room.players.find(p => p.id === room.declareState.declarantId)?.nickname} declared their hand!
                </p>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  Arrange your final cards in valid sequences and sets in your hand now, and click **Submit Declaration** below!
                </p>
              </div>
            )}

            {/* Countdown timer */}
            <div className="my-6 bg-amber-500/10 border border-amber-500/20 px-6 py-2 rounded-2xl text-center">
              <span className="text-xs text-gray-400 block uppercase font-bold tracking-wider">Remaining Time</span>
              <span className="text-3xl font-black font-mono text-amber-400">{declareTimer}s</span>
            </div>

            {/* Show Submitted list */}
            <div className="w-full border-t border-white/5 pt-4 text-left">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Submissions Status:</h4>
              <div className="space-y-2">
                {room.players.map(p => {
                  if (p.id === room.declareState.declarantId) return null;
                  if (p.hasDropped) return null;
                  const submitted = !!room.declareState.answersSubmitted[p.id];
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-black/20">
                      <span className="font-semibold text-gray-200">{p.avatar} {p.nickname}</span>
                      {submitted ? (
                        <span className="text-green-400 font-bold">Submitted</span>
                      ) : (
                        <span className="text-gray-500 italic animate-pulse">Arranging hand...</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action for non-declarant players */}
            {room.declareState.declarantId !== player.id && !player.hasDropped && (
              <div className="w-full mt-6 flex flex-col items-center">
                {/* Visual points estimate box */}
                <div className="w-full bg-black/40 border border-white/5 p-3 rounded-xl text-center mb-4">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold mb-0.5">Live Point Penalty Estimate</span>
                  <span className="text-lg font-bold text-red-400">
                    Arrange cards in hand to minimize unarranged points!
                  </span>
                </div>

                <button
                  onClick={handleSubmitDeclaration}
                  disabled={!!room.declareState.answersSubmitted[player.id]}
                  className="w-full py-3.5 bg-green-600 disabled:bg-slate-800 disabled:text-gray-500 hover:bg-green-700 text-white font-bold rounded-2xl shadow-lg transition-all text-sm"
                >
                  {room.declareState.answersSubmitted[player.id] ? 'Hand Submitted' : 'Submit Hand Declaration'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// frontend/src/components/GameBoard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Play, LogOut, MessageSquare, Send, Sparkles, SlidersHorizontal, Trash2, ShieldAlert, Award, ArrowUpRight, HelpCircle, LayoutGrid, CheckSquare } from 'lucide-react';
import confetti from 'canvas-confetti';

const SUIT_SYMBOLS = { H: '♥️', D: '♦️', C: '♣️', S: '♠️', J: '🃏' };
const SUIT_NAMES = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades', J: 'Joker' };

export default function GameBoard({ socket, room, player, soundEnabled }) {
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [declareTimer, setDeclareTimer] = useState(30);
  const [spacedLayout, setSpacedLayout] = useState(true); // Default to Spaced (Free Space) Layout
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
      console.warn("Audio context error");
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

  // Auto-scroll chat
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
    if (card.suit === 'J' && card.rank === 'JOKER') return true; // Printed Joker always wild
    
    const isSecret = room.settings.jokerMode === 'secret';
    const isRevealed = room.status === 'DECLARING' || room.status === 'ROUND_END' || room.status === 'GAME_OVER';
    
    if (isSecret && !isRevealed) {
      return false; // Hidden during active play
    }

    if (room.wildJoker) {
      if (room.wildJoker.suit === 'J' && room.wildJoker.rank === 'JOKER') {
        return card.rank === 'A';
      }
      return card.rank === room.wildJoker.rank;
    }
    return false;
  };

  // Drag and Drop triggers
  const handleDragStart = (e, cardId) => {
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDropOnDiscard = (e, isFinish = false) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;
    if (!isMyTurn) return;
    if (!hasDrawn) return alert('Draw a card first before discarding!');

    socket.emit('discardCard', { roomCode: room.code, cardId, isFinish });
    setSelectedCardIds(new Set());
    playSound('discard');
  };

  // Drag-and-drop onto a card group (Free Space group management)
  const handleDropOnGroup = (e, targetGroupIdx) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    let draggedCard = null;
    const updatedGroups = player.groups.map(group => {
      const found = group.find(c => c.id === cardId);
      if (found) draggedCard = found;
      return group.filter(c => c.id !== cardId);
    }).filter(group => group.length > 0);

    if (!draggedCard) return;

    if (targetGroupIdx >= updatedGroups.length) {
      updatedGroups.push([draggedCard]);
    } else {
      updatedGroups[targetGroupIdx] = [...updatedGroups[targetGroupIdx], draggedCard];
    }

    socket.emit('groupCards', { roomCode: room.code, groups: updatedGroups });
    setSelectedCardIds(new Set());
    playSound('group');
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

  // Sorting hand
  const handleSort = (type) => {
    const allCards = player.groups.flat();
    if (allCards.length === 0) return;

    let sortedGroups = [];

    if (type === 'suit') {
      const suitsMap = { H: [], D: [], C: [], S: [], J: [] };
      allCards.forEach(c => {
        const targetSuit = isCardWildJoker(c) ? 'J' : c.suit;
        suitsMap[targetSuit].push(c);
      });

      const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'JOKER'];
      Object.keys(suitsMap).forEach(s => {
        suitsMap[s].sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank));
        if (suitsMap[s].length > 0) {
          sortedGroups.push(suitsMap[s]);
        }
      });
    } else if (type === 'rank') {
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

  // Group selected cards together
  const handleGroupSelected = () => {
    if (selectedCardIds.size < 2) return alert('Select at least 2 cards to form a group.');

    const newGroup = [];
    const remainingCardsGroups = [];

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

    if (updatedGroups[targetGroupIdx]) {
      updatedGroups[targetGroupIdx] = [...updatedGroups[targetGroupIdx], ...selectedCards];
    } else {
      updatedGroups.push(selectedCards);
    }

    socket.emit('groupCards', { roomCode: room.code, groups: updatedGroups });
    setSelectedCardIds(new Set());
    playSound('group');
  };

  // Dissolve card group
  const handleDissolveGroup = (groupIndex) => {
    if (player.groups.length <= 1) return;
    const targetGroup = player.groups[groupIndex];
    const newGroups = player.groups.filter((_, idx) => idx !== groupIndex);
    newGroups[0] = [...newGroups[0], ...targetGroup];

    socket.emit('groupCards', { roomCode: room.code, groups: newGroups });
    setSelectedCardIds(new Set());
    playSound('group');
  };

  // Draw card
  const handleDraw = (source) => {
    if (!isMyTurn) return;
    if (hasDrawn) return alert('You already drew a card!');
    socket.emit('drawCard', { roomCode: room.code, source });
    playSound('draw');
  };

  // Discard card
  const handleDiscard = (isFinish = false) => {
    if (!isMyTurn) return;
    if (!hasDrawn) return alert('Draw a card first!');
    if (selectedCardIds.size !== 1) return alert('Select exactly 1 card to discard.');

    const cardId = Array.from(selectedCardIds)[0];
    socket.emit('discardCard', { roomCode: room.code, cardId, isFinish });
    setSelectedCardIds(new Set());
    playSound('discard');
  };

  // Drop round
  const handleDrop = () => {
    const confirmDrop = window.confirm('Drop from this round? (First Drop: 20 pts, Mid Drop: 40 pts)');
    if (confirmDrop) {
      socket.emit('dropRound', { roomCode: room.code });
    }
  };

  // Declare submit
  const handleSubmitDeclaration = () => {
    socket.emit('submitDeclaration', { roomCode: room.code, groups: player.groups });
  };

  // Chat submit
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('sendChatMessage', { roomCode: room.code, text: chatInput.trim() });
    setChatInput('');
  };

  // Render Single Playing Card
  const renderCard = (card, groupIdx, cardIdx, options = {}) => {
    const isSelected = selectedCardIds.has(card.id);
    const isWild = isCardWildJoker(card);
    const isRed = ['H', 'D'].includes(card.suit);
    const suitSymbol = SUIT_SYMBOLS[card.suit] || '🃏';

    return (
      <div
        key={card.id}
        draggable={!options.disabled}
        onDragStart={(e) => handleDragStart(e, card.id)}
        onClick={() => !options.disabled && toggleSelectCard(card.id)}
        style={{
          marginLeft: (spacedLayout || cardIdx === 0) ? '0px' : '-2.25rem',
          zIndex: 10 + cardIdx,
        }}
        className={`w-14 h-20 sm:w-16 sm:h-24 bg-white rounded-xl shadow-card select-none flex flex-col justify-between p-1.5 sm:p-2 border-2 cursor-pointer transition-all relative transform hover:-translate-y-2 active:scale-95 ${
          isSelected 
            ? 'border-amber-400 bg-amber-50 shadow-card-hover -translate-y-4 ring-2 ring-amber-400/50' 
            : 'border-slate-200'
        } ${isWild ? 'ring-2 ring-yellow-400 animate-pulse-glow' : ''}`}
      >
        {isWild && (
          <div className="absolute top-0 right-0 bg-yellow-400 text-slate-900 font-extrabold px-1 rounded-bl-lg rounded-tr-lg text-[8px] uppercase tracking-wider scale-90">
            Joker
          </div>
        )}

        <div className="flex flex-col items-start leading-none">
          <span className={`text-xs sm:text-sm font-black ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
            {card.rank === 'JOKER' ? 'JK' : card.rank}
          </span>
          <span className={`text-[10px] sm:text-xs ${isRed ? 'text-red-500' : 'text-slate-700'}`}>{suitSymbol}</span>
        </div>

        <div className={`text-center text-lg sm:text-2xl leading-none my-1 filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
          {suitSymbol}
        </div>

        <div className="flex flex-col items-end leading-none rotate-180">
          <span className={`text-xs sm:text-sm font-black ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
            {card.rank === 'JOKER' ? 'JK' : card.rank}
          </span>
          <span className={`text-[10px] sm:text-xs ${isRed ? 'text-red-500' : 'text-slate-700'}`}>{suitSymbol}</span>
        </div>
      </div>
    );
  };

  // Seating grid around the table (Table seating format)
  const renderSeatingGrid = () => {
    return (
      <div className="w-full flex-shrink-0 bg-slate-950/70 border border-white/10 rounded-[2rem] p-3 max-h-24 overflow-y-auto backdrop-blur-md shadow-lg">
        <div className="flex flex-wrap gap-2.5 items-center justify-center">
          {room.players.map((p, idx) => {
            const isCurrent = room.currentPlayerIdx === idx && room.status === 'PLAYING';
            const isMe = p.id === player.id;
            
            return (
              <div 
                key={p.id}
                className={`px-3.5 py-2 rounded-2xl flex items-center space-x-2 transition-all border text-xs shrink-0 shadow-md ${
                  isCurrent 
                    ? 'bg-amber-500/10 border-amber-500/60 shadow-lg animate-pulse-glow ring-1 ring-amber-400/30' 
                    : p.disconnected 
                      ? 'bg-red-950/20 border-red-900/30 opacity-40' 
                      : p.hasDropped
                        ? 'bg-slate-900/40 border-white/5 opacity-50'
                        : isMe
                          ? 'bg-green-500/5 border-green-500/25'
                          : 'bg-black/40 border-white/10'
                }`}
              >
                <span className="text-xl p-1 bg-slate-900 rounded-lg border border-white/5">{p.avatar}</span>
                <div className="flex flex-col">
                  <span className="font-extrabold text-[11px] max-w-[85px] truncate text-white flex items-center">
                    {p.nickname}
                    {isMe && <span className="text-[8px] text-green-400 font-bold ml-1 uppercase">You</span>}
                  </span>
                  
                  {p.hasDropped ? (
                    <span className="text-[8px] text-red-400 font-black uppercase tracking-wider">Dropped</span>
                  ) : room.status === 'PLAYING' ? (
                    <span className="text-[8px] text-gray-400 font-bold font-mono tracking-wider">{p.hand?.length || 13} Cards</span>
                  ) : (
                    <span className="text-[8px] text-amber-500 font-black">Pts: {p.score}</span>
                  )}
                </div>

                {isCurrent && (
                  <div className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-lg font-black font-mono text-[10px] ml-1.5 shadow-sm">
                    {Math.max(0, room.settings.turnDuration - Math.floor((Date.now() - room.turnStartTime) / 1000))}s
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const isSecretJoker = room.settings.jokerMode === 'secret';
  const showSecretJoker = isSecretJoker && !(room.status === 'DECLARING' || room.status === 'ROUND_END' || room.status === 'GAME_OVER');

  return (
    <div className="w-full h-[calc(100vh-6.5rem)] flex flex-col justify-between overflow-hidden relative select-none font-sans">
      
      {/* 1. Seats Table Header */}
      {renderSeatingGrid()}

      {/* 2. Board Center Felt (Closed Deck, Open Deck, Wild Joker, and Drag drop handlers) */}
      <div className="w-full flex-grow overflow-hidden flex items-center justify-center p-2 relative">
        <div className="w-full max-w-2xl bg-poker-felt border-[6px] border-amber-950/80 rounded-[3rem] py-5 px-8 shadow-2xl flex flex-row items-center justify-around gap-4 select-none relative h-full max-h-56 sm:max-h-68">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,rgba(0,0,0,0.35)_100%)] pointer-events-none rounded-[2.5rem]" />
          
          {/* Closed Deck (Draw Pile) */}
          <div className="flex flex-col items-center z-10">
            <span className="text-[9px] text-green-300 font-black uppercase tracking-wider mb-1.5">Draw Pile</span>
            <div 
              onClick={() => handleDraw('deck')}
              className={`w-16 h-24 bg-gradient-to-br from-red-700 via-red-800 to-red-950 border-2 border-amber-500 rounded-2xl shadow-card hover:shadow-card-hover flex items-center justify-center text-center cursor-pointer transition-all transform hover:-translate-y-1.5 active:scale-95 ${
                isMyTurn && !hasDrawn ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-green-800 animate-pulse' : ''
              }`}
            >
              <div className="w-full h-full border border-red-600 rounded-xl m-1 flex flex-col items-center justify-center relative bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0.45)_100%)]">
                <span className="text-xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">♣️</span>
                <span className="text-[8px] text-red-200 uppercase tracking-widest font-black mt-1">Rummy</span>
                <span className="absolute bottom-1 bg-black/40 text-amber-400 border border-white/5 px-2 py-0.5 rounded-full text-[9px] font-mono font-black shadow-inner">
                  {room.deck?.length || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Wild Joker Indicator */}
          <div className="flex flex-col items-center z-10">
            <span className="text-[9px] text-yellow-300 font-black uppercase tracking-wider mb-1.5">Wild Joker</span>
            {room.wildJoker ? (
              showSecretJoker ? (
                // Secret Joker Card Back
                <div className="w-16 h-24 bg-gradient-to-br from-blue-700 to-blue-900 border-2 border-blue-400 rounded-2xl shadow-card flex flex-col items-center justify-center text-blue-200 relative">
                  <span className="text-2xl animate-pulse">❓</span>
                  <span className="text-[8px] text-blue-200 font-black uppercase tracking-widest mt-1">Secret</span>
                </div>
              ) : (
                // Open Wild Joker
                <div className="w-16 h-24 bg-white border-2 border-yellow-400 rounded-2xl shadow-card flex flex-col justify-between p-1.5 text-slate-900 relative">
                  <div className="absolute top-0 right-0 bg-yellow-400 text-slate-950 font-black px-1 rounded-bl-md text-[7px] uppercase scale-90">Wild</div>
                  <div className="leading-none text-[10px] font-black flex flex-col">
                    <span>{room.wildJoker.rank === 'JOKER' ? 'JK' : room.wildJoker.rank}</span>
                    <span className="text-xs">{SUIT_SYMBOLS[room.wildJoker.suit]}</span>
                  </div>
                  <div className="text-center text-xl my-1">{SUIT_SYMBOLS[room.wildJoker.suit]}</div>
                  <div className="leading-none text-[10px] font-black flex flex-col items-end rotate-180">
                    <span>{room.wildJoker.rank === 'JOKER' ? 'JK' : room.wildJoker.rank}</span>
                    <span className="text-xs">{SUIT_SYMBOLS[room.wildJoker.suit]}</span>
                  </div>
                </div>
              )
            ) : (
              <div className="w-16 h-24 bg-green-950/40 border border-green-800 border-dashed rounded-2xl flex items-center justify-center text-green-700 text-xs font-bold shadow-inner">
                None
              </div>
            )}
          </div>

          {/* Discard Pile (Open Deck & Drag Drop target for discard) */}
          <div 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropOnDiscard(e, false)}
            className="flex flex-col items-center z-10"
          >
            <span className="text-[9px] text-green-300 font-black uppercase tracking-wider mb-1.5">Discard Pile</span>
            
            {room.discardPile && room.discardPile.length > 0 ? (
              <div 
                onClick={() => handleDraw('discard')}
                className={`w-16 h-24 bg-white text-slate-900 rounded-2xl shadow-card border-2 border-slate-200 flex flex-col justify-between p-1.5 cursor-pointer transition-all transform hover:-translate-y-1.5 active:scale-95 ${
                  isMyTurn && !hasDrawn ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-green-800 animate-pulse' : ''
                }`}
              >
                {(() => {
                  const topCard = room.discardPile[room.discardPile.length - 1];
                  const isRed = ['H', 'D'].includes(topCard.suit);
                  const isWild = isCardWildJoker(topCard);
                  return (
                    <>
                      <div className="leading-none text-[10px] font-black flex flex-col">
                        <span className={isRed ? 'text-red-600' : 'text-slate-950'}>
                          {topCard.rank === 'JOKER' ? 'JK' : topCard.rank}
                        </span>
                        <span className="text-xs">{SUIT_SYMBOLS[topCard.suit]}</span>
                      </div>
                      
                      <div className="text-center text-xl my-1 relative">
                        {SUIT_SYMBOLS[topCard.suit]}
                        {isWild && <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-yellow-400 text-slate-900 font-black px-1 rounded shadow-sm">W</span>}
                      </div>

                      <div className="leading-none text-[10px] font-black flex flex-col items-end rotate-180">
                        <span className={isRed ? 'text-red-600' : 'text-slate-950'}>
                          {topCard.rank === 'JOKER' ? 'JK' : topCard.rank}
                        </span>
                        <span className="text-xs">{SUIT_SYMBOLS[topCard.suit]}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="w-16 h-24 bg-green-950/40 border border-green-800 border-dashed rounded-2xl flex items-center justify-center text-green-700 text-xs font-bold shadow-inner">
                Empty
              </div>
            )}
          </div>

          {/* Finish & Declare Area (Drag drop target to declare) */}
          <div 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropOnDiscard(e, true)}
            className="flex flex-col items-center z-10"
          >
            <span className="text-[9px] text-yellow-300 font-black uppercase tracking-wider mb-1.5">Finish Slot</span>
            <div className={`w-16 h-24 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-1.5 transition-all cursor-default ${
              isMyTurn && hasDrawn 
                ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300 animate-pulse-glow' 
                : 'border-amber-500/30 bg-amber-500/5 text-amber-400/60'
            }`}>
              <ArrowUpRight size={18} className="mb-1" />
              <span className="text-[8px] uppercase tracking-wider font-extrabold leading-tight">Drag Card to Finish</span>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Player Hand Area & Action Column (Bottom Fixed Height Row) */}
      <div className="w-full flex-shrink-0 bg-slate-950/95 border-t border-white/10 p-4 flex flex-col md:flex-row gap-4 h-68 md:h-56 overflow-hidden">
        
        {/* Left Hand: Overlapping Card Groups list (Scrollable horizontally/vertically) */}
        <div className="flex-grow overflow-y-auto bg-black/50 border border-white/5 rounded-2xl p-3 flex flex-col space-y-4.5 pr-2 shadow-inner">
          {player.groups?.map((group, groupIdx) => (
            <div 
              key={groupIdx} 
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnGroup(e, groupIdx)}
              className="bg-black/35 border border-white/5 rounded-2xl p-2 flex items-center justify-between gap-4 min-h-[5.5rem] sm:min-h-[6rem] transition-all hover:bg-black/45 hover:border-white/10"
            >
              {/* Cards layout - dynamic spacing (Free Space vs Stacked) */}
              <div className={`flex items-center pl-3 py-1.5 flex-grow overflow-x-auto w-full md:w-auto h-full scroll-smooth ${spacedLayout ? 'gap-2' : ''}`}>
                {group.map((card, cardIdx) => renderCard(card, groupIdx, cardIdx))}
              </div>

              {/* Add Here/Dissolve tools */}
              <div className="flex items-center space-x-1 shrink-0 px-2">
                {selectedCardIds.size > 0 && (
                  <button
                    onClick={() => handleMoveToGroup(groupIdx)}
                    className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                  >
                    Add
                  </button>
                )}
                {player.groups.length > 1 && (
                  <button
                    onClick={() => handleDissolveGroup(groupIdx)}
                    className="p-2 bg-red-950/30 border border-red-900/30 text-red-400 hover:bg-red-950/50 rounded-xl transition-all shadow active:scale-90"
                    title="Dissolve Group"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Draggable Zone/Button to create a new group with drag drop support */}
          <div 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropOnGroup(e, player.groups?.length || 0)}
            onClick={() => handleMoveToGroup(player.groups?.length || 0)}
            className="w-full py-3.5 border-2 border-dashed border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5 text-gray-500 hover:text-amber-400 rounded-2xl text-[10px] font-bold tracking-wider transition-all text-center cursor-pointer shadow-sm"
          >
            {selectedCardIds.size > 0 
              ? '✨ Click here or Drag cards to create a New Group' 
              : '📥 Drag any card here to start a New Group'}
          </div>
        </div>

        {/* Right Column: Hand Action Buttons Stack (Single Column as requested) */}
        <div className="w-full md:w-56 flex-shrink-0 bg-slate-900 border border-white/10 p-3.5 rounded-[2rem] flex flex-col justify-between space-y-2.5 shadow-xl">
          
          <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider pb-1.5 border-b border-white/5 flex items-center justify-between">
            <span>Control Deck</span>
            {isMyTurn && <span className="text-[9px] font-bold text-amber-400 animate-pulse-glow px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">Active Turn</span>}
          </div>

          {/* Action buttons stack */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSort('suit')}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl border border-white/5 text-[10px] font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm"
            >
              <Sparkles size={11} className="text-amber-400" />
              <span>Sort Suit</span>
            </button>
            <button
              onClick={() => handleSort('rank')}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl border border-white/5 text-[10px] font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm"
            >
              <Sparkles size={11} className="text-yellow-400" />
              <span>Sort Rank</span>
            </button>
          </div>

          {/* Layout spacing switcher (Free space cards) */}
          <div className="grid grid-cols-1">
            <button
              onClick={() => setSpacedLayout(!spacedLayout)}
              className={`py-1.5 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-sm ${
                spacedLayout 
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 hover:shadow-glow-yellow' 
                  : 'bg-slate-800 hover:bg-slate-700 text-gray-200 border-white/5'
              }`}
            >
              <LayoutGrid size={11} />
              <span>Layout: {spacedLayout ? 'Free Space' : 'Stacked'}</span>
            </button>
          </div>

          <button
            onClick={handleGroupSelected}
            disabled={selectedCardIds.size < 2}
            className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-400 disabled:from-slate-800 disabled:to-slate-800 hover:brightness-110 disabled:brightness-100 disabled:opacity-40 disabled:text-gray-500 text-slate-950 font-black rounded-xl text-[10px] transition-all uppercase tracking-wider shadow"
          >
            Group Selected ({selectedCardIds.size})
          </button>

          {isMyTurn ? (
            <div className="flex flex-col space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDiscard(false)}
                  disabled={!hasDrawn || selectedCardIds.size !== 1}
                  className="py-2 bg-slate-800 disabled:bg-slate-950 hover:bg-slate-750 disabled:text-gray-600 text-gray-200 border border-white/5 disabled:border-transparent font-extrabold rounded-xl text-[10px] uppercase tracking-wider transition-all shadow-sm"
                >
                  Discard
                </button>
                <button
                  onClick={() => handleDiscard(true)}
                  disabled={!hasDrawn || selectedCardIds.size !== 1}
                  className="py-2 bg-gradient-to-r from-amber-500 to-yellow-400 disabled:from-slate-950 disabled:to-slate-950 disabled:text-gray-600 disabled:opacity-40 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-wider transition-all shadow"
                >
                  Declare
                </button>
              </div>
              
              {room.settings.allowDrop && (
                <button
                  onClick={handleDrop}
                  className="w-full py-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 font-extrabold rounded-xl text-[9px] uppercase tracking-wider transition-all"
                >
                  Drop Hand
                </button>
              )}
            </div>
          ) : (
            <div className="py-3 px-2 rounded-xl bg-black/40 text-[9px] font-bold text-center text-gray-400 border border-white/5 shadow-inner">
              Wait for your turn to play
            </div>
          )}
        </div>

      </div>

      {/* 4. Chat Slide Drawer / Toggle Button */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="p-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 relative"
        >
          <MessageSquare size={20} />
          {room.chatLogs?.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-600 border-2 border-slate-950 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-md">
              {room.chatLogs.length}
            </span>
          )}
        </button>
      </div>

      {/* Chat pane */}
      {chatOpen && (
        <div className="fixed bottom-20 right-4 w-76 h-88 bg-slate-950/95 border border-white/10 rounded-[2rem] shadow-2xl z-40 overflow-hidden flex flex-col animate-deal-card backdrop-blur-xl">
          <div className="p-3.5 bg-black/40 border-b border-white/5 flex items-center justify-between">
            <span className="font-black text-[10px] uppercase tracking-widest text-gray-300 flex items-center gap-1.5">
              <MessageSquare size={12} className="text-amber-400" /> Room Logs & Chat
            </span>
            <button onClick={() => setChatOpen(false)} className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-white">Close</button>
          </div>

          <div className="flex-grow overflow-y-auto p-4 space-y-2.5 text-[10px]">
            {(() => {
              const combined = [
                ...room.chatLogs.map(c => ({ ...c, type: 'chat' })),
                ...room.gameLogs.map(g => ({ ...g, type: 'log' }))
              ].sort((a, b) => a.timestamp - b.timestamp);

              return combined.map((item, idx) => {
                if (item.type === 'log') {
                  return (
                    <div key={`l-${item.id || idx}`} className="text-[9px] text-green-400 bg-green-500/5 border border-green-500/10 px-2.5 py-1 rounded-xl italic font-medium shadow-sm">
                      {item.text}
                    </div>
                  );
                }
                return (
                  <div key={`c-${item.id || idx}`} className="bg-black/35 border border-white/5 p-2 rounded-xl shadow-sm">
                    <span className="font-extrabold text-amber-400 block mb-0.5">{item.sender}</span>
                    <p className="text-gray-200">{item.text}</p>
                  </div>
                );
              });
            })()}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-2 bg-black/40 border-t border-white/5 flex items-center space-x-1.5">
            <input
              type="text"
              placeholder="Type chat message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-grow bg-black/50 border border-white/10 rounded-xl px-3 py-2 outline-none text-[10px] text-white focus:border-amber-400 shadow-inner placeholder:text-gray-600"
            />
            <button type="submit" className="p-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow active:scale-90">
              <Send size={12} />
            </button>
          </form>
        </div>
      )}

      {/* 5. Declaring Overlay Screen */}
      {isDeclaringMode && room.declareState && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/50 p-6 rounded-[2.5rem] shadow-2xl flex flex-col items-center text-center max-h-[90vh] overflow-y-auto animate-deal-card">
            <span className="text-5xl animate-bounce mb-3 filter drop-shadow-[0_2px_8px_rgba(234,179,8,0.3)]">🔔</span>
            <h2 className="text-xl font-black text-white uppercase tracking-wider">Declaration Active</h2>
            
            {room.declareState.declarantId === player.id ? (
              <p className="text-xs text-gray-400 mt-2 max-w-xs font-semibold">
                Waiting for the other players at the table to arrange their final cards and submit for score evaluation.
              </p>
            ) : (
              <div className="w-full">
                <p className="text-xs text-amber-300 mt-2 font-extrabold uppercase tracking-wide">
                  {room.players.find(p => p.id === room.declareState.declarantId)?.nickname} declared their hand!
                </p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Arrange your final sequences and sets in your hand now, and submit your declaration before the clock runs out!
                </p>
              </div>
            )}

            {/* Countdown timer */}
            <div className="my-5 bg-amber-500/10 border border-amber-500/25 px-6 py-2 rounded-2xl text-center shadow-inner">
              <span className="text-[9px] text-gray-400 block uppercase font-black tracking-widest">Time Remaining</span>
              <span className="text-3xl font-black font-mono text-amber-400">{declareTimer}s</span>
            </div>

            {/* Show Submitted list */}
            <div className="w-full border-t border-white/5 pt-4 text-left">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2.5">Submissions Received:</h4>
              <div className="space-y-2">
                {room.players.map(p => {
                  if (p.id === room.declareState.declarantId) return null;
                  if (p.hasDropped) return null;
                  const submitted = !!room.declareState.answersSubmitted[p.id];
                  return (
                    <div key={p.id} className="flex items-center justify-between text-[10px] py-2 px-3.5 rounded-xl bg-black/30 border border-white/5">
                      <span className="font-extrabold text-gray-200">{p.avatar} {p.nickname}</span>
                      {submitted ? (
                        <span className="text-green-400 font-bold flex items-center gap-1">Submitted <CheckSquare size={10} /></span>
                      ) : (
                        <span className="text-gray-500 italic animate-pulse">Arranging...</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action for non-declarant players */}
            {room.declareState.declarantId !== player.id && !player.hasDropped && (
              <div className="w-full mt-5 flex flex-col items-center">
                <button
                  onClick={handleSubmitDeclaration}
                  disabled={!!room.declareState.answersSubmitted[player.id]}
                  className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-gray-500 hover:brightness-110 active:scale-95 text-white font-black rounded-2xl shadow-lg transition-all text-xs uppercase tracking-widest"
                >
                  {room.declareState.answersSubmitted[player.id] ? 'Declaration Completed' : 'Submit Hand Declaration'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

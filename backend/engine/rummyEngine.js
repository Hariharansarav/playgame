// backend/engine/rummyEngine.js

// Card Ranks and Suits
export const SUITS = ['H', 'D', 'C', 'S']; // Hearts, Diamonds, Clubs, Spades
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Point values for cards in Indian Rummy
export const CARD_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 10, 'Q': 10, 'K': 10, 'A': 10, 'JOKER': 0
};

// Create a single standard deck of 54 cards (52 cards + 2 jokers)
export function createSingleDeck(deckIndex = 0) {
  const deck = [];
  
  // Standard 52 cards
  SUITS.forEach(suit => {
    RANKS.forEach(rank => {
      deck.push({
        id: `${suit}_${rank}_d${deckIndex}`,
        suit,
        rank,
        value: CARD_VALUES[rank],
        isJoker: false
      });
    });
  });

  // 2 Printed Jokers
  for (let i = 1; i <= 2; i++) {
    deck.push({
      id: `J_JOKER_d${deckIndex}_p${i}`,
      suit: 'J',
      rank: 'JOKER',
      value: 0,
      isJoker: true
    });
  }

  return deck;
}

// Create a full shoe containing multiple decks based on player count
// Indian Rummy deck scaling guidelines:
// Up to 3 players: 2 decks (108 cards)
// 4 to 6 players: 3 decks (162 cards)
// 7 to 10 players: 4 decks (216 cards)
export function createMultiDeck(maxPlayers) {
  const deckCount = maxPlayers <= 3 ? 2 : maxPlayers <= 6 ? 3 : 4;
  let fullDeck = [];
  for (let i = 0; i < deckCount; i++) {
    fullDeck = fullDeck.concat(createSingleDeck(i));
  }
  return fullDeck;
}

// Fisher-Yates Shuffle
export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Convert rank string to numeric values for sequence checks
function getRankNumericValue(rank, aceHigh = false) {
  if (rank === 'A') return aceHigh ? 14 : 1;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return parseInt(rank, 10);
}

// Check if a card is acting as a joker (either printed joker or matching the wild joker rank)
export function isCardJoker(card, wildJokerCard) {
  if (!card) return false;
  if (card.suit === 'J' && card.rank === 'JOKER') return true;
  if (wildJokerCard) {
    // If the open wild joker is a printed Joker, then Aces are wild jokers
    if (wildJokerCard.suit === 'J' && wildJokerCard.rank === 'JOKER') {
      return card.rank === 'A';
    }
    return card.rank === wildJokerCard.rank;
  }
  return false;
}

// Check if a group of cards forms a Pure Sequence (no jokers acting as substitutes)
export function checkPureSequence(cards, wildJokerCard) {
  if (cards.length < 3) return false;

  // In a pure sequence, no printed jokers or wildcards are allowed *unless*
  // they are used naturally. Natural use means they must represent themselves
  // in their original suit and rank (so we treat them as normal cards).
  // First, verify if all cards are of the same suit.
  const baseSuit = cards[0].suit;
  if (baseSuit === 'J') return false; // Printed jokers cannot start/define a pure sequence suit

  const hasMismatchSuit = cards.some(c => c.suit !== baseSuit);
  if (hasMismatchSuit) return false;

  // Ensure no printed jokers are present (as they have suit 'J' and can't match baseSuit, but let's check explicitly)
  if (cards.some(c => c.rank === 'JOKER')) return false;

  // For wild jokers: in a pure sequence, they can only be used as their natural self.
  // This means they cannot substitute for another card.
  // To check if they form a consecutive sequence of natural cards, we sort and verify.
  
  // Sort cards by rank. Try Ace as low (1) and Ace as high (14).
  const checkConsecutive = (aceHigh) => {
    const sortedVals = cards
      .map(c => getRankNumericValue(c.rank, aceHigh))
      .sort((a, b) => a - b);
    
    // Check if consecutive
    for (let i = 0; i < sortedVals.length - 1; i++) {
      if (sortedVals[i + 1] !== sortedVals[i] + 1) {
        return false;
      }
    }
    return true;
  };

  return checkConsecutive(false) || checkConsecutive(true);
}

// Check if a group of cards forms an Impure Sequence (allows jokers/wildcards as substitutes)
export function checkImpureSequence(cards, wildJokerCard) {
  if (cards.length < 3) return false;

  // Separate into jokers and normal cards
  const jokers = [];
  const normalCards = [];

  cards.forEach(card => {
    if (isCardJoker(card, wildJokerCard)) {
      jokers.push(card);
    } else {
      normalCards.push(card);
    }
  });

  // If it's all jokers, it's valid sequence (since jokers can represent any sequence)
  if (normalCards.length === 0) return true;

  // All normal cards must be of the same suit
  const baseSuit = normalCards[0].suit;
  if (normalCards.some(c => c.suit !== baseSuit)) return false;

  // Check if we can form a sequence.
  // Sort normal cards' values. Test Ace as Low (1) and Ace as High (14).
  const checkWithGaps = (aceHigh) => {
    const values = normalCards
      .map(c => getRankNumericValue(c.rank, aceHigh))
      .sort((a, b) => a - b);

    // No duplicate ranks allowed in a sequence
    for (let i = 0; i < values.length - 1; i++) {
      if (values[i] === values[i + 1]) return false;
    }

    // Calculate total gaps
    let gaps = 0;
    for (let i = 0; i < values.length - 1; i++) {
      gaps += (values[i + 1] - values[i]) - 1;
    }

    // Gaps must be fillable by the available jokers
    return gaps <= jokers.length;
  };

  return checkWithGaps(false) || checkWithGaps(true);
}

// Check if a group forms a Set (3 or 4 cards of same rank, different suits)
export function checkSet(cards, wildJokerCard) {
  if (cards.length < 3) return false;

  // Separate into jokers and normal cards
  const jokers = [];
  const normalCards = [];

  cards.forEach(card => {
    if (isCardJoker(card, wildJokerCard)) {
      jokers.push(card);
    } else {
      normalCards.push(card);
    }
  });

  // If it's all jokers, it's a valid set
  if (normalCards.length === 0) return true;

  // All normal cards must have the same rank
  const baseRank = normalCards[0].rank;
  if (normalCards.some(c => c.rank !== baseRank)) return false;

  // In a valid set, all normal cards must have different suits.
  // Count unique suits of normal cards.
  const suits = normalCards.map(c => c.suit);
  const uniqueSuits = new Set(suits);
  if (uniqueSuits.size !== suits.length) {
    return false; // Duplicate suits in a set are not allowed (e.g. 7h, 7h, 7d)
  }

  // Total cards must be at least 3. Since size limit for sets is normally 4 (or up to suits count),
  // but with jokers it can be more, we just ensure card count is at least 3.
  return cards.length >= 3;
}

// Validate a full declaration (all 13 cards grouped)
// Returns { isValid: boolean, reason: string, score: number }
export function validateDeclaration(groups, wildJokerCard) {
  // 1. Total card count check. In Indian Rummy, the hand has exactly 13 cards.
  const totalCards = groups.reduce((sum, g) => sum + g.length, 0);
  if (totalCards !== 13) {
    return {
      isValid: false,
      reason: `You must have exactly 13 cards in your hand to declare (currently: ${totalCards} cards).`,
      score: 80
    };
  }

  // 2. Ensure each group has at least 3 cards (all cards must be arranged in groups)
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].length < 3) {
      return {
        isValid: false,
        reason: `Each card group must contain at least 3 cards (Group ${i + 1} has ${groups[i].length}).`,
        score: 80
      };
    }
  }

  // 3. Find sequences
  let pureSequencesCount = 0;
  let impureSequencesCount = 0;
  const invalidGroupsIndex = [];

  groups.forEach((group, index) => {
    if (checkPureSequence(group, wildJokerCard)) {
      pureSequencesCount++;
    } else if (checkImpureSequence(group, wildJokerCard)) {
      impureSequencesCount++;
    } else if (checkSet(group, wildJokerCard)) {
      // It's a valid set, which is fine
    } else {
      invalidGroupsIndex.push(index + 1);
    }
  });

  // 4. Indian Rummy requires:
  // - At least one Pure Sequence (First Life)
  // - At least one additional sequence (Pure or Impure) (Second Life)
  const hasPure = pureSequencesCount >= 1;
  const hasSecondSeq = (pureSequencesCount + impureSequencesCount) >= 2;

  if (!hasPure) {
    return {
      isValid: false,
      reason: "Invalid Declaration: You must have at least one PURE sequence (no jokers).",
      score: calculateHandScore(groups, wildJokerCard, false, false)
    };
  }

  if (!hasSecondSeq) {
    return {
      isValid: false,
      reason: "Invalid Declaration: You must have at least two sequences (one pure, one pure/impure).",
      score: calculateHandScore(groups, wildJokerCard, true, false)
    };
  }

  if (invalidGroupsIndex.length > 0) {
    return {
      isValid: false,
      reason: `Invalid Declaration: Group(s) ${invalidGroupsIndex.join(', ')} are not valid sequences or sets.`,
      score: calculateHandScore(groups, wildJokerCard, true, true) // They have pure and second sequence, but other groups are invalid
    };
  }

  // Valid declaration!
  return {
    isValid: true,
    reason: "Valid Declaration! You win this round.",
    score: 0
  };
}

// Calculate the points of a player's hand.
// If the player has no pure sequence: all non-joker cards count.
// If the player has a pure sequence but no second sequence: cards in the pure sequence are saved (0 points), others count.
// If they have both sequences: all valid sequences/sets are saved (0 points), only invalid groups/unarranged cards count.
export function calculateHandScore(groups, wildJokerCard, hasPure = false, hasSecondSeq = false) {
  // First, verify pure sequence and second sequence if not passed
  if (!hasPure || !hasSecondSeq) {
    let pSeq = 0;
    let iSeq = 0;
    groups.forEach(group => {
      if (checkPureSequence(group, wildJokerCard)) {
        pSeq++;
      } else if (checkImpureSequence(group, wildJokerCard)) {
        iSeq++;
      }
    });
    hasPure = pSeq >= 1;
    hasSecondSeq = (pSeq + iSeq) >= 2;
  }

  let totalScore = 0;

  // Case 1: No pure sequence at all.
  // Every card in the hand (except Jokers) counts for points.
  if (!hasPure) {
    groups.forEach(group => {
      group.forEach(card => {
        if (!isCardJoker(card, wildJokerCard)) {
          totalScore += card.value;
        }
      });
    });
    return Math.min(totalScore, 80); // Cap points at 80
  }

  // Case 2: Has pure sequence, but no second sequence.
  // The largest pure sequence is saved (points = 0). All other groups (including other pure sequences or partial sequences) count.
  if (!hasSecondSeq) {
    // Find the groups that are pure sequences
    let pureGroupIndexes = [];
    groups.forEach((group, idx) => {
      if (checkPureSequence(group, wildJokerCard)) {
        pureGroupIndexes.push(idx);
      }
    });

    // We save the one with the maximum total card points (or just save the first one, but saving the largest is fairest)
    let bestSavedIndex = -1;
    let maxSavedValue = -1;
    pureGroupIndexes.forEach(idx => {
      const val = groups[idx].reduce((sum, c) => sum + (isCardJoker(c, wildJokerCard) ? 0 : c.value), 0);
      if (val > maxSavedValue) {
        maxSavedValue = val;
        bestSavedIndex = idx;
      }
    });

    groups.forEach((group, idx) => {
      if (idx === bestSavedIndex) {
        // This group is saved (0 points)
        return;
      }
      group.forEach(card => {
        if (!isCardJoker(card, wildJokerCard)) {
          totalScore += card.value;
        }
      });
    });
    return Math.min(totalScore, 80);
  }

  // Case 3: Has both sequences (Pure + Second).
  // Any group that is a valid sequence (pure or impure) or set is saved (0 points).
  // Only invalid groups count for points.
  groups.forEach(group => {
    const isValid = checkPureSequence(group, wildJokerCard) || 
                    checkImpureSequence(group, wildJokerCard) || 
                    checkSet(group, wildJokerCard);
    if (!isValid) {
      group.forEach(card => {
        if (!isCardJoker(card, wildJokerCard)) {
          totalScore += card.value;
        }
      });
    }
  });

  return Math.min(totalScore, 80);
}

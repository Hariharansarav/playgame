// backend/tests/testEngine.js
import { 
  checkPureSequence, 
  checkImpureSequence, 
  checkSet, 
  validateDeclaration,
  calculateHandScore
} from '../engine/rummyEngine.js';

console.log("=== Running Indian Rummy Engine Validation Tests ===");

// Helper to create simple card objects
// suit: H, D, C, S, J. rank: 2..10, J, Q, K, A, JOKER. value: 2-10, 10 for J/Q/K/A, 0 for JOKER.
const card = (suit, rank) => {
  const isJoker = suit === 'J' && rank === 'JOKER';
  let value = 0;
  if (!isJoker) {
    if (['J', 'Q', 'K', 'A'].includes(rank)) value = 10;
    else value = parseInt(rank, 10);
  }
  return { id: `${suit}_${rank}_test`, suit, rank, value, isJoker };
};

// Test 1: Pure Sequence Validation
console.log("\n--- Testing Pure Sequence ---");
const wildJoker = card('S', '8'); // 8 of Spades is wild joker

const pureSeq1 = [card('H', 'A'), card('H', '2'), card('H', '3')]; // Ah, 2h, 3h
console.log("Ah, 2h, 3h (Pure Seq):", checkPureSequence(pureSeq1, wildJoker) === true ? "PASS" : "FAIL");

const pureSeq2 = [card('H', '9'), card('H', '10'), card('H', 'J'), card('H', 'Q')]; // 9h, 10h, Jh, Qh
console.log("9h, 10h, Jh, Qh (Pure Seq):", checkPureSequence(pureSeq2, wildJoker) === true ? "PASS" : "FAIL");

const pureSeq3 = [card('H', 'A'), card('H', 'Q'), card('H', 'K')]; // Ah, Qh, Kh (missing J)
console.log("Ah, Qh, Kh (Not Pure Seq):", checkPureSequence(pureSeq3, wildJoker) === false ? "PASS" : "FAIL");

const impureSeq1 = [card('H', '7'), card('J', 'JOKER'), card('H', '9')]; // 7h, Printed Joker, 9h
console.log("7h, Printed Joker, 9h (Not Pure Seq):", checkPureSequence(impureSeq1, wildJoker) === false ? "PASS" : "FAIL");

// Test natural wild card usage
const pureSeqWithNaturalWild = [card('H', '7'), card('H', '8'), card('H', '9')]; // 7h, 8h (wild rank), 9h
console.log("7h, 8h(Wild), 9h used naturally (Pure Seq):", checkPureSequence(pureSeqWithNaturalWild, wildJoker) === true ? "PASS" : "FAIL");


// Test 2: Impure Sequence Validation
console.log("\n--- Testing Impure Sequence ---");
console.log("7h, Printed Joker, 9h (Impure Seq):", checkImpureSequence(impureSeq1, wildJoker) === true ? "PASS" : "FAIL");

const impureSeq2 = [card('H', '6'), card('C', '8'), card('H', '8')]; // 6h, 8c (wild), 8h
console.log("6h, 8c(Wild), 8h (Impure Seq):", checkImpureSequence(impureSeq2, wildJoker) === true ? "PASS" : "FAIL");

const impureSeq3 = [card('H', '2'), card('J', 'JOKER'), card('C', '8'), card('H', '5')]; // 2h, Joker, 8c(Wild), 5h (representing 3h, 4h)
console.log("2h, Joker, 8c(Wild), 5h (Impure Seq):", checkImpureSequence(impureSeq3, wildJoker) === true ? "PASS" : "FAIL");

const invalidImpureSeq = [card('H', '2'), card('C', '8'), card('S', '3')]; // different suits non-wild
console.log("2h, 8c(Wild), 3s (Not Impure Seq):", checkImpureSequence(invalidImpureSeq, wildJoker) === false ? "PASS" : "FAIL");


// Test 3: Set Validation
console.log("\n--- Testing Sets ---");
const set1 = [card('H', 'Q'), card('D', 'Q'), card('S', 'Q')]; // Qh, Qd, Qs
console.log("Qh, Qd, Qs (Set):", checkSet(set1, wildJoker) === true ? "PASS" : "FAIL");

const setWithJoker = [card('H', 'Q'), card('J', 'JOKER'), card('S', 'Q')]; // Qh, Joker, Qs
console.log("Qh, Joker, Qs (Set):", checkSet(setWithJoker, wildJoker) === true ? "PASS" : "FAIL");

const setWithDuplicateSuit = [card('H', 'Q'), card('H', 'Q'), card('S', 'Q')]; // Qh, Qh, Qs (Invalid: duplicate suit Hearts)
console.log("Qh, Qh, Qs (Not Set):", checkSet(setWithDuplicateSuit, wildJoker) === false ? "PASS" : "FAIL");


// Test 4: Declaration Validation & Scoring
console.log("\n--- Testing Full Hand Declaration ---");
// Hand with valid pure seq, valid impure seq, and valid sets/seqs
const validHand = [
  [card('H', '2'), card('H', '3'), card('H', '4')], // Pure Seq (3 cards)
  [card('D', '5'), card('D', '6'), card('D', '7'), card('C', '8')], // Impure Seq using 8c as Wild (4 cards)
  [card('S', '9'), card('C', '9'), card('D', '9')], // Set (3 cards)
  [card('C', 'A'), card('C', '2'), card('C', '3')] // Seq (3 cards)
];
const valResult = validateDeclaration(validHand, wildJoker);
console.log("Valid Hand Declare (isValid = true):", valResult.isValid === true ? "PASS" : "FAIL", "-", valResult.reason);
console.log("Valid Hand Score (0 points):", valResult.score === 0 ? "PASS" : "FAIL");

// Hand without pure sequence (using 8c which is wild joker S8)
const noPureSeqHand = [
  [card('H', '2'), card('J', 'JOKER'), card('H', '4')], // Impure Seq (3 cards)
  [card('D', '5'), card('C', '8'), card('D', '7')], // Impure Seq (3 cards)
  [card('S', '9'), card('C', '9'), card('D', '9')], // Set (3 cards)
  [card('C', 'A'), card('C', '8'), card('C', '3'), card('C', '4')] // Impure Seq (4 cards)
];
const valResultNoPure = validateDeclaration(noPureSeqHand, wildJoker);
console.log("No Pure Sequence Declare (isValid = false):", valResultNoPure.isValid === false ? "PASS" : "FAIL", "-", valResultNoPure.reason);
// Since no pure sequence, score should be the sum of all non-joker cards in hand capped at 80
console.log("No Pure Seq Score (> 0 points):", valResultNoPure.score > 0 ? `PASS (${valResultNoPure.score} pts)` : "FAIL");


// Hand with pure seq, but no second sequence (other is set, set, set)
const onePureSeqOnlyHand = [
  [card('H', '2'), card('H', '3'), card('H', '4')], // Pure Seq (3 cards) -> Saved (0 pts)
  [card('S', '5'), card('D', '5'), card('C', '5')], // Set (3 cards) -> Counts (15 pts)
  [card('S', '9'), card('C', '9'), card('D', '9')], // Set (3 cards) -> Counts (27 pts)
  [card('C', 'A'), card('D', 'A'), card('S', 'A'), card('H', 'A')] // Set (4 cards) -> Counts (40 pts)
];
const valResultOnePure = validateDeclaration(onePureSeqOnlyHand, wildJoker);
console.log("One Pure Seq Only Declare (isValid = false):", valResultOnePure.isValid === false ? "PASS" : "FAIL", "-", valResultOnePure.reason);
console.log("One Pure Seq Only Score (15+27+40 = 82 capped at 80):", valResultOnePure.score === 80 ? "PASS" : `FAIL (${valResultOnePure.score} pts)`);

console.log("\n=== Testing Completed successfully ===");

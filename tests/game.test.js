import { describe, it, expect, beforeEach } from 'vitest';
import { Game, GameState } from '../js/game.js';
import { Players } from '../js/players.js';

function createSampleQuestions() {
  return {
    rounds: [
      {
        name: 'Jeopardy',
        categories: [
          {
            name: 'Cat 1',
            clues: [
              { value: 200, question: 'Q1', answer: 'A1', isDailyDouble: false },
              { value: 400, question: 'Q2', answer: 'A2', isDailyDouble: false },
              { value: 600, question: 'Q3', answer: 'A3', isDailyDouble: true }
            ]
          },
          {
            name: 'Cat 2',
            clues: [
              { value: 200, question: 'Q4', answer: 'A4', isDailyDouble: false },
              { value: 400, question: 'Q5', answer: 'A5', isDailyDouble: false },
              { value: 600, question: 'Q6', answer: 'A6', isDailyDouble: false }
            ]
          }
        ]
      },
      {
        name: 'Double Jeopardy',
        categories: [
          {
            name: 'Cat 3',
            clues: [
              { value: 400, question: 'Q7', answer: 'A7', isDailyDouble: false },
              { value: 800, question: 'Q8', answer: 'A8', isDailyDouble: false }
            ]
          }
        ]
      }
    ],
    finalJeopardy: {
      category: 'Final Cat',
      question: 'Final Q',
      answer: 'Final A'
    }
  };
}

describe('Game State Machine', () => {
  let game;
  let players;
  let p1, p2;

  beforeEach(() => {
    players = new Players();
    p1 = players.addPlayer('SpongeBob');
    p2 = players.addPlayer('Patrick');
    players.setActivePlayer(p1.id);
    game = new Game(createSampleQuestions(), players);
  });

  it('initializes in BOARD state on round 0', () => {
    expect(game.getState()).toBe(GameState.BOARD);
    expect(game.getCurrentRoundIndex()).toBe(0);
    expect(game.getCurrentRound().name).toBe('Jeopardy');
    expect(game.getRemainingClues()).toBe(6);
    expect(game.isRoundComplete()).toBe(false);
  });

  it('selects a normal clue and transitions to CLUE_SHOWN', () => {
    const clue = game.selectClue(0, 0); // Cat 1, Clue 200
    expect(clue.value).toBe(200);
    expect(clue.categoryName).toBe('Cat 1');
    expect(game.isClueUsed(0, 0)).toBe(true);
    expect(game.getState()).toBe(GameState.CLUE_SHOWN);
    expect(game.getRemainingClues()).toBe(5);
  });

  it('prevents selecting already used clues', () => {
    game.selectClue(0, 0);
    expect(() => game.selectClue(0, 0)).toThrow('Clue already used.');
  });

  it('handles showAnswer, correct answer scoring, and board control assignment', () => {
    game.selectClue(0, 0); // value 200
    game.showAnswer();
    expect(game.getState()).toBe(GameState.ANSWER_SHOWN);

    // Patrick answers correctly
    game.markCorrect(p2.id);
    expect(p2.score).toBe(200);
    expect(players.getActivePlayer().id).toBe(p2.id); // Patrick gained control
    expect(game.getState()).toBe(GameState.BOARD);
  });

  it('handles incorrect answer on normal clue: deducts score and allows others to try', () => {
    game.selectClue(0, 0); // value 200
    game.showAnswer();

    // SpongeBob answers wrong
    game.markIncorrect(p1.id);
    expect(p1.score).toBe(-200);
    // Still in ANSWER_SHOWN because Patrick has not attempted yet
    expect(game.getState()).toBe(GameState.ANSWER_SHOWN);

    // Patrick also answers wrong -> all players tried -> returns to BOARD
    game.markIncorrect(p2.id);
    expect(p2.score).toBe(-200);
    expect(game.getState()).toBe(GameState.BOARD);
  });

  it('handles noAnswer on normal clue: returns to BOARD without changing scores', () => {
    game.selectClue(0, 0); // 200
    game.showAnswer();
    game.noAnswer();

    expect(p1.score).toBe(0);
    expect(p2.score).toBe(0);
    expect(players.getActivePlayer().id).toBe(p1.id); // SpongeBob retained control
    expect(game.getState()).toBe(GameState.BOARD);
  });

  describe('Daily Double', () => {
    it('transitions to DAILY_DOUBLE when selecting a daily double clue', () => {
      game.selectClue(0, 2); // Daily Double in Cat 1
      expect(game.getState()).toBe(GameState.DAILY_DOUBLE);
    });

    it('validates daily double wager range (min $5, max(score, highest board value))', () => {
      game.selectClue(0, 2);
      // SpongeBob score is 0, highest value on board is 600
      const bounds = game.getDailyDoubleWagerBounds();
      expect(bounds.min).toBe(5);
      expect(bounds.max).toBe(600);

      expect(game.setDailyDoubleWager(4)).toBe(false);
      expect(game.setDailyDoubleWager(601)).toBe(false);
      expect(game.setDailyDoubleWager(500)).toBe(true);
      expect(game.getState()).toBe(GameState.CLUE_SHOWN);
    });

    it('deducts wager on Daily Double noAnswer', () => {
      game.selectClue(0, 2);
      game.setDailyDoubleWager(500);
      game.showAnswer();
      game.noAnswer();

      expect(p1.score).toBe(-500);
      expect(game.getState()).toBe(GameState.BOARD);
    });

    it('deducts wager on Daily Double incorrect and returns to board immediately', () => {
      game.selectClue(0, 2);
      game.setDailyDoubleWager(400);
      game.showAnswer();
      game.markIncorrect(p1.id);

      expect(p1.score).toBe(-400);
      expect(game.getState()).toBe(GameState.BOARD);
    });
  });

  describe('Round Progression & Board Control', () => {
    it('gives Round 2 board control to the highest scoring player (Player 1 breaks ties)', () => {
      // Award Patrick 400 points
      players.updateScore(p2.id, 400);
      players.updateScore(p1.id, 200);

      game.nextRound();
      expect(game.getCurrentRoundIndex()).toBe(1);
      expect(game.getCurrentRound().name).toBe('Double Jeopardy');
      expect(players.getActivePlayer().id).toBe(p2.id); // Patrick has highest score
    });

    it('breaks ties in Round 2 by choosing Player 1', () => {
      // Both have 0 points
      players.setActivePlayer(p2.id); // Patrick is currently active
      game.nextRound();
      expect(players.getActivePlayer().id).toBe(p1.id); // Reset to Player 1 on tie
    });
  });

  describe('Final Jeopardy', () => {
    beforeEach(() => {
      // Advance to Double Jeopardy, then to Final Jeopardy
      game.nextRound(); // Round 2
      game.nextRound(); // Final Jeopardy
      expect(game.getState()).toBe(GameState.FINAL_WAGER);
    });

    it('validates wagers: positive scores up to current score, non-positive scores up to 1000 comeback floor', () => {
      players.updateScore(p1.id, 1500); // Positive score
      players.updateScore(p2.id, -200); // Negative score

      // SpongeBob wager bounds: 0 to 1500
      expect(game.submitFinalWager(p1.id, -10)).toBe(false);
      expect(game.submitFinalWager(p1.id, 1501)).toBe(false);
      expect(game.submitFinalWager(p1.id, 1000)).toBe(true);

      // Patrick wager bounds: 0 to 1000 (comeback floor)
      expect(game.submitFinalWager(p2.id, 1001)).toBe(false);
      expect(game.submitFinalWager(p2.id, 800)).toBe(true);

      // All wagers submitted -> auto-transitions to FINAL_CLUE
      expect(game.getState()).toBe(GameState.FINAL_CLUE);
    });

    it('progresses to FINAL_ANSWER and marks answers, ending the game', () => {
      players.updateScore(p1.id, 1000);
      players.updateScore(p2.id, 1000);

      game.submitFinalWager(p1.id, 500);
      game.submitFinalWager(p2.id, 400);
      expect(game.getState()).toBe(GameState.FINAL_CLUE);

      game.showFinalAnswer();
      expect(game.getState()).toBe(GameState.FINAL_ANSWER);

      game.markFinalAnswer(p1.id, true); // SpongeBob correct: 1000 + 500 = 1500
      expect(game.getState()).toBe(GameState.FINAL_ANSWER); // Patrick not marked yet

      game.markFinalAnswer(p2.id, false); // Patrick incorrect: 1000 - 400 = 600
      // All players marked -> auto endGame -> GAME_OVER
      expect(game.getState()).toBe(GameState.GAME_OVER);
      expect(p1.score).toBe(1500);
      expect(p2.score).toBe(600);

      const winners = players.getWinner();
      expect(winners[0].id).toBe(p1.id);
    });
  });
});

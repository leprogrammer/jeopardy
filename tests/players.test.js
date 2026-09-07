import { describe, it, expect, beforeEach } from 'vitest';
import { Players } from '../js/players.js';

describe('Players Class', () => {
  let players;

  beforeEach(() => {
    players = new Players();
  });

  it('starts empty with count 0 and no active player', () => {
    expect(players.getCount()).toBe(0);
    expect(players.getActivePlayer()).toBeNull();
    expect(players.isValidCount()).toBe(false);
  });

  it('adds players and assigns auto-incrementing IDs', () => {
    const p1 = players.addPlayer('SpongeBob');
    const p2 = players.addPlayer('Patrick');

    expect(p1.id).toBe(1);
    expect(p1.name).toBe('SpongeBob');
    expect(p1.score).toBe(0);

    expect(p2.id).toBe(2);
    expect(p2.name).toBe('Patrick');
    expect(players.getCount()).toBe(2);
    expect(players.isValidCount()).toBe(true);
  });

  it('rejects empty or whitespace-only player names', () => {
    expect(() => players.addPlayer('')).toThrow('Player name cannot be empty.');
    expect(() => players.addPlayer('   ')).toThrow('Player name cannot be empty.');
  });

  it('enforces maximum of 10 players', () => {
    for (let i = 1; i <= 10; i++) {
      players.addPlayer(`Player ${i}`);
    }
    expect(players.getCount()).toBe(10);
    expect(players.isValidCount()).toBe(true);
    expect(() => players.addPlayer('Player 11')).toThrow('Cannot add more than 10 players.');
  });

  it('validates player count between 2 and 10', () => {
    expect(players.isValidCount()).toBe(false);
    players.addPlayer('Squidward');
    expect(players.isValidCount()).toBe(false);
    players.addPlayer('Sandy');
    expect(players.isValidCount()).toBe(true);
  });

  it('updates scores correctly, including negative values', () => {
    const p1 = players.addPlayer('SpongeBob');
    players.updateScore(p1.id, 400);
    expect(players.getPlayer(p1.id).score).toBe(400);

    players.updateScore(p1.id, -600);
    expect(players.getPlayer(p1.id).score).toBe(-200);
  });

  it('removes players and reassigns active player if active player was removed', () => {
    const p1 = players.addPlayer('SpongeBob');
    const p2 = players.addPlayer('Patrick');
    players.setActivePlayer(p1.id);
    expect(players.getActivePlayer().id).toBe(p1.id);

    players.removePlayer(p1.id);
    expect(players.getCount()).toBe(1);
    expect(players.getPlayer(p1.id)).toBeUndefined();
    expect(players.getActivePlayer().id).toBe(p2.id);

    expect(() => players.removePlayer(999)).toThrow('Player not found.');
  });

  it('sets and retrieves active player', () => {
    const p1 = players.addPlayer('SpongeBob');
    const p2 = players.addPlayer('Patrick');
    players.setActivePlayer(p2.id);
    expect(players.getActivePlayer().name).toBe('Patrick');
  });

  it('sorts scoreboard descending by score, breaking ties by lowest ID', () => {
    const p1 = players.addPlayer('SpongeBob');
    const p2 = players.addPlayer('Patrick');
    const p3 = players.addPlayer('Squidward');

    players.updateScore(p1.id, 1000);
    players.updateScore(p2.id, 2000);
    players.updateScore(p3.id, 1000);

    const sb = players.getScoreboard();
    expect(sb.map(p => p.name)).toEqual(['Patrick', 'SpongeBob', 'Squidward']);
  });

  it('determines winner(s) and handles ties', () => {
    const p1 = players.addPlayer('SpongeBob');
    const p2 = players.addPlayer('Patrick');
    const p3 = players.addPlayer('Sandy');

    players.updateScore(p1.id, 500);
    players.updateScore(p2.id, 1200);
    players.updateScore(p3.id, 1200);

    const winners = players.getWinner();
    expect(winners.length).toBe(2);
    expect(winners.map(w => w.name)).toEqual(['Patrick', 'Sandy']);
  });

  it('resets all player scores to 0', () => {
    const p1 = players.addPlayer('SpongeBob');
    const p2 = players.addPlayer('Patrick');
    players.updateScore(p1.id, 500);
    players.updateScore(p2.id, 800);

    players.reset();
    expect(players.getPlayer(p1.id).score).toBe(0);
    expect(players.getPlayer(p2.id).score).toBe(0);
  });

  it('serializes and deserializes state correctly', () => {
    const p1 = players.addPlayer('SpongeBob');
    const p2 = players.addPlayer('Patrick');
    players.updateScore(p1.id, 600);
    players.setActivePlayer(p2.id);

    const serialized = players.toJSON();

    const restored = new Players();
    restored.loadState(serialized);

    expect(restored.getCount()).toBe(2);
    expect(restored.getPlayer(p1.id).score).toBe(600);
    expect(restored.getActivePlayer().id).toBe(p2.id);
  });
});

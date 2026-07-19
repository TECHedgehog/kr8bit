import { describe, it, expect } from 'vitest';
import { normalizeGameName } from '../src/modules/scanner/name-normalizer.js';

describe('normalizeGameName', () => {
  it('strips .7z extension', () => {
    expect(normalizeGameName('Skyrim.7z').query).toBe('Skyrim');
  });

  it('strips repack tags', () => {
    expect(normalizeGameName('Skyrim (repack).7z').query).toBe('Skyrim');
    expect(normalizeGameName('Skyrim (FitGirl Repacks).7z').query).toBe('Skyrim');
    expect(normalizeGameName('Hogwarts Legacy [FitGirl Repack]').query).toBe('Hogwarts Legacy');
    expect(normalizeGameName('Game (GOG).7z').query).toBe('Game');
    expect(normalizeGameName('Game (MULTI8).7z').query).toBe('Game');
  });

  it('extracts year and removes from query', () => {
    const r = normalizeGameName('Elden Ring 2022');
    expect(r.query).toBe('Elden Ring');
    expect(r.yearDetected).toBe(2022);
  });

  it('extracts year from .7z name', () => {
    const r = normalizeGameName('Skyrim 2011.7z');
    expect(r.query).toBe('Skyrim');
    expect(r.yearDetected).toBe(2011);
  });

  it('removes version numbers', () => {
    expect(normalizeGameName('Cyberpunk v1.63').query).toBe('Cyberpunk');
    expect(normalizeGameName('Game v2.0.1.5').query).toBe('Game');
  });

  it('removes scene group tags', () => {
    expect(normalizeGameName('Game (CODEX)').query).toBe('Game');
    expect(normalizeGameName('Game (ElAmigos)').query).toBe('Game');
    expect(normalizeGameName('Game (DODI Repack)').query).toBe('Game');
  });

  it('replaces dots and underscores with spaces', () => {
    expect(normalizeGameName('Sid.Meiers.Civilization.VI').query).toBe('Sid Meiers Civilization VI');
    expect(normalizeGameName('BioShock_Infinite').query).toBe('BioShock Infinite');
  });

  it('collapses multiple whitespace', () => {
    expect(normalizeGameName('  Game   Title  ').query).toBe('Game Title');
  });

  it('falls back to original when normalization yields empty', () => {
    const r = normalizeGameName('....7z');
    expect(r.query.length).toBeGreaterThan(0);
  });

  it('handles fitgirl-repacks site name style', () => {
    const r = normalizeGameName('Cyberpunk 2077 (v2.0.0.1 + DLCs, MULTi13) [FitGirl Repack]');
    expect(r.query).toBe('Cyberpunk 2077');
  });

  it('preserves colons and apostrophes', () => {
    expect(normalizeGameName("Devil May Cry 5: Special Edition").query).toBe(
      "Devil May Cry 5: Special Edition",
    );
    expect(normalizeGameName("Assassin's Creed Odyssey").query).toBe(
      "Assassin's Creed Odyssey",
    );
  });

  it('preserves unicode (japanese, accents)', () => {
    expect(normalizeGameName('NieR Automata 日本語').query).toContain('NieR Automata');
    expect(normalizeGameName('Español Juego 2020').query).toBe('Español Juego');
  });
});
import { describe, it, expect } from 'vitest';
import { normalizeGameName, normalizeForMatch } from '../src/shared/normalize.js';

describe('normalizeGameName', () => {
  it('strips .7z extension', () => {
    expect(normalizeGameName('Skyrim.7z').query).toBe('Skyrim');
  });

  it('strips other archive extensions', () => {
    expect(normalizeGameName('Skyrim.zip').query).toBe('Skyrim');
    expect(normalizeGameName('Skyrim.rar').query).toBe('Skyrim');
    expect(normalizeGameName('Skyrim.iso').query).toBe('Skyrim');
    expect(normalizeGameName('Skyrim.r00').query).toBe('Skyrim');
    expect(normalizeGameName('Skyrim.tar.gz').query).toBe('Skyrim');
    expect(normalizeGameName('Setup.exe').query).toBe('Setup');
  });

  it('strips extension before tag removal', () => {
    expect(normalizeGameName('Skyrim (FitGirl).7z').query).toBe('Skyrim');
    expect(normalizeGameName('Hogwarts Legacy [FitGirl].zip').query).toBe('Hogwarts Legacy');
  });

  it('strips repack tags', () => {
    expect(normalizeGameName('Skyrim (repack).7z').query).toBe('Skyrim');
    expect(normalizeGameName('Skyrim (FitGirl Repacks).7z').query).toBe('Skyrim');
    expect(normalizeGameName('Hogwarts Legacy [FitGirl Repack]').query).toBe('Hogwarts Legacy');
    expect(normalizeGameName('Game (GOG).7z').query).toBe('Game');
    expect(normalizeGameName('Game (MULTI8).7z').query).toBe('Game');
  });

  it('keeps bare years, no detection', () => {
    const r = normalizeGameName('Elden Ring 2022');
    expect(r.query).toBe('Elden Ring 2022');
    expect(r.yearDetected).toBeUndefined();
  });

  it('keeps bare years from archive names', () => {
    const r = normalizeGameName('Skyrim 2011.7z');
    expect(r.query).toBe('Skyrim 2011');
    expect(r.yearDetected).toBeUndefined();
  });

  it('detects year inside parentheses', () => {
    const r = normalizeGameName('Game (2022)');
    expect(r.query).toBe('Game');
    expect(r.yearDetected).toBe(2022);
  });

  it('detects year inside brackets', () => {
    const r = normalizeGameName('Game [2011]');
    expect(r.query).toBe('Game');
    expect(r.yearDetected).toBe(2011);
  });

  it('uses max year when multiple delimited years exist', () => {
    const r = normalizeGameName('Game (2001) [2010]');
    expect(r.query).toBe('Game');
    expect(r.yearDetected).toBe(2010);
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

  it('strips region tags', () => {
    expect(normalizeGameName('Game (US)').query).toBe('Game');
    expect(normalizeGameName('Game (EU)').query).toBe('Game');
    expect(normalizeGameName('Game (JP)').query).toBe('Game');
    expect(normalizeGameName('Game [Global]').query).toBe('Game');
  });

  it('strips disc tags', () => {
    expect(normalizeGameName('Game (Disc 1)').query).toBe('Game');
    expect(normalizeGameName('Game (Disc 2 of 3)').query).toBe('Game');
    expect(normalizeGameName('Game [Disc 1]').query).toBe('Game');
  });

  it('strips development stage tags', () => {
    expect(normalizeGameName('Game (Beta)').query).toBe('Game');
    expect(normalizeGameName('Game (Early Access)').query).toBe('Game');
    expect(normalizeGameName('Game [Alpha]').query).toBe('Game');
  });

  it('strips additional scene group tags', () => {
    expect(normalizeGameName('Game (SKIDROW)').query).toBe('Game');
    expect(normalizeGameName('Game (RELOADED)').query).toBe('Game');
    expect(normalizeGameName('Game [PLAZA]').query).toBe('Game');
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
    expect(normalizeGameName("The Legend of Zelda: Breath of the Wild").query).toBe(
      "The Legend of Zelda: Breath of the Wild",
    );
    expect(normalizeGameName("Assassin's Creed Odyssey").query).toBe(
      "Assassin's Creed Odyssey",
    );
  });

  it('preserves unicode (japanese, accents)', () => {
    expect(normalizeGameName('NieR Automata 日本語').query).toContain('NieR Automata');
    expect(normalizeGameName('Español Juego 2020').query).toBe('Español Juego 2020');
  });

  it('strips bracket-form repack tags', () => {
    expect(normalizeGameName('Baldurs Gate 3 [DODI Repack].7z').query).toBe('Baldurs Gate 3');
    expect(normalizeGameName('Game [CODEX].7z').query).toBe('Game');
    expect(normalizeGameName('Game [ElAmigos Repack]').query).toBe('Game');
  });

  it('strips edition and variant suffixes', () => {
    expect(normalizeGameName('Skyrim Special Edition.7z').query).toBe('Skyrim');
    expect(normalizeGameName('Skyrim Remastered.7z').query).toBe('Skyrim');
    expect(normalizeGameName('Mass Effect Legendary Edition.7z').query).toBe('Mass Effect');
    expect(normalizeGameName('Witcher 3 GOTY.7z').query).toBe('Witcher 3');
    expect(normalizeGameName('Deus Ex Mankind Divided Directors Cut.7z').query).toBe('Deus Ex Mankind Divided');
  });

  it('does not strip bare HD from title', () => {
    expect(normalizeGameName('BioShock HD').query).toBe('BioShock HD');
  });

  it('strips HD inside brackets', () => {
    expect(normalizeGameName('Game (HD)').query).toBe('Game');
    expect(normalizeGameName('Game [UHD]').query).toBe('Game');
  });

  it('strips HD Edition suffix', () => {
    expect(normalizeGameName('Game HD Edition').query).toBe('Game');
    expect(normalizeGameName('Game UHD Edition').query).toBe('Game');
  });

  it('does not over-strip sequel numbers or apostrophes', () => {
    expect(normalizeGameName('Quake 3').query).toBe('Quake 3');
    expect(normalizeGameName("Tony Hawk's Pro Skater 1+2").query).toBe("Tony Hawk's Pro Skater 1 2");
    expect(normalizeGameName('Golden Axe').query).toBe('Golden Axe');
  });
});

describe('normalizeForMatch', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeForMatch('The Witcher 3: Wild Hunt')).toBe('the witcher 3 wild hunt');
    expect(normalizeForMatch("Tony Hawk's Pro Skater 1+2")).toBe('tony hawk s pro skater 1 2');
  });

  it('collapses whitespace', () => {
    expect(normalizeForMatch('  Game   Title  ')).toBe('game title');
  });
});

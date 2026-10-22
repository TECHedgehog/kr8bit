import { describe, it, expect } from 'vitest';
import {
  cleanGameTitle,
  getTitleVariants,
  normalizeGameName,
  normalizeForMatch,
  stripEditionPhrase,
} from '../src/shared/normalize.js';
import { parseReleaseName } from '../src/shared/release-name.js';
import { releaseNameFixtures } from './release-name.fixtures.js';

describe('shared release-name parser', () => {
  it.each(releaseNameFixtures)('normalizes $category: $input', ({ input, query, group }) => {
    expect(normalizeGameName(input).query).toBe(query);
    if (group) expect(parseReleaseName(input).group).toBe(group);
  });

  it('retains unknown editions while marking them unknown', () => {
    const parsed = parseReleaseName('Bubsy 4D: Digital Pawsome Edition');
    expect(parsed.baseTitle).toBe('Bubsy 4D: Digital Pawsome Edition');
    expect(parsed.editions).toEqual([{ name: 'Digital Pawsome Edition', known: false }]);
  });

  it('extracts language, platform, region, version, DLC, and group fields', () => {
    expect(parseReleaseName('Game (EN/RU) (US) PC x64 v1.2.3 + DLC: Expansion Pack (DODI)')).toMatchObject({
      baseTitle: 'Game', version: '1.2.3', group: 'DODI', dlcs: ['Expansion Pack'],
      languages: ['EN/RU'], platform: 'x64', region: 'US',
    });
  });
});

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
    expect(normalizeGameName('Bloodborne: Game of the Year Edition.7z').query).toBe('Bloodborne');
    expect(normalizeGameName('Bloodborne: GOTY Edition.7z').query).toBe('Bloodborne');
  });

  it('preserves language words inside titles and strips trailing language tags', () => {
    expect(normalizeGameName('JDM - Japanese Drift Master').query).toBe('JDM - Japanese Drift Master');
    expect(normalizeGameName('The Spanish Flu').query).toBe('The Spanish Flu');
    expect(normalizeGameName('Some Game EN').query).toBe('Some Game');
    expect(normalizeGameName('Game (EN/RU)').query).toBe('Game');
  });

  it('strips known edition markers only at title end', () => {
    expect(normalizeGameName('The House of Da Vinci Enhanced').query).toBe('The House of Da Vinci');
    expect(parseReleaseName('The House of Da Vinci Enhanced').editions).toEqual([
      { name: 'Enhanced', known: true },
    ]);
    expect(normalizeGameName('Broken Age - The Complete Adventure').query)
      .toBe('Broken Age - The Complete Adventure');
    expect(normalizeGameName('Scott Pilgrim vs The World CE').query)
      .toBe('Scott Pilgrim vs The World');
  });

  it('removes Edition orphaned by stripped soundtrack noise', () => {
    expect(normalizeGameName('LEGO Party! Soundtrack Edition.7z').query).toBe('LEGO Party!');
  });

  it('strips delimited release labels and opaque release suffixes', () => {
    expect(normalizeGameName('God of War III – (Recompiled for PC )').query).toBe('God of War III');
    expect(normalizeGameName('Towerfolk – (Release)').query).toBe('Towerfolk');
    expect(normalizeGameName('Warhammer 40,000: Boltgun 2 – +775').query).toBe('Warhammer 40 000: Boltgun 2');
    expect(normalizeGameName('Wild West Supermarket Simulator – .682a').query)
      .toBe('Wild West Supermarket Simulator');
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

describe('cleanGameTitle', () => {
  it('removes known editions and trailing repack noise but preserves punctuation', () => {
    expect(cleanGameTitle('Dragon’s Dogma 2: Deluxe Edition* –')).toBe('Dragon’s Dogma 2');
    expect(cleanGameTitle('Superhero Simulator + Bonus OST')).toBe('Superhero Simulator');
  });

  it('preserves unknown edition names for provider fallback', () => {
    expect(cleanGameTitle('Bubsy 4D: Digital Pawsome Edition')).toBe('Bubsy 4D: Digital Pawsome Edition');
  });
});

describe('stripEditionPhrase', () => {
  it('extracts base title from an unknown trailing edition phrase', () => {
    expect(stripEditionPhrase('Bubsy 4D: Digital Pawsome Edition')).toBe('Bubsy 4D');
  });

  it('trims trailing punctuation around edition phrase', () => {
    expect(stripEditionPhrase('Dragon’s Dogma 2: Deluxe Edition* –')).toBe('Dragon’s Dogma 2');
  });

  it('strips bare Edition suffixes', () => {
    expect(stripEditionPhrase('LEGO Party! Edition')).toBe('LEGO Party!');
  });

  it('returns null when title has no edition phrase', () => {
    expect(stripEditionPhrase('Superhero Simulator')).toBeNull();
  });
});

describe('getTitleVariants', () => {
  it.each([
    ['Broken Age - The Complete Adventure', ['Broken Age - The Complete Adventure', 'Broken Age']],
    ['Dragon Ball: Xenoverse - Bundle Edition', [
      'Dragon Ball: Xenoverse - Bundle Edition',
      'Dragon Ball: Xenoverse',
    ]],
    ['Black Myth - Wukong', ['Black Myth - Wukong', 'Black Myth']],
    ['MUSYNX-RETURN', ['MUSYNX-RETURN']],
  ])('returns ordered unique variants for %s', (title, variants) => {
    expect(getTitleVariants(title)).toEqual(variants);
  });
});

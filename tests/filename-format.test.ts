import { describe, expect, it } from 'vitest';
import { DEFAULT_FILENAME_FORMAT, FORMAT_TAGS, renderFilenameFormat, validateFilenameFormat } from '../src/shared/filename-format.js';
import type { Game } from '../src/modules/library/library.types.js';

const game = {
  title: 'Example Game', displayName: 'Example Game', releaseYear: 2024,
  releaseVersion: '1.2', releaseDlcs: ['Expansion'], releaseGroup: 'FitGirl',
  originalEntryName: 'Example Game Deluxe Edition v1.2 PC + Expansion (FitGirl).7z', entryName: 'Example.7z',
} as Game;

describe('filename format', () => {
  it('removes empty optional sections', () => {
    expect(renderFilenameFormat({ ...game, releaseYear: null, originalEntryName: null }, DEFAULT_FILENAME_FORMAT)).toBe('Example Game');
  });

  it('renders release tags', () => {
    expect(renderFilenameFormat(game, '{title} {version} [{group}]')).toBe('Example Game 1.2 [FitGirl]');
  });

  it('renders all supported tags', () => {
    expect(FORMAT_TAGS).toHaveLength(8);
    expect(renderFilenameFormat(game, '{title} ({year}) [{edition}] {platform} {version} {dlcs} {group} {original}'))
      .toBe('Example Game (2024) [Deluxe Edition] PC 1.2 Expansion FitGirl Example Game Deluxe Edition v1.2 PC + Expansion (FitGirl).7z');
  });

  it('validates tags and malformed templates', () => {
    expect(validateFilenameFormat('{title}')).toBe('{title}');
    expect(() => validateFilenameFormat('{unknown}')).toThrow('unsupported filename tag');
    expect(() => validateFilenameFormat('{title')).toThrow('unmatched brace');
    expect(() => validateFilenameFormat('x'.repeat(1001))).toThrow('too long');
  });
});

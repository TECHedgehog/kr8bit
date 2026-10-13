import { describe, expect, it } from 'vitest';
import { DEFAULT_FILENAME_FORMAT, renderFilenameFormat } from '../src/modules/library/filename-format.js';
import type { Game } from '../src/modules/library/library.types.js';

const game = {
  title: 'Example Game', displayName: 'Example Game', releaseYear: null, releaseVersion: '1.2',
  releaseDlcs: ['Expansion'], releaseGroup: 'FitGirl', originalEntryName: 'Example v1.2 (FitGirl).7z',
} as Game;

describe('filename format', () => {
  it('removes empty optional sections', () => {
    expect(renderFilenameFormat(game, DEFAULT_FILENAME_FORMAT)).toBe('Example Game');
  });

  it('renders release tags', () => {
    expect(renderFilenameFormat(game, '{title} {version} [{group}]')).toBe('Example Game 1.2 [FitGirl]');
  });
});

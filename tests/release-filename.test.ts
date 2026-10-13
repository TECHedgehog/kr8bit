import { describe, expect, it } from 'vitest';
import { parseReleaseFilename } from '../src/shared/parse-release-filename.js';

describe('parseReleaseFilename', () => {
  it('keeps release details from repack names', () => {
    expect(parseReleaseFilename('Game v1.2.3 + DLCs (FitGirl).7z')).toEqual({
      version: '1.2.3',
      dlcs: ['DLCs'],
      group: 'FitGirl',
    });
  });
});

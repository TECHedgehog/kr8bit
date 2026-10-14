import { describe, expect, it } from 'vitest';
import { parseReleaseFilename } from '../src/shared/parse-release-filename.js';

describe('parseReleaseFilename', () => {
  it('extracts marked version, named DLC, and known repack group', () => {
    expect(parseReleaseFilename('Game v1.2.3 + DLC: Expansion Pack + Update 4 (FitGirl).7z', 'ARCHIVE')).toEqual({
      version: '1.2.3', dlcs: ['Expansion Pack'], group: 'FitGirl',
    });
  });

  it('does not mistake ordinary decimal title number for version', () => {
    expect(parseReleaseFilename('Unreal 3.5 Edition.7z', 'ARCHIVE').version).toBeNull();
  });

  it('extracts marked single-segment versions', () => {
    expect(parseReleaseFilename('Game v2 (DODI).7z', 'ARCHIVE').version).toBe('2');
  });

  it('does not strip directory suffix as an extension', () => {
    expect(parseReleaseFilename('Game.Name-ElAmigos', 'DIRECTORY')).toEqual({ version: null, dlcs: [], group: 'ElAmigos' });
  });

  it('ignores a DLC marker without DLC names and excludes update segments', () => {
    expect(parseReleaseFilename('Game + DLCs + Update 4 (FitGirl).7z', 'ARCHIVE').dlcs).toEqual([]);
  });

  it('does not parse GOG title text as release group', () => {
    expect(parseReleaseFilename('GOG Galaxy Game v1.2.3.7z', 'ARCHIVE').group).toBeNull();
  });
});

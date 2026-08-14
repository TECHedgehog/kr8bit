import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchStatus, STEAM_PROVIDER_NAME } from '../src/shared/enums.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { providerMatchRepository } from '../src/modules/metadata/provider-match.repository.js';
import { applyMatchResult } from '../src/modules/scanner/match-apply.js';

vi.mock('../src/modules/library/library.repository.js', () => ({
  libraryRepository: {
    update: vi.fn(),
  },
}));

vi.mock('../src/modules/metadata/provider-match.repository.js', () => ({
  providerMatchRepository: {
    upsert: vi.fn(),
  },
}));

function makeDecision(status: MatchStatus, providerName: string, remoteId: string, title: string) {
  return {
    status,
    score: 80,
    result: { providerName, remoteId, title },
  } as unknown as Parameters<typeof applyMatchResult>[1];
}

const now = new Date('2024-01-01T00:00:00Z');

describe('applyMatchResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false and writes nothing when result is null', async () => {
    const decision = { status: MatchStatus.PENDING, score: 0, result: null } as unknown as Parameters<typeof applyMatchResult>[1];
    expect(await applyMatchResult('1', decision, now)).toBe(false);
    expect(libraryRepository.update).not.toHaveBeenCalled();
    expect(providerMatchRepository.upsert).not.toHaveBeenCalled();
  });

  it('returns false and writes nothing when status is REJECTED', async () => {
    const decision = makeDecision(MatchStatus.REJECTED, 'igdb', '20', 'Game');
    expect(await applyMatchResult('1', decision, now)).toBe(false);
    expect(libraryRepository.update).not.toHaveBeenCalled();
    expect(providerMatchRepository.upsert).not.toHaveBeenCalled();
  });

  it('updates Game with steamAppId + title for ACCEPTED + steam', async () => {
    const decision = makeDecision(MatchStatus.ACCEPTED, STEAM_PROVIDER_NAME, '123', 'Steam Game');
    expect(await applyMatchResult('1', decision, now)).toBe(true);
    expect(libraryRepository.update).toHaveBeenCalledWith('1', {
      matchStatus: MatchStatus.ACCEPTED,
      matchScore: 80,
      matchedAt: now,
      steamAppId: 123,
      title: 'Steam Game',
    });
    expect(providerMatchRepository.upsert).not.toHaveBeenCalled();
  });

  it('updates Game with title + upserts ProviderMatch for ACCEPTED + non-steam', async () => {
    const decision = makeDecision(MatchStatus.ACCEPTED, 'igdb', '20', 'Igdb Game');
    expect(await applyMatchResult('1', decision, now)).toBe(true);
    expect(libraryRepository.update).toHaveBeenCalledWith('1', {
      matchStatus: MatchStatus.ACCEPTED,
      matchScore: 80,
      matchedAt: now,
      title: 'Igdb Game',
    });
    expect(providerMatchRepository.upsert).toHaveBeenCalledWith({
      gameId: '1',
      providerName: 'igdb',
      remoteId: '20',
      matchScore: 80,
      isPrimary: true,
      matchedAt: now,
    });
  });

  it('updates Game for FLAGGED + steam and returns true', async () => {
    const decision = makeDecision(MatchStatus.FLAGGED, STEAM_PROVIDER_NAME, '456', 'Steam Game 2');
    expect(await applyMatchResult('1', decision, now)).toBe(true);
    expect(libraryRepository.update).toHaveBeenCalledWith('1', {
      matchStatus: MatchStatus.FLAGGED,
      matchScore: 80,
      matchedAt: now,
      steamAppId: 456,
      title: 'Steam Game 2',
    });
    expect(providerMatchRepository.upsert).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchStatus } from '../src/shared/enums.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { metadataService } from '../src/modules/metadata/metadata.service.js';
import { ArtworkRecheckJob } from '../src/modules/artwork/artwork-recheck.job.js';

vi.mock('../src/modules/library/library.repository.js', () => ({
  libraryRepository: { listAll: vi.fn() },
}));
vi.mock('../src/modules/metadata/metadata.service.js', () => ({
  metadataService: { recheckArtwork: vi.fn() },
}));

function makeGame(id: string, matchStatus: MatchStatus) {
  return { id, matchStatus } as never;
}

beforeEach(() => vi.clearAllMocks());

describe('ArtworkRecheckJob', () => {
  it('checks artwork for every matched game and skips unmatched games', async () => {
    vi.mocked(libraryRepository.listAll).mockResolvedValue([
      makeGame('matched', MatchStatus.ACCEPTED),
      makeGame('manual', MatchStatus.MANUAL),
      makeGame('pending', MatchStatus.PENDING),
    ]);
    vi.mocked(metadataService.recheckArtwork).mockResolvedValue(true);
    const job = new ArtworkRecheckJob({ delayMs: 0, concurrency: 1, sleep: vi.fn() });

    await job.start();

    expect(metadataService.recheckArtwork.mock.calls.map(([id]) => id)).toEqual(['matched', 'manual']);
    expect(job.state()).toMatchObject({ running: false, processed: 2, failed: 0 });
  });
});

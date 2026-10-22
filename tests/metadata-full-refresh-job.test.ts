import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchStatus } from '../src/shared/enums.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { metadataService } from '../src/modules/metadata/metadata.service.js';
import { MetadataFullRefreshJob } from '../src/modules/metadata/metadata-full-refresh.job.js';

vi.mock('../src/modules/library/library.repository.js', () => ({
  libraryRepository: { listAll: vi.fn() },
}));
vi.mock('../src/modules/metadata/metadata.service.js', () => ({
  metadataService: { refresh: vi.fn() },
}));

function makeGame(id: string, matchStatus: MatchStatus) {
  return { id, matchStatus } as never;
}

beforeEach(() => vi.clearAllMocks());

describe('MetadataFullRefreshJob', () => {
  it('refreshes all matched statuses, including recently refreshed games', async () => {
    vi.mocked(libraryRepository.listAll).mockResolvedValue([
      makeGame('accepted', MatchStatus.ACCEPTED),
      makeGame('flagged', MatchStatus.FLAGGED),
      makeGame('manual', MatchStatus.MANUAL),
      makeGame('pending', MatchStatus.PENDING),
    ]);
    vi.mocked(metadataService.refresh).mockResolvedValue({} as never);
    const job = new MetadataFullRefreshJob({ delayMs: 0, concurrency: 1, sleep: vi.fn() });

    await job.start();

    expect(metadataService.refresh.mock.calls.map(([id]) => id)).toEqual(['accepted', 'flagged', 'manual']);
    expect(job.state()).toMatchObject({ running: false, processed: 3, failed: 0 });
  });
});

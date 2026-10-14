import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  settingsGet: vi.fn(), settingsSet: vi.fn(),
  knownUrls: vi.fn(), upsertPost: vi.fn(), saveCandidates: vi.fn(), acceptMatch: vi.fn(),
  findGame: vi.fn(), listGames: vi.fn(), getGame: vi.fn(), listReview: vi.fn(),
  createSource: vi.fn(), providerSearch: vi.fn(), providerGetGame: vi.fn(),
  registryRegister: vi.fn(), providerOrder: vi.fn(), providerResolve: vi.fn(),
}));

vi.mock('../src/modules/settings/settings.repository.js', () => ({ settingsRepository: { get: mocks.settingsGet, set: mocks.settingsSet } }));
vi.mock('../src/modules/repack-catalog/repack-catalog.repository.js', () => ({
  repackCatalogRepository: {
    knownUrls: mocks.knownUrls, upsertPost: mocks.upsertPost,
    saveCandidates: mocks.saveCandidates, acceptMatch: mocks.acceptMatch,
    findGameByNormalizedTitle: mocks.findGame, listGames: mocks.listGames,
    getGame: mocks.getGame, listReview: mocks.listReview,
  },
}));
vi.mock('../src/modules/repack-catalog/sources/source-registry.js', () => ({
  repackSourceRegistry: { register: mocks.registryRegister, create: mocks.createSource },
}));
vi.mock('../src/modules/repack-catalog/sources/fitgirl/fitgirl.source.js', () => ({ FitGirlSource: class {} }));
vi.mock('../src/modules/metadata/provider-registry.js', () => ({
  providerRegistry: { order: mocks.providerOrder, resolve: mocks.providerResolve },
}));

import { RepackCatalogService } from '../src/modules/repack-catalog/repack-catalog.service.js';

describe('RepackCatalogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settingsGet.mockImplementation(async (key: string) => key === 'repackCatalogEnabled' ? 'true' : null);
    mocks.settingsSet.mockResolvedValue({});
    mocks.knownUrls.mockResolvedValue(new Set());
    mocks.saveCandidates.mockResolvedValue({});
    mocks.acceptMatch.mockResolvedValue({});
    const provider = { name: 'steam', search: mocks.providerSearch, getGame: mocks.providerGetGame };
    mocks.providerOrder.mockReturnValue([provider]);
    mocks.providerResolve.mockReturnValue(provider);
    mocks.providerSearch.mockResolvedValue([{ providerName: 'steam', remoteId: '1', title: 'Example Game', score: 96 }]);
    mocks.providerGetGame.mockResolvedValue({ title: 'Example Game', developers: [], publishers: [], genres: [] });
    mocks.createSource.mockReturnValue({
      name: 'fitgirl',
      discoverPostUrls: vi.fn().mockResolvedValue(['https://fitgirl.test/game/', 'https://fitgirl.test/game-update/']),
      fetchPost: vi.fn().mockImplementation(async (url: string) => ({
        source: 'fitgirl', sourceUrl: url, title: 'Example Game', normalizedTitle: 'example game',
        contentText: 'repack details', details: {}, downloadOptions: [], postKind: 'GAME', contentHash: url,
      })),
    });
    mocks.upsertPost.mockResolvedValue({ game: { id: 'catalog-1', title: 'Example Game', normalizedTitle: 'example game', matchStatus: 'PENDING' } });
  });

  it('matches once per aggregated game, not once per source post', async () => {
    const service = new RepackCatalogService();
    const result = await service.sync();
    expect(result.processed).toBe(2);
    expect(mocks.providerSearch).toHaveBeenCalledTimes(1);
    expect(mocks.acceptMatch).toHaveBeenCalledTimes(1);
  });

  it('does not start full-history discovery on recent sync', async () => {
    const service = new RepackCatalogService();
    await service.sync();
    expect(mocks.createSource.mock.results[0].value.discoverPostUrls).toHaveBeenCalledWith(expect.objectContaining({ fullArchive: false }));
    expect(mocks.settingsSet).not.toHaveBeenCalled();
  });

  it('cancels in-flight source requests when disabled', async () => {
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    mocks.createSource.mockReturnValue({
      name: 'fitgirl',
      discoverPostUrls: vi.fn().mockResolvedValue(['https://fitgirl.test/game/']),
      fetchPost: (_url: string, signal?: AbortSignal) => new Promise((_resolve, reject) => {
        if (signal?.aborted) reject(signal.reason);
        else signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        markStarted();
      }),
    });
    const service = new RepackCatalogService();
    const run = service.sync();
    await started;
    service.cancel();
    await expect(run).resolves.toMatchObject({ cancelled: true });
    expect(service.jobStatus().phase).toBe('cancelled');
  });
});

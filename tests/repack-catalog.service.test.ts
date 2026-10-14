import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  settingsGet: vi.fn(), settingsSet: vi.fn(),
  knownUrls: vi.fn(), upsertPost: vi.fn(), saveCandidates: vi.fn(), acceptMatch: vi.fn(), regroupGames: vi.fn(),
  findGame: vi.fn(), findRematchableGames: vi.fn(), listGames: vi.fn(), getGame: vi.fn(), listReview: vi.fn(),
  createSource: vi.fn(), providerSearch: vi.fn(), providerGetGame: vi.fn(),
  registryRegister: vi.fn(), providerOrder: vi.fn(), providerResolve: vi.fn(),
}));

vi.mock('../src/modules/settings/settings.repository.js', () => ({ settingsRepository: { get: mocks.settingsGet, set: mocks.settingsSet } }));
vi.mock('../src/modules/repack-catalog/repack-catalog.repository.js', () => ({
  repackCatalogRepository: {
     knownUrls: mocks.knownUrls, upsertPost: mocks.upsertPost, regroupGames: mocks.regroupGames,
     saveCandidates: mocks.saveCandidates, acceptMatch: mocks.acceptMatch,
     findGameByNormalizedTitle: mocks.findGame, findRematchableGames: mocks.findRematchableGames, listGames: mocks.listGames,
    getGame: mocks.getGame, listReview: mocks.listReview,
  },
}));
vi.mock('../src/modules/repack-catalog/sources/source-registry.js', () => ({
  repackSourceRegistry: { register: mocks.registryRegister, create: mocks.createSource },
}));
vi.mock('../src/modules/repack-catalog/sources/fitgirl/fitgirl.source.js', () => ({
  FitGirlSource: class {}, fitGirlGameTitle: (title: string) => title, normalizeFitGirlGameTitle: (title: string) => title.toLowerCase(),
}));
vi.mock('../src/modules/metadata/provider-registry.js', () => ({
  providerRegistry: { order: mocks.providerOrder, resolve: mocks.providerResolve },
}));

import { RepackCatalogService } from '../src/modules/repack-catalog/repack-catalog.service.js';

describe('RepackCatalogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settingsGet.mockImplementation(async (key: string) => key === 'repackCatalogEnabled' ? 'true' : null);
    mocks.settingsSet.mockResolvedValue({});
    mocks.regroupGames.mockResolvedValue(undefined);
    mocks.findRematchableGames.mockResolvedValue([]);
    mocks.knownUrls.mockResolvedValue(new Set());
    mocks.saveCandidates.mockResolvedValue({});
    mocks.acceptMatch.mockResolvedValue({});
    const provider = { name: 'steam', search: mocks.providerSearch, getGame: mocks.providerGetGame };
    mocks.providerOrder.mockReturnValue([provider]);
    mocks.providerResolve.mockReturnValue(provider);
    mocks.providerSearch.mockResolvedValue([{ providerName: 'steam', remoteId: '1', title: 'Example Game', score: 96 }]);
    mocks.providerGetGame.mockResolvedValue({
      remoteId: '1', title: 'Example Game', developers: [], publishers: [], genres: [],
      coverUrl: 'cover-url', headerUrl: 'header-url', heroUrl: 'hero-url', logoUrl: 'logo-url',
      steamDeckCompat: { category: 3, items: [{ displayType: 1, locToken: 'playable' }] },
      screenshots: [{ url: 'screenshot', thumbnailUrl: 'thumb' }], videos: [{ url: 'video', thumbnailUrl: 'thumb' }],
    });
    mocks.createSource.mockReturnValue({
      name: 'fitgirl',
      discoverPostUrls: vi.fn().mockResolvedValue(['https://fitgirl.test/game/', 'https://fitgirl.test/game-update/']),
      fetchPost: vi.fn().mockImplementation(async (url: string) => ({
        source: 'fitgirl', sourceUrl: url, title: 'Example Game', gameTitle: 'Example Game', normalizedTitle: 'example game',
        tags: [], details: {}, downloadOptions: [], postKind: 'GAME', contentHash: url,
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
    const snapshot = mocks.acceptMatch.mock.calls[0][2];
    expect(snapshot.remoteId).toBe('1');
    expect(snapshot).toMatchObject({ coverUrl: 'cover-url', headerUrl: 'header-url', heroUrl: 'hero-url', logoUrl: 'logo-url' });
    expect(snapshot.steamDeckCompat).toEqual({ category: 3, items: [{ displayType: 1, locToken: 'playable' }] });
    expect(snapshot).not.toHaveProperty('screenshots');
    expect(snapshot).not.toHaveProperty('videos');
  });

  it('does not start full-history discovery on recent sync', async () => {
    const service = new RepackCatalogService();
    await service.sync();
    expect(mocks.createSource.mock.results[0].value.discoverPostUrls).toHaveBeenCalledWith(expect.objectContaining({ fullArchive: false }));
    expect(mocks.settingsSet).not.toHaveBeenCalled();
  });

  it('accepts best candidate at library threshold without a score margin', async () => {
    mocks.providerSearch.mockResolvedValue([
      { providerName: 'steam', remoteId: '1', title: 'Example Game', score: 91 },
      { providerName: 'steam', remoteId: '2', title: 'Example Game Deluxe', score: 90 },
    ]);
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.acceptMatch).toHaveBeenCalledTimes(1);
    expect(mocks.saveCandidates).not.toHaveBeenCalled();
  });

  it('leaves library-equivalent flagged scores in manual review', async () => {
    mocks.providerSearch.mockResolvedValue([{ providerName: 'steam', remoteId: '1', title: 'Example Game', score: 80 }]);
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.saveCandidates).toHaveBeenCalledWith('catalog-1', expect.any(Array), 'REVIEW', 80);
    expect(mocks.acceptMatch).not.toHaveBeenCalled();
  });

  it('keeps games pending when providers return no candidates', async () => {
    mocks.providerSearch.mockResolvedValue([]);
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.saveCandidates).toHaveBeenCalledWith('catalog-1', [], 'PENDING', 0);
    expect(mocks.acceptMatch).not.toHaveBeenCalled();
  });

  it('retries existing pending matches once at sync start', async () => {
    mocks.findRematchableGames.mockResolvedValue([{ id: 'catalog-existing', title: 'Example Game', normalizedTitle: 'example game' }]);
    mocks.createSource.mockReturnValue({
      name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue([]), fetchPost: vi.fn(),
    });
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.providerSearch).toHaveBeenCalledTimes(1);
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-existing', expect.any(Object), expect.any(Object));
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

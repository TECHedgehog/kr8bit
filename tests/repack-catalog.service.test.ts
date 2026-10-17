import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  settingsGet: vi.fn(), settingsSet: vi.fn(),
  knownUrls: vi.fn(), upsertPost: vi.fn(), saveCandidates: vi.fn(), acceptMatch: vi.fn(), regroupGames: vi.fn(),
  findRematchableGames: vi.fn(), listGames: vi.fn(), getGame: vi.fn(), listReview: vi.fn(),
  createSource: vi.fn(), providerSearch: vi.fn(), providerGetGame: vi.fn(),
  registryRegister: vi.fn(), providerOrder: vi.fn(), providerResolve: vi.fn(),
}));

vi.mock('../src/modules/settings/settings.repository.js', () => ({ settingsRepository: { get: mocks.settingsGet, set: mocks.settingsSet } }));
vi.mock('../src/modules/repack-catalog/repack-catalog.repository.js', () => ({
  repackCatalogRepository: {
    knownUrls: mocks.knownUrls, upsertPost: mocks.upsertPost,
    saveCandidates: mocks.saveCandidates, acceptMatch: mocks.acceptMatch,
    findRematchableGames: mocks.findRematchableGames, listGames: mocks.listGames,
    getGame: mocks.getGame, listReview: mocks.listReview,
  },
}));
vi.mock('../src/modules/repack-catalog/repack-catalog.regroup.js', () => ({ regroupRepackGames: mocks.regroupGames }));
vi.mock('../src/modules/repack-catalog/sources/source-registry.js', () => ({
  repackSourceRegistry: { register: mocks.registryRegister, create: mocks.createSource },
}));
vi.mock('../src/modules/repack-catalog/sources/fitgirl/fitgirl.source.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/modules/repack-catalog/sources/fitgirl/fitgirl.source.js')>();
  return { ...actual, FitGirlSource: class {} };
});
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
    expect(snapshot.screenshots).toEqual([{ url: 'screenshot', thumbnailUrl: 'thumb' }]);
    expect(snapshot.videos).toEqual([{ url: 'video', thumbnailUrl: 'thumb' }]);
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

  it('marks below-threshold candidates rejected', async () => {
    mocks.providerSearch.mockResolvedValue([
      { providerName: 'steam', remoteId: '1', title: 'Example Game', score: 50 },
    ]);
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.saveCandidates).toHaveBeenCalledWith('catalog-1', expect.any(Array), 'REJECTED', 50);
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

  it('searches using the library-normalized title', async () => {
    mocks.findRematchableGames.mockResolvedValue([{
      id: 'catalog-dragon', title: 'Dragon’s Dogma 2', normalizedTitle: 'dragon s dogma 2',
      posts: [{ title: 'Dragon’s Dogma 2: Deluxe Edition* –' }],
    }]);
    mocks.createSource.mockReturnValue({
      name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue([]), fetchPost: vi.fn(),
    });
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.providerSearch).toHaveBeenCalledTimes(1);
    expect(mocks.providerSearch).toHaveBeenCalledWith('Dragon s Dogma 2');
  });

  it('falls back from unknown edition to base game when edition has no match', async () => {
    mocks.findRematchableGames.mockResolvedValue([{
      id: 'catalog-bubsy', title: 'Bubsy 4D: Digital Pawsome Edition', normalizedTitle: 'bubsy 4d digital pawsome edition',
      posts: [{ title: 'Bubsy 4D: Digital Pawsome Edition, v1.2 + 2 DLCs/Bonuses' }],
    }]);
    mocks.createSource.mockReturnValue({
      name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue([]), fetchPost: vi.fn(),
    });
    mocks.providerSearch.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { providerName: 'steam', remoteId: 'bubsy-base', title: 'Bubsy 4D', score: 96 },
    ]);
    mocks.providerGetGame.mockResolvedValue({
      remoteId: 'bubsy-base', title: 'Bubsy 4D', developers: [], publishers: [], genres: [],
    });
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.providerSearch).toHaveBeenNthCalledWith(1, 'Bubsy 4D: Digital Pawsome Edition');
    expect(mocks.providerSearch).toHaveBeenNthCalledWith(2, 'Bubsy 4D');
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-bubsy', expect.objectContaining({ remoteId: 'bubsy-base' }), expect.any(Object));
  });

  it('keeps a confident edition-specific match without base fallback', async () => {
    mocks.findRematchableGames.mockResolvedValue([{
      id: 'catalog-bubsy', title: 'Bubsy 4D: Digital Pawsome Edition', normalizedTitle: 'bubsy 4d digital pawsome edition',
      posts: [{ title: 'Bubsy 4D: Digital Pawsome Edition' }],
    }]);
    mocks.createSource.mockReturnValue({
      name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue([]), fetchPost: vi.fn(),
    });
    mocks.providerSearch.mockResolvedValueOnce([
      { providerName: 'steam', remoteId: 'bubsy-edition', title: 'Bubsy 4D: Digital Pawsome Edition', score: 96 },
    ]);
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.providerSearch).toHaveBeenCalledTimes(1);
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-bubsy', expect.objectContaining({ remoteId: 'bubsy-edition' }), expect.any(Object));
  });

  it('tries other accepted candidates when best provider has no metadata', async () => {
    const steamProvider = { name: 'steam', search: mocks.providerSearch, getGame: mocks.providerGetGame };
    const igdbProvider = { name: 'igdb', search: mocks.providerSearch, getGame: mocks.providerGetGame };
    mocks.providerOrder.mockReturnValue([steamProvider, igdbProvider]);
    mocks.findRematchableGames.mockResolvedValue([{
      id: 'catalog-towerfolk', title: 'Towerfolk', normalizedTitle: 'towerfolk', posts: [{ title: 'Towerfolk' }],
    }]);
    mocks.createSource.mockReturnValue({
      name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue([]), fetchPost: vi.fn(),
    });
    mocks.providerSearch.mockResolvedValueOnce([
      { providerName: 'steam', remoteId: '3948100', title: 'Towerfolk', score: 100 },
    ]).mockResolvedValueOnce([
      { providerName: 'igdb', remoteId: '360959', title: 'Towerfolk', score: 100 },
    ]);
    mocks.providerGetGame.mockResolvedValueOnce(null).mockResolvedValueOnce({
      remoteId: '360959', title: 'Towerfolk', developers: [], publishers: [], genres: [],
    });
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.providerGetGame).toHaveBeenNthCalledWith(1, '3948100');
    expect(mocks.providerGetGame).toHaveBeenNthCalledWith(2, '360959');
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-towerfolk', expect.objectContaining({
      providerName: 'igdb', remoteId: '360959',
    }), expect.any(Object));
  });

  it('tries base-game fallback after edition candidate metadata fetch fails', async () => {
    mocks.findRematchableGames.mockResolvedValue([{
      id: 'catalog-bubsy', title: 'Bubsy 4D: Digital Pawsome Edition', normalizedTitle: 'bubsy 4d digital pawsome edition',
      posts: [{ title: 'Bubsy 4D: Digital Pawsome Edition' }],
    }]);
    mocks.createSource.mockReturnValue({
      name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue([]), fetchPost: vi.fn(),
    });
    mocks.providerSearch.mockResolvedValueOnce([
      { providerName: 'steam', remoteId: 'bubsy-edition', title: 'Bubsy 4D: Digital Pawsome Edition', score: 98 },
    ]).mockResolvedValueOnce([
      { providerName: 'steam', remoteId: 'bubsy-base', title: 'Bubsy 4D', score: 96 },
    ]);
    mocks.providerGetGame.mockResolvedValueOnce(null).mockResolvedValueOnce({
      remoteId: 'bubsy-base', title: 'Bubsy 4D', developers: [], publishers: [], genres: [],
    });
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.providerSearch).toHaveBeenNthCalledWith(1, 'Bubsy 4D: Digital Pawsome Edition');
    expect(mocks.providerSearch).toHaveBeenNthCalledWith(2, 'Bubsy 4D');
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-bubsy', expect.objectContaining({ remoteId: 'bubsy-base' }), expect.any(Object));
  });

  it('uses base-game candidates for review when fallback is flagged', async () => {
    mocks.findRematchableGames.mockResolvedValue([{
      id: 'catalog-bubsy', title: 'Bubsy 4D: Digital Pawsome Edition', normalizedTitle: 'bubsy 4d digital pawsome edition',
      posts: [{ title: 'Bubsy 4D: Digital Pawsome Edition' }],
    }]);
    mocks.createSource.mockReturnValue({
      name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue([]), fetchPost: vi.fn(),
    });
    mocks.providerSearch.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { providerName: 'steam', remoteId: 'bubsy-base', title: 'Bubsy 4D', score: 80 },
    ]);
    const service = new RepackCatalogService();

    await service.sync();

    expect(mocks.saveCandidates).toHaveBeenCalledWith('catalog-bubsy', [
      { providerName: 'steam', remoteId: 'bubsy-base', title: 'Bubsy 4D', releaseYear: undefined, coverUrl: undefined, score: 80 },
    ], 'REVIEW', 80);
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

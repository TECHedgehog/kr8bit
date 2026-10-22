import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepackCatalogService, type RepackCatalogServiceDependencies } from '../src/modules/repack-catalog/repack-catalog.service.js';
import type { SteamGridDbHttpClient } from '../src/modules/artwork/steamgriddb/steamgriddb.http.js';
import type { SteamGridDbGame, SteamGridDbImage } from '../src/modules/artwork/steamgriddb/steamgriddb.http.types.js';

const mocks = {
  settingsGet: vi.fn(), settingsSet: vi.fn(), settingsSetMany: vi.fn(), settingsList: vi.fn(), settingsDelete: vi.fn(), regroupGames: vi.fn(),
  knownUrls: vi.fn(), upsertPost: vi.fn(), saveCandidates: vi.fn(), acceptMatch: vi.fn(),
  findRematchableGames: vi.fn(), listGames: vi.fn(), getGame: vi.fn(), listReview: vi.fn(),
  listAuditPosts: vi.fn(), markAuditSeen: vi.fn(), listGenres: vi.fn(), getArtworkGame: vi.fn(), rejectMatch: vi.fn(),
  createSource: vi.fn(), providerSearch: vi.fn(), providerGetGame: vi.fn(),
  providerOrder: vi.fn(), providerResolve: vi.fn(),
};

const fakeRepository: RepackCatalogServiceDependencies['repackCatalogRepository'] = {
  knownUrls: mocks.knownUrls,
  listAuditPosts: mocks.listAuditPosts,
  markAuditSeen: mocks.markAuditSeen,
  upsertPost: mocks.upsertPost,
  findRematchableGames: mocks.findRematchableGames,
  saveCandidates: mocks.saveCandidates,
  listGames: mocks.listGames,
  listGenres: mocks.listGenres,
  getGame: mocks.getGame,
  getArtworkGame: mocks.getArtworkGame,
  listReview: mocks.listReview,
  acceptMatch: mocks.acceptMatch,
  rejectMatch: mocks.rejectMatch,
};

const fakeSettingsRepository: RepackCatalogServiceDependencies['settingsRepository'] = {
  get: mocks.settingsGet,
  set: mocks.settingsSet,
  setMany: mocks.settingsSetMany,
  list: mocks.settingsList,
  delete: mocks.settingsDelete,
};

const fakeArtworkService: NonNullable<RepackCatalogServiceDependencies['artworkService']> = {
  downloadToCacheGeneric: vi.fn(),
};

function steamGridDbClient(gameName = 'Clean Game', gridUrl = 'https://art.test/grid.png'): SteamGridDbHttpClient {
  const game: SteamGridDbGame = { id: 7, name: gameName, verified: true };
  const image: SteamGridDbImage = {
    id: 22, score: 10, style: 'alternate', url: gridUrl, thumb: '', tags: [],
    author: { name: '', steam64: '', avatar: '' }, language: 'en', notes: null,
    width: 600, height: 900, upvotes: 0, downvotes: 0,
  };
  return {
    searchGameByName: vi.fn().mockResolvedValue([game]),
    getGridsBySteamAppId: vi.fn().mockResolvedValue([image]),
    getHeroesBySteamAppId: vi.fn().mockResolvedValue([]),
    getLogosBySteamAppId: vi.fn().mockResolvedValue([]),
    getGridsByGameId: vi.fn().mockResolvedValue([image]),
    getHeroesByGameId: vi.fn().mockResolvedValue([]),
  };
}

function createService(steamGridDb: RepackCatalogServiceDependencies['steamGridDb'] = null): RepackCatalogService {
  return new RepackCatalogService({
    repackCatalogRepository: fakeRepository,
    settingsRepository: fakeSettingsRepository,
    providerRegistry: { order: mocks.providerOrder, resolve: mocks.providerResolve, has: () => true, names: () => ['steam'] },
    sourceFactory: mocks.createSource,
    matchThresholds: { acceptThreshold: 85, flagThreshold: 70 },
    regroupGames: mocks.regroupGames,
    artworkService: fakeArtworkService,
    steamGridDb,
  });
}

describe('RepackCatalogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settingsGet.mockImplementation(async (key: string) => key === 'repackCatalogEnabled' ? 'true' : null);
    mocks.settingsSet.mockResolvedValue({});
    mocks.settingsSetMany.mockResolvedValue(0);
    mocks.regroupGames.mockResolvedValue(undefined);
    mocks.findRematchableGames.mockResolvedValue([]);
    mocks.knownUrls.mockResolvedValue(new Set());
    mocks.saveCandidates.mockResolvedValue({});
    mocks.acceptMatch.mockResolvedValue({});
    mocks.getArtworkGame.mockResolvedValue({
      providerName: null, providerRemoteId: null, title: 'Example Game', normalizedTitle: 'example game',
      metadataSnapshot: null, matchCandidates: [],
    });
    vi.mocked(fakeArtworkService.downloadToCacheGeneric).mockResolvedValue('/cache/artwork');
    mocks.getArtworkGame.mockResolvedValue({
      providerName: null, providerRemoteId: null, title: 'Example Game', normalizedTitle: 'example game',
      metadataSnapshot: null, matchCandidates: [],
    });
    vi.mocked(fakeArtworkService.downloadToCacheGeneric).mockResolvedValue('/cache/artwork');
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
    const service = createService();
    const result = await service.sync();
    expect(result.processed).toBe(2);
    expect(mocks.regroupGames).toHaveBeenCalledTimes(1);
    expect(mocks.regroupGames.mock.calls[0][0]('Example Game Repack')).toEqual({
      gameTitle: 'Example Game',
      normalizedTitle: 'example game',
    });
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
    const service = createService();
    await service.sync();
    expect(mocks.createSource.mock.results[0].value.discoverPostUrls).toHaveBeenCalledWith(expect.objectContaining({ fullArchive: false }));
    expect(mocks.settingsSet).not.toHaveBeenCalled();
  });

  it('accepts best candidate at library threshold without a score margin', async () => {
    mocks.providerSearch.mockResolvedValue([
      { providerName: 'steam', remoteId: '1', title: 'Example Game', score: 91 },
      { providerName: 'steam', remoteId: '2', title: 'Example Game Deluxe', score: 90 },
    ]);
    const service = createService();

    await service.sync();

    expect(mocks.acceptMatch).toHaveBeenCalledTimes(1);
    expect(mocks.saveCandidates).not.toHaveBeenCalled();
  });

  it('leaves library-equivalent flagged scores in manual review', async () => {
    mocks.providerSearch.mockResolvedValue([{ providerName: 'steam', remoteId: '1', title: 'Example Game', score: 80 }]);
    const service = createService();

    await service.sync();

    expect(mocks.saveCandidates).toHaveBeenCalledWith('catalog-1', expect.any(Array), 'REVIEW', 80, expect.any(Object));
    expect(mocks.acceptMatch).not.toHaveBeenCalled();
  });

  it('stores provisional provider metadata for flagged matches', async () => {
    mocks.providerSearch.mockResolvedValue([{ providerName: 'steam', remoteId: '1', title: 'Example Game', score: 80 }]);
    const service = createService();

    await service.sync();

    const provisional = mocks.saveCandidates.mock.calls[0][4];
    expect(provisional).toMatchObject({
      remoteId: '1', providerName: 'steam', title: 'Example Game', genres: [],
    });
    expect(provisional?.fetchedAt).toEqual(expect.any(String));
  });

  it('keeps games pending when providers return no candidates', async () => {
    mocks.providerSearch.mockResolvedValue([]);
    const service = createService();

    await service.sync();

    expect(mocks.saveCandidates).toHaveBeenCalledWith('catalog-1', [], 'PENDING', 0, null);
    expect(mocks.acceptMatch).not.toHaveBeenCalled();
  });

  it('uses exact SteamGridDB title to retry provider metadata search', async () => {
    mocks.upsertPost.mockResolvedValue({ game: { id: 'catalog-clean', title: 'Noisy Game', normalizedTitle: 'noisy game', matchStatus: 'PENDING' } });
    mocks.createSource.mockReturnValue({
      name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue(['https://fitgirl.test/noisy/']),
      fetchPost: vi.fn().mockResolvedValue({
        source: 'fitgirl', sourceUrl: 'https://fitgirl.test/noisy/', title: 'Noisy Game', gameTitle: 'Noisy Game',
        normalizedTitle: 'noisy game', tags: [], details: {}, downloadOptions: [], postKind: 'GAME', contentHash: 'noisy',
      }),
    });
    mocks.providerSearch.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { providerName: 'steam', remoteId: '99', title: 'Clean Game', score: 95 },
    ]);
    mocks.providerGetGame.mockResolvedValue({
      remoteId: '99', title: 'Clean Game', developers: [], publishers: [], genres: [],
    });
    const sgdb = steamGridDbClient('Noisy Game');
    const service = createService(sgdb);

    await service.sync();

    expect(mocks.providerSearch).toHaveBeenNthCalledWith(1, 'Noisy Game');
    expect(mocks.providerSearch).toHaveBeenNthCalledWith(2, 'Noisy Game');
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-clean', expect.objectContaining({ remoteId: '99' }), expect.any(Object), expect.any(Array));
  });

  it('reuses fresh provisional metadata instead of refetching provider data', async () => {
    mocks.findRematchableGames.mockResolvedValue([{
      id: 'catalog-review', title: 'Example Game', normalizedTitle: 'example game', posts: [{ title: 'Example Game' }],
    }]);
    mocks.createSource.mockReturnValue({ name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue([]), fetchPost: vi.fn() });
    const snapshot = {
      remoteId: '1', providerName: 'steam', fetchedAt: new Date().toISOString(), title: 'Example Game',
      developers: [], publishers: [], genres: [], coverUrl: 'cached-cover',
    };
    mocks.getArtworkGame.mockResolvedValue({
      providerName: null, providerRemoteId: null, title: 'Example Game', normalizedTitle: 'example game',
      metadataSnapshot: snapshot, matchCandidates: [],
    });
    mocks.providerSearch.mockResolvedValue([{ providerName: 'steam', remoteId: '1', title: 'Example Game', score: 80 }]);
    mocks.providerSearch.mockResolvedValue([{ providerName: 'steam', remoteId: '1', title: 'Example Game', score: 80 }]);
    const service = createService();

    await service.sync();

    expect(mocks.providerGetGame).not.toHaveBeenCalled();
    expect(mocks.saveCandidates).toHaveBeenCalledWith('catalog-review', expect.any(Array), 'REVIEW', 80, snapshot);
  });

  it('replaces a dead Steam cover URL with SteamGridDB artwork', async () => {
    mocks.providerGetGame.mockResolvedValue({
      remoteId: '1', title: 'Example Game', developers: [], publishers: [], genres: [],
      coverUrl: 'https://steam.test/dead.jpg',
    });
    vi.mocked(fakeArtworkService.downloadToCacheGeneric).mockImplementation(async (_provider, _id, _kind, url) =>
      url === 'https://steam.test/dead.jpg' ? null : '/cache/artwork',
    );
    const sgdb = steamGridDbClient();
    const service = createService(sgdb);

    await service.sync();

    expect(mocks.acceptMatch.mock.calls[0][2].coverUrl).toBe('https://art.test/grid.png');
    expect(sgdb.getGridsBySteamAppId).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it('marks below-threshold candidates rejected', async () => {
    mocks.providerSearch.mockResolvedValue([
      { providerName: 'steam', remoteId: '1', title: 'Example Game', score: 50 },
    ]);
    const service = createService();

    await service.sync();

    expect(mocks.saveCandidates).toHaveBeenCalledWith('catalog-1', expect.any(Array), 'REJECTED', 50, null);
  });

  it('retries existing pending matches once at sync start', async () => {
    mocks.findRematchableGames.mockResolvedValue([{ id: 'catalog-existing', title: 'Example Game', normalizedTitle: 'example game' }]);
    mocks.createSource.mockReturnValue({
      name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue([]), fetchPost: vi.fn(),
    });
    const service = createService();

    await service.sync();

    expect(mocks.providerSearch).toHaveBeenCalledTimes(1);
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-existing', expect.any(Object), expect.any(Object), expect.any(Array));
  });

  it('searches using the library-normalized title', async () => {
    mocks.findRematchableGames.mockResolvedValue([{
      id: 'catalog-dragon', title: 'Dragon’s Dogma 2', normalizedTitle: 'dragon s dogma 2',
      posts: [{ title: 'Dragon’s Dogma 2: Deluxe Edition* –' }],
    }]);
    mocks.createSource.mockReturnValue({
      name: 'fitgirl', discoverPostUrls: vi.fn().mockResolvedValue([]), fetchPost: vi.fn(),
    });
    const service = createService();

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
    const service = createService();

    await service.sync();

    expect(mocks.providerSearch).toHaveBeenNthCalledWith(1, 'Bubsy 4D: Digital Pawsome Edition');
    expect(mocks.providerSearch).toHaveBeenNthCalledWith(2, 'Bubsy 4D');
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-bubsy', expect.objectContaining({ remoteId: 'bubsy-base' }), expect.any(Object), expect.any(Array));
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
    const service = createService();

    await service.sync();

    expect(mocks.providerSearch).toHaveBeenCalledTimes(1);
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-bubsy', expect.objectContaining({ remoteId: 'bubsy-edition' }), expect.any(Object), expect.any(Array));
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
    const service = createService();

    await service.sync();

    expect(mocks.providerGetGame).toHaveBeenNthCalledWith(1, '3948100');
    expect(mocks.providerGetGame).toHaveBeenNthCalledWith(2, '360959');
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-towerfolk', expect.objectContaining({
      providerName: 'igdb', remoteId: '360959',
    }), expect.any(Object), expect.any(Array));
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
    const service = createService();

    await service.sync();

    expect(mocks.providerSearch).toHaveBeenNthCalledWith(1, 'Bubsy 4D: Digital Pawsome Edition');
    expect(mocks.providerSearch).toHaveBeenNthCalledWith(2, 'Bubsy 4D');
    expect(mocks.acceptMatch).toHaveBeenCalledWith('catalog-bubsy', expect.objectContaining({ remoteId: 'bubsy-base' }), expect.any(Object), expect.any(Array));
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
    const service = createService();

    await service.sync();

    expect(mocks.saveCandidates).toHaveBeenCalledWith('catalog-bubsy', [
      { providerName: 'steam', remoteId: 'bubsy-base', title: 'Bubsy 4D', releaseYear: undefined, coverUrl: undefined, score: 80 },
    ], 'REVIEW', 80, expect.any(Object));
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
    const service = createService();
    const run = service.sync();
    await started;
    service.cancel();
    await expect(run).resolves.toMatchObject({ cancelled: true });
    expect(service.jobStatus().phase).toBe('cancelled');
  });
});

import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import type { RepackCatalogJob } from '../../modules/repack-catalog/repack-catalog.job.js';
import type { RepackCatalogService, RepackCatalogSettingsUpdate } from '../../modules/repack-catalog/repack-catalog.service.js';
import { artworkService, type ArtworkKind, type ArtworkService } from '../../modules/artwork/artwork.service.js';

const ARTWORK_KINDS: ArtworkKind[] = ['header', 'cover', 'hero', 'logo'];
const SORT_KEYS = ['title-asc', 'title-desc', 'newest', 'oldest'] as const;
const MATCH_STATUSES = ['PENDING', 'MATCHED', 'REVIEW', 'REJECTED'] as const;

function pageOptions(query: Record<string, unknown>) {
  const offset = Number(query.offset ?? 0);
  const limit = Number(query.limit ?? 24);
  if (!Number.isInteger(offset) || offset < 0) throw new ValidationError('offset must be a non-negative integer');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ValidationError('limit must be between 1 and 100');
  return { offset, limit };
}

function parseSettingsUpdate(body: unknown): RepackCatalogSettingsUpdate {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('repack settings payload must be a JSON object');
  }
  const parsed: RepackCatalogSettingsUpdate = {};
  for (const [key, value] of Object.entries(body)) {
    switch (key) {
      case 'enabled':
      case 'auditEnabled':
        if (typeof value !== 'boolean') throw new ValidationError(`${key} must be a boolean`);
        parsed[key] = value;
        break;
      case 'baseUrl':
        if (typeof value !== 'string') throw new ValidationError(`${key} must be a string`);
        parsed.baseUrl = value;
        break;
      case 'intervalHours':
      case 'auditIntervalHours':
        if (typeof value !== 'number' || !Number.isInteger(value)) throw new ValidationError(`${key} must be an integer`);
        parsed[key] = value;
        break;
      default:
        throw new ValidationError(`unknown repack catalog setting: ${key}`);
    }
  }
  return parsed;
}

export function createRepackCatalogController(
  service: RepackCatalogService,
  job: RepackCatalogJob,
  artwork: ArtworkService = artworkService,
) {
  return {
  async list(req: FastifyRequest, _reply: FastifyReply) {
    const query = (req.query ?? {}) as Record<string, unknown>;
    const { offset, limit } = pageOptions(query);
    const search = typeof query.q === 'string' ? query.q.trim() : undefined;
    const sort = typeof query.sort === 'string' && SORT_KEYS.includes(query.sort as typeof SORT_KEYS[number])
      ? query.sort as typeof SORT_KEYS[number]
      : 'title-asc';
    const genres = typeof query.genre === 'string' ? query.genre.split(',').map((value) => value.trim()).filter(Boolean) : [];
    const steamDeck = typeof query.deck === 'string'
      ? query.deck.split(',').filter(Boolean).map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 3)
      : [];
    const matchStatus = typeof query.match === 'string'
      ? query.match.split(',').map((value) => value.toUpperCase()).filter((value): value is typeof MATCH_STATUSES[number] => MATCH_STATUSES.includes(value as typeof MATCH_STATUSES[number]))
      : [];
    return service.list({
      offset, limit, query: search || undefined,
      genres: genres.length ? genres : undefined,
      steamDeck: steamDeck.length ? steamDeck : undefined,
      matchStatus: matchStatus.length ? matchStatus : undefined,
      sort,
    });
  },
  async genres(_req: FastifyRequest, _reply: FastifyReply) { return { genres: await service.genres() }; },
  async settings(_req: FastifyRequest, _reply: FastifyReply) { return service.settings(); },
  async updateSettings(req: FastifyRequest, _reply: FastifyReply) {
    try {
      const update = parseSettingsUpdate(req.body);
      const { before, after } = await service.updateSettings(update);
      await job.onSettingsChanged(before, after);
      return after;
    } catch (error) {
      if (error instanceof ValidationError) throw new AppError(422, error.message, 'VALIDATION_ERROR');
      throw error;
    }
  },
  async status(_req: FastifyRequest, _reply: FastifyReply) { return service.statusSnapshot(); },
  async detail(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const game = await service.getGame(id);
    if (!game) throw new NotFoundError('RepackGame', id);
    return game;
  },
  async artwork(req: FastifyRequest, reply: FastifyReply) {
    const { id, kind } = req.params as { id: string; kind: string };
    if (!ARTWORK_KINDS.includes(kind as ArtworkKind)) throw new ValidationError(`invalid artwork kind: ${kind}`);
    const sources = await service.getArtworkSources(id, kind as ArtworkKind);
    let lastResortUrl: string | undefined;
    const serveSource = async (source: { providerName: string; remoteId: string; url: string; steamAppId?: number }) => {
      if (source.steamAppId) {
        await artwork.downloadToCache(source.steamAppId, kind as ArtworkKind, source.url);
      } else {
        await artwork.downloadToCacheGeneric(source.providerName, source.remoteId, kind as ArtworkKind, source.url);
      }
      const cached = source.steamAppId
        ? await artwork.readWithContentType(source.steamAppId, kind as ArtworkKind)
        : await artwork.readWithContentTypeGeneric(source.providerName, source.remoteId, kind as ArtworkKind);
      if (!cached) return null;
      reply.header('Content-Type', cached.contentType);
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(cached.bytes);
    };
    for (const source of sources) {
      lastResortUrl ??= source.url;
      const response = await serveSource(source);
      if (response) return response;
    }
    const steamGridDbSource = await service.getSteamGridDbArtworkSource(id, kind as ArtworkKind);
    if (steamGridDbSource) {
      lastResortUrl ??= steamGridDbSource.url;
      const response = await serveSource(steamGridDbSource);
      if (response) return response;
    }
    if (!lastResortUrl) throw new NotFoundError('Artwork', `${id}/${kind}`);
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.redirect(lastResortUrl, 302);
  },
  async review(req: FastifyRequest, _reply: FastifyReply) {
    const { offset, limit } = pageOptions((req.query ?? {}) as Record<string, unknown>);
    return service.review({ offset, limit });
  },
  async sync(req: FastifyRequest, _reply: FastifyReply) {
    if (job.isRunning()) throw new ConflictError('repack catalog job already in progress');
    const body = req.body as { fullArchive?: boolean } | null;
    return job.sync(body?.fullArchive === true);
  },
  async audit(_req: FastifyRequest, _reply: FastifyReply) {
    if (job.isRunning()) throw new ConflictError('repack catalog job already in progress');
    return job.audit();
  },
  async searchCandidates(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = req.body as { query?: string } | null;
    return { candidates: await service.searchCandidates(id, body?.query) };
  },
  async previewCandidate(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = req.body as { providerName?: string; remoteId?: string } | null;
    if (!body?.providerName || !body.remoteId) throw new ValidationError('providerName and remoteId are required');
    return service.previewCandidate(id, body.providerName, body.remoteId);
  },
  async resolveMatch(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const body = req.body as { action?: string; providerName?: string; remoteId?: string } | null;
    if (body?.action === 'reject') return service.rejectCandidate(id);
    if (body?.action !== 'accept' || !body.providerName || !body.remoteId) {
      throw new ValidationError('accept requires providerName and remoteId; or action=reject');
    }
    return service.acceptCandidate(id, body.providerName, body.remoteId);
  },
  };
}

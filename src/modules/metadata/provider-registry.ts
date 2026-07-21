import { logger } from '../../logger/index.js';
import type { MetadataProvider } from '../../shared/types.js';
import { steamProvider } from './steam/steam.provider.js';
import { igdbProvider } from './igdb/igdb.provider.js';

export interface ProviderRegistry {
  resolve(name: string): MetadataProvider | null;
  order(): MetadataProvider[];
  has(name: string): boolean;
  names(): string[];
}

export class ProviderRegistryImpl implements ProviderRegistry {
  private readonly byName: Map<string, MetadataProvider>;
  private readonly ordered: MetadataProvider[];

  constructor(providers: MetadataProvider[]) {
    this.ordered = providers;
    this.byName = new Map(providers.map((p) => [p.name, p]));
  }

  resolve(name: string): MetadataProvider | null {
    return this.byName.get(name) ?? null;
  }

  order(): MetadataProvider[] {
    return [...this.ordered];
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  names(): string[] {
    return this.ordered.map((p) => p.name);
  }
}

function buildDefaultRegistry(): ProviderRegistry {
  const providers: MetadataProvider[] = [steamProvider];
  if (igdbProvider !== null) {
    providers.push(igdbProvider);
  } else {
    logger.warn(
      { providers: providers.map((p) => p.name) },
      'igdb provider disabled (missing IGDB_CLIENT_ID / IGDB_CLIENT_SECRET)',
    );
  }
  return new ProviderRegistryImpl(providers);
}

export const providerRegistry: ProviderRegistry = buildDefaultRegistry();

export function createProviderRegistry(providers: MetadataProvider[]): ProviderRegistry {
  return new ProviderRegistryImpl(providers);
}
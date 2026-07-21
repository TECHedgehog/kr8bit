import { describe, it, expect } from 'vitest';
import type { MetadataProvider } from '../src/shared/types.js';
import {
  ProviderRegistryImpl,
  createProviderRegistry,
} from '../src/modules/metadata/provider-registry.js';

function makeProvider(name: string): MetadataProvider {
  return {
    name,
    search: async () => [],
    getGame: async () => null,
  } as unknown as MetadataProvider;
}

describe('ProviderRegistryImpl', () => {
  it('resolves by name in insertion order', () => {
    const steam = makeProvider('steam');
    const igdb = makeProvider('igdb');
    const registry = new ProviderRegistryImpl([steam, igdb]);

    expect(registry.order()).toEqual([steam, igdb]);
    expect(registry.names()).toEqual(['steam', 'igdb']);
  });

  it('resolve returns null for unknown name', () => {
    const registry = new ProviderRegistryImpl([makeProvider('steam')]);
    expect(registry.resolve('nope')).toBeNull();
  });

  it('has reports membership', () => {
    const registry = new ProviderRegistryImpl([makeProvider('steam')]);
    expect(registry.has('steam')).toBe(true);
    expect(registry.has('igdb')).toBe(false);
  });
});

describe('createProviderRegistry factory', () => {
  it('builds a registry with the same shape', () => {
    const registry = createProviderRegistry([makeProvider('steam'), makeProvider('igdb')]);
    expect(registry.names()).toEqual(['steam', 'igdb']);
    expect(registry.has('steam')).toBe(true);
  });
});
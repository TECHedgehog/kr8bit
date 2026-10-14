import type { RepackSource } from '../repack-catalog.types.js';

export class RepackSourceRegistry {
  private readonly sources = new Map<string, (baseUrl: string) => RepackSource>();

  register(name: string, create: (baseUrl: string) => RepackSource): void { this.sources.set(name, create); }
  create(name: string, baseUrl: string): RepackSource | null { return this.sources.get(name)?.(baseUrl) ?? null; }
  names(): string[] { return [...this.sources.keys()]; }
}

export const repackSourceRegistry = new RepackSourceRegistry();

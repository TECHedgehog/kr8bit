import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { fitGirlGameTitle, fitGirlSearchTitle, FitGirlSource, normalizeFitGirlGameTitle, parseFitGirlListing, parseFitGirlPost } from '../src/modules/repack-catalog/sources/fitgirl/fitgirl.source.js';
import { SourceHttpClient } from '../src/modules/repack-catalog/source-http-client.js';

const listingFixture = new URL('./fixtures/fitgirl/listing.html', import.meta.url);
const postFixture = new URL('./fixtures/fitgirl/post.html', import.meta.url);

describe('FitGirl parser', () => {
  it('extracts only game post URLs from listing articles', async () => {
    const listing = await readFile(listingFixture, 'utf8');
    expect(parseFitGirlListing(listing, 'https://fitgirl.test/')).toEqual(['https://fitgirl.test/example-game-repack/']);
  });

  it('extracts selected details, FitGirl tags, and download mirrors', async () => {
    const html = await readFile(postFixture, 'utf8');
    const post = parseFitGirlPost(html, 'https://fitgirl.test/example-game-repack/');
    expect(post?.title).toBe('Example Game Repack');
    expect(post?.details).toMatchObject({ 'Repack Features': 'Lossless repack.', 'Repack Size': '12.4 GB' });
    expect(post?.gameTitle).toBe('Example Game');
    expect(post?.details).toMatchObject({
      'Based on': 'Original release build 123.',
      'Installation': 'Run setup.exe and follow the prompts.',
      'Languages': 'English, French',
      'Size After Install': '31.2 GB',
    });
    expect(post?.tags).toEqual(['Action', 'Open World']);
    expect(post?.downloadOptions.map((item) => item.label)).toEqual(['Mega', 'Pixeldrain']);
  });

  it('normalizes update and DLC posts to their base game title', () => {
    expect(normalizeFitGirlGameTitle('Example Game Update v1.2')).toBe('example game');
    expect(normalizeFitGirlGameTitle('Example Game – DLC Pack 2')).toBe('example game');
    expect(normalizeFitGirlGameTitle('GTA V v1')).toBe('gta v');
    expect(normalizeFitGirlGameTitle('GTA V v2')).toBe('gta v');
    expect(normalizeFitGirlGameTitle('GTA V v2 + 10 DLCs')).toBe('gta v');
  });

  it('uses base titles for display while preserving substantive edition for search', () => {
    expect(fitGirlGameTitle('Dragon’s Dogma 2: Deluxe Edition* –')).toBe('Dragon’s Dogma 2');
    expect(fitGirlGameTitle('Bubsy 4D: Digital Pawsome Edition')).toBe('Bubsy 4D');
    expect(fitGirlSearchTitle('Bubsy 4D: Digital Pawsome Edition')).toBe('Bubsy 4D: Digital Pawsome Edition');
    expect(fitGirlGameTitle('Superhero Simulator + Bonus OST')).toBe('Superhero Simulator');
    expect(fitGirlGameTitle('MechWarrior 5: Mercenaries – Succession Wars Edition, v1.15.398 + 10 DLCs/Bonuses'))
      .toBe('MechWarrior 5: Mercenaries');
    expect(fitGirlGameTitle('LEGO Party! Soundtrack Edition, v1.6.62 + 2 DLCs/Bonuses')).toBe('LEGO Party!');
    expect(fitGirlGameTitle('Invincible VS, Season 2 Patch + 22 DLCs')).toBe('Invincible VS');
  });

  it('strips GOTY edition and DLC-bundle suffixes from repack display titles', () => {
    expect(fitGirlGameTitle('Bloodborne: Game of the Year Edition – v1.09 + DLCs')).toBe('Bloodborne');
    expect(fitGirlGameTitle('Bloodborne: GOTY Edition – v1.09')).toBe('Bloodborne');
    expect(fitGirlGameTitle('ContractVille & All DLCs Bundle')).toBe('ContractVille');
    expect(fitGirlGameTitle('Game A & Game B')).toBe('Game A & Game B');
  });

  it('strips release labels, content tails, and opaque build suffixes', () => {
    expect(fitGirlGameTitle('God of War III – (Recompiled for PC )')).toBe('God of War III');
    expect(fitGirlGameTitle('Towerfolk – (Release)')).toBe('Towerfolk');
    expect(fitGirlGameTitle('Warhammer 40,000: Boltgun 2 – +775')).toBe('Warhammer 40,000: Boltgun 2');
    expect(fitGirlGameTitle('Bubsy 4D: Digital Pawsome Edition, + Content')).toBe('Bubsy 4D');
    expect(fitGirlSearchTitle('Bubsy 4D: Digital Pawsome Edition, + Content'))
      .toBe('Bubsy 4D: Digital Pawsome Edition');
    expect(fitGirlGameTitle('Wild West Supermarket Simulator – .682a'))
      .toBe('Wild West Supermarket Simulator');
  });

  it('decodes numeric entities before normalizing FitGirl titles', async () => {
    const html = (await readFile(postFixture, 'utf8')).replaceAll(
      'Example Game Repack',
      'Heroes&#8217; Vow: Three Kingdoms &#8211; v2.6.1 Repack',
    );
    const post = parseFitGirlPost(html, 'https://fitgirl.test/heroes-vow/');

    expect(post?.title).toBe('Heroes’ Vow: Three Kingdoms – v2.6.1 Repack');
    expect(post?.gameTitle).toBe('Heroes’ Vow: Three Kingdoms');
    expect(post?.normalizedTitle).toBe('heroes vow three kingdoms');
    expect(normalizeFitGirlGameTitle('Heroes&#8217; Vow: Three Kingdoms &#8211; v2.6.1 Repack'))
      .toBe('heroes vow three kingdoms');
  });

  it('discovers recent listing overlap and full archive pagination', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      const html = url.endsWith('/page/2/') ? '<article><h2 class="entry-title"><a href="https://fitgirl.test/second/">Second game repack</a></h2></article>' : await readFile(listingFixture, 'utf8');
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    };
    const client = new SourceHttpClient({ minDelayMs: 0, maxDelayMs: 0, sleep: async () => undefined, fetchImpl });
    const source = new FitGirlSource('https://fitgirl.test/', client);
    const urls = await source.discoverPostUrls({ fullArchive: true });
    expect(urls).toContain('https://fitgirl.test/example-game-repack/');
    expect(urls).toContain('https://fitgirl.test/second/');
    expect(calls).toContain('https://fitgirl.test/page/2/');
  });

  it('discovers archive pages beyond the previous 500-page limit', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      const page = Number(new URL(url).pathname.match(/\/page\/(\d+)\//)?.[1] ?? 1);
      const nextPage = page < 501 ? `<a rel="next" href="https://fitgirl.test/page/${page + 1}/">Older posts</a>` : '';
      return new Response(nextPage, { headers: { 'content-type': 'text/html' } });
    };
    const client = new SourceHttpClient({ minDelayMs: 0, maxDelayMs: 0, sleep: async () => undefined, fetchImpl });
    const source = new FitGirlSource('https://fitgirl.test/', client);

    await expect(source.discoverPostUrls({ fullArchive: true })).resolves.toEqual([]);
    expect(calls).toHaveLength(501);
    expect(calls).toContain('https://fitgirl.test/page/501/');
  });
});

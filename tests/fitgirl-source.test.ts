import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { FitGirlSource, normalizeFitGirlGameTitle, parseFitGirlListing, parseFitGirlPost } from '../src/modules/repack-catalog/sources/fitgirl/fitgirl.source.js';
import { SourceHttpClient } from '../src/modules/repack-catalog/source-http-client.js';

const listingFixture = new URL('./fixtures/fitgirl/listing.html', import.meta.url);
const postFixture = new URL('./fixtures/fitgirl/post.html', import.meta.url);

describe('FitGirl parser', () => {
  it('extracts only game post URLs from listing articles', async () => {
    const listing = await readFile(listingFixture, 'utf8');
    expect(parseFitGirlListing(listing, 'https://fitgirl.test/')).toEqual(['https://fitgirl.test/example-game-repack/']);
  });

  it('extracts named details, visible post text, and download mirrors', async () => {
    const html = await readFile(postFixture, 'utf8');
    const post = parseFitGirlPost(html, 'https://fitgirl.test/example-game-repack/');
    expect(post?.title).toBe('Example Game Repack');
    expect(post?.details).toMatchObject({ 'Repack Features': 'Based on original release; lossless repack.', 'Repack Size': '12.4 GB' });
    expect(post?.contentText).toContain('English, French');
    expect(post?.downloadOptions.map((item) => item.label)).toEqual(['Mega', 'Pixeldrain']);
  });

  it('normalizes update and DLC posts to their base game title', () => {
    expect(normalizeFitGirlGameTitle('Example Game Update v1.2')).toBe('example game');
    expect(normalizeFitGirlGameTitle('Example Game – DLC Pack 2')).toBe('example game');
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
});

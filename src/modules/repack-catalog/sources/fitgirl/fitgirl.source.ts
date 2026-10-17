import { createHash } from 'node:crypto';
import { cleanGameTitle, normalizeForMatch, normalizeGameName } from '../../../../shared/normalize.js';
import { decodeHtmlEntities } from '../../../../shared/html-entities.js';
import type { RepackDownloadOption, RepackPostInput, RepackSource } from '../../repack-catalog.types.js';
import { SourceHttpClient } from '../../source-http-client.js';

const NON_GAME_TITLE = /\b(donation|donate|contact|privacy policy|about us|cookie policy|terms of service)\b/i;
const MAX_ARCHIVE_PAGES = 500;
const RECENT_LISTING_PAGES = 3;
const ARTICLE_PATTERN = /<article\b[^>]*>[\s\S]*?<\/article>/gi;
const TITLE_PATTERN = /<h[1-3]\b[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h[1-3]>/i;
const ANCHOR_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

function visibleText(html: string): string {
  return decodeHtmlEntities(html
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6]|tr|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function extractDetails(text: string): Record<string, string> {
  const labels = [
    'Repack Features', 'Repack Size', 'Size After Install', 'Languages', 'Installation', 'Based on',
  ];
  const details: Record<string, string> = {};
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:?\\s*([^\\n]{2,500})`, 'i'));
    if (match) details[label] = match[1].trim();
  }
  return details;
}

function extractFitGirlTags(html: string): string[] {
  const tagAnchors = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const tags = new Set<string>();
  const addAnchors = (scope: string) => {
    for (const match of scope.matchAll(tagAnchors)) {
      const attributes = match[1];
      const rel = attributes.match(/\brel=["']([^"']+)["']/i)?.[1] ?? '';
      const className = attributes.match(/\bclass=["']([^"']+)["']/i)?.[1] ?? '';
      if (/\btag\b/i.test(rel) || /\b(?:tag-links|tags-links|post-tags|entry-tags|cat-links)\b/i.test(className)) {
        const tag = visibleText(match[2]);
        if (tag) tags.add(tag);
      }
    }
  };
  addAnchors(html);
  const containers = /<(?:div|span|p|footer)\b[^>]*class=["'][^"']*(?:tag-links|tags-links|post-tags|entry-tags|cat-links)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p|footer)>/gi;
  for (const match of html.matchAll(containers)) {
    for (const anchor of match[1].matchAll(tagAnchors)) {
      const tag = visibleText(anchor[2]);
      if (tag) tags.add(tag);
    }
  }
  return [...tags];
}

function parseDownloadOptions(html: string, baseUrl: string): RepackDownloadOption[] {
  const options: RepackDownloadOption[] = [];
  for (const match of html.matchAll(ANCHOR_PATTERN)) {
    let url: URL;
    try { url = new URL(decodeHtmlEntities(match[1]), baseUrl); } catch { continue; }
    if (!['http:', 'https:', 'magnet:'].includes(url.protocol)) continue;
    const label = visibleText(match[2]);
    const linkText = `${label} ${url.hostname} ${url.pathname}`;
    if (!/download|mirror|torrent|magnet|mega|pixeldrain|file\s*host|ddl|multiup|uploadhaven|gofile|1fichier/i.test(linkText)) continue;
    options.push({ label: label || url.hostname, url: url.href });
  }
  return [...new Map(options.map((option) => [option.url, option])).values()];
}

function postKind(title: string): RepackPostInput['postKind'] {
  if (/\bDLC\b/i.test(title)) return 'DLC';
  if (/\b(update|patch|hotfix|build|v\d+(?:\.\d+)*)\b/i.test(title)) return 'UPDATE';
  return 'GAME';
}

export function normalizeFitGirlGameTitle(title: string): string {
  return normalizeForMatch(normalizeGameName(fitGirlGameTitle(title)).query);
}

export function fitGirlGameTitle(title: string): string {
  const baseTitle = decodeHtmlEntities(title)
    .replace(/[\s:–-]+(?:update|patch|hotfix|build)\b.*$/i, '')
    .replace(/[,;:–—-]?\s+(?:season|volume|chapter|episode|act|book|part|round|stage)\s*#?\s*\d+(?:\.\d+)*\b.*$/i, '')
    .replace(/[,;\s:–—-]+v\d+(?:\.\d+)*(?:\s*(?:\+|and)?\s*\d*\s*DLCs?)?.*$/i, '')
    .replace(/\s*(?:\+|and)\s*\d+\s*DLCs?\b.*$/i, '')
    .replace(/\s+\d+\s+DLCs?\b.*$/i, '')
    .replace(/\s+all\s+DLCs?\b.*$/i, '')
    .replace(/[\s:–-]+DLC\b.*$/i, '')
    .replace(/\s+(?:FitGirl\s+)?Repack$/i, '');
  return cleanGameTitle(baseTitle);
}

export function parseFitGirlPost(html: string, pageUrl: string): RepackPostInput | null {
  const article = [...html.matchAll(ARTICLE_PATTERN)].map((match) => match[0]).find((chunk) => TITLE_PATTERN.test(chunk)) ?? html;
  const titleMatch = article.match(TITLE_PATTERN);
  if (!titleMatch) return null;
  const title = visibleText(titleMatch[1]);
  if (!title || NON_GAME_TITLE.test(title)) return null;
  const text = visibleText(article);
  if (!/repack features|repack size|size after install|selective download|fitgirl repack/i.test(text)) return null;

  const urlMatch = [...article.matchAll(ANCHOR_PATTERN)].find((match) => visibleText(match[2]) === title);
  let sourceUrl: string;
  try { sourceUrl = new URL(decodeHtmlEntities(urlMatch?.[1] ?? pageUrl), pageUrl).href.split('#')[0]; }
  catch { return null; }
  const dateValue = article.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1];
  const parsedDate = dateValue ? new Date(dateValue) : undefined;

  return {
    source: 'fitgirl', sourceUrl, title,
    gameTitle: fitGirlGameTitle(title),
    normalizedTitle: normalizeFitGirlGameTitle(title),
    publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined,
    details: extractDetails(text), tags: extractFitGirlTags(article),
    downloadOptions: parseDownloadOptions(article, sourceUrl), postKind: postKind(title),
    contentHash: createHash('sha256').update(text).digest('hex'),
  };
}

export function parseFitGirlListing(html: string, pageUrl: string): string[] {
  const articles = [...html.matchAll(ARTICLE_PATTERN)].map((match) => match[0]);
  const scopes = articles.length ? articles : [html];
  const urls = new Set<string>();
  for (const article of scopes) {
    const titleMatch = article.match(TITLE_PATTERN);
    if (!titleMatch || NON_GAME_TITLE.test(visibleText(titleMatch[1]))) continue;
    const titleAnchor = [...article.matchAll(ANCHOR_PATTERN)].find((match) => visibleText(match[2]) === visibleText(titleMatch[1]));
    if (!titleAnchor) continue;
    try {
      const url = new URL(decodeHtmlEntities(titleAnchor[1]), pageUrl);
      if (url.hostname === new URL(pageUrl).hostname && url.pathname !== '/') urls.add(`${url.origin}${url.pathname}`);
    } catch { /* malformed site link */ }
  }
  return [...urls];
}

function nextPageUrl(html: string, currentUrl: string): string | null {
  const anchor = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].find((match) => {
    const attributes = match[1];
    const rel = attributes.match(/\brel=["']([^"']+)["']/i)?.[1] ?? '';
    const className = attributes.match(/\bclass=["']([^"']+)["']/i)?.[1] ?? '';
    return /next/i.test(rel) || /next|older/i.test(className) || /older posts|next page/i.test(visibleText(match[2]));
  });
  const href = anchor?.[1].match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (!href) return null;
  try {
    const next = new URL(decodeHtmlEntities(href), currentUrl);
    return next.hostname === new URL(currentUrl).hostname ? next.href : null;
  } catch { return null; }
}

export class FitGirlSource implements RepackSource {
  readonly name = 'fitgirl';

  constructor(private readonly baseUrl: string, private readonly client = new SourceHttpClient()) {}

  async discoverPostUrls(options: { fullArchive: boolean; signal?: AbortSignal }): Promise<string[]> {
    const urls = new Set<string>();
    const visited = new Set<string>();
    let current: string | null = this.baseUrl;
    const pageLimit = options.fullArchive ? MAX_ARCHIVE_PAGES : RECENT_LISTING_PAGES;
    for (let page = 0; current && page < pageLimit; page += 1) {
      if (visited.has(current)) break;
      visited.add(current);
      const response = await this.client.get(current, options.signal);
      for (const url of parseFitGirlListing(response.html, current)) urls.add(url);
      current = nextPageUrl(response.html, current);
    }
    if (options.fullArchive && current && !visited.has(current)) {
      throw new Error(`FitGirl archive exceeded ${MAX_ARCHIVE_PAGES} listing pages`);
    }
    return [...urls];
  }

  async fetchPost(url: string, signal?: AbortSignal): Promise<RepackPostInput | null> {
    const response = await this.client.get(url, signal);
    return parseFitGirlPost(response.html, url);
  }
}

export function createFitGirlSource(baseUrl: string): RepackSource {
  return new FitGirlSource(baseUrl);
}

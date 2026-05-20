import { useState } from 'react'
import { useScraperStatus, useRunScraper, useResetScraper } from '../../api/scraper'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function ScraperSection() {
  const { data: scraper, isLoading: scraperLoading } = useScraperStatus()
  const scrapeMut = useRunScraper()
  const resetMut = useResetScraper()
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Game Scraper</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Fetches all game posts from the configured WordPress site via its REST API.
          Imports titles, categories, tags, and download links. Non-game entries are automatically excluded.
        </p>
      </div>

      {scraperLoading ? <LoadingSpinner /> : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-secondary)]">Status: </span>
              <span className={scraper?.is_running ? 'text-yellow-400' : 'text-[var(--green)]'}>
                {scraper?.is_running ? 'Running' : 'Idle'}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Total Games: </span>
              <span>{scraper?.total_games ?? 0}</span>
            </div>
            {scraper?.last_run && (
              <>
                <div>
                  <span className="text-[var(--text-secondary)]">Last Run: </span>
                  <span>{new Date(scraper.last_run).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Last Status: </span>
                  <span>{scraper.last_status}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => scrapeMut.mutate()}
              disabled={scrapeMut.isPending}
              className="px-6 py-2 bg-[var(--accent)] text-black rounded-lg font-medium text-sm hover:opacity-80 disabled:opacity-50 transition-opacity"
            >
              {scrapeMut.isPending ? 'Scraping...' : scraper?.total_games ? 'Full Re-scrape' : 'Start Initial Scrape'}
            </button>

            {scraper?.total_games ? (
              <>
                {!showResetConfirm ? (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="px-4 py-2 text-sm rounded-lg border border-[var(--red)] text-[var(--red)] hover:bg-[var(--red)]/10 transition-colors"
                  >
                    Reset All Data
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--red)]">Are you sure?</span>
                    <button
                      onClick={() => {
                        resetMut.mutate(undefined, {
                          onSettled: () => setShowResetConfirm(false),
                        })
                      }}
                      disabled={resetMut.isPending}
                      className="px-3 py-1.5 text-xs rounded bg-[var(--red)] text-white hover:opacity-80 disabled:opacity-50 transition-opacity"
                    >
                      {resetMut.isPending ? 'Deleting...' : 'Yes, Delete Everything'}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      disabled={resetMut.isPending}
                      className="px-3 py-1.5 text-xs rounded border border-[var(--border)] hover:bg-[var(--border)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-6 text-sm text-[var(--text-secondary)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">How scraping works</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>Scraper fetches game posts from the configured repack site via the WordPress REST API</li>
          <li>Non-game entries (donations, news, updates) are filtered out</li>
          <li>Titles, categories, tags, magnets, torrents, and download mirrors are imported</li>
          <li>After scraping, run <strong className="text-[var(--text-primary)]">Enrichment</strong> to match games with metadata</li>
        </ol>
      </div>
    </div>
  )
}

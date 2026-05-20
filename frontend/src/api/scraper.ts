import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'
import type { ScrapeStatus } from '../types'

export function useScraperStatus() {
  return useQuery<ScrapeStatus>({
    queryKey: ['scraper-status'],
    queryFn: () => api.get('/scraper/status').then(r => r.data),
    refetchInterval: 10000,
  })
}

export function useRunScraper() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/scraper/run'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scraper-status'] })
      qc.invalidateQueries({ queryKey: ['games'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useResetScraper() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/scraper/reset?confirm=true'),
    onSuccess: () => {
      // Optimistically update cache to 0 games immediately
      qc.setQueryData(['scraper-status'], {
        is_running: false,
        last_run: null,
        last_status: null,
        last_pages: null,
        total_games: 0,
      })
      qc.invalidateQueries({ queryKey: ['scraper-status'] })
      qc.invalidateQueries({ queryKey: ['games'] })
      qc.invalidateQueries({ queryKey: ['game'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['enrichment-status'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

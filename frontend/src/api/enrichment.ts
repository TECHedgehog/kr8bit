import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'
import type { EnrichmentStatus } from '../types'

export function useEnrichmentStatus() {
  return useQuery<EnrichmentStatus>({
    queryKey: ['enrichment-status'],
    queryFn: () => api.get('/enrichment/status').then(r => r.data),
    refetchInterval: (query) => query.state.data?.is_running ? 3000 : 10000,
  })
}

export function useRunEnrichment(module?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/enrichment/run', { module }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrichment-status'] })
      qc.invalidateQueries({ queryKey: ['games'] })
    },
  })
}

export function useRunModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (module: string) => api.post(`/enrichment/run/${module}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrichment-status'] })
      qc.invalidateQueries({ queryKey: ['games'] })
    },
  })
}

export function useStopEnrichment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/enrichment/stop'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrichment-status'] })
    },
  })
}

export function useStopModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (module: string) => api.post(`/enrichment/stop/${module}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrichment-status'] })
    },
  })
}

export function useRunSingleEnrichment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ gameId, modules }: { gameId: number; modules?: string[] }) =>
      api.post(`/enrichment/run/${gameId}`, null, { params: modules ? { modules: modules.join(',') } : {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrichment-status'] })
      qc.invalidateQueries({ queryKey: ['games'] })
      qc.invalidateQueries({ queryKey: ['game'] })
    },
  })
}

export function useManualMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { game_id: number; igdb_id?: number; steam_app_id?: number }) =>
      api.post('/enrichment/match', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrichment-status'] })
      qc.invalidateQueries({ queryKey: ['games'] })
      qc.invalidateQueries({ queryKey: ['game'] })
    },
  })
}

export function useIgdbSearch() {
  return useMutation({
    mutationFn: (query: string) =>
      api.get(`/enrichment/igdb/search?q=${encodeURIComponent(query)}`).then(r => r.data),
  })
}

export function useEnrichmentConfig() {
  return useQuery<{
    igdb_configured: boolean
    steam_available: boolean
    steamgrid_configured: boolean
    modules: string[]
    sources: string[]
  }>({
    queryKey: ['enrichment-config'],
    queryFn: () => api.get('/enrichment/config').then(r => r.data),
  })
}
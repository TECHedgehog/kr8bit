import { useQuery } from '@tanstack/react-query'
import api from './client'
import type { GameListResponse, GameDetail, GameSearchResult, Stats } from '../types'


export function useGames(params: Record<string, string | number | undefined>) {
  const clean = Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))
  return useQuery<GameListResponse>({
    queryKey: ['games', clean],
    queryFn: () => api.get('/games', { params: clean }).then(r => r.data),
  })
}

export function useGame(id: number) {
  return useQuery<GameDetail>({
    queryKey: ['game', id],
    queryFn: () => api.get(`/games/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

export function useSearch(q: string) {
  return useQuery<GameSearchResult[]>({
    queryKey: ['search', q],
    queryFn: () => api.get('/search', { params: { q } }).then(r => r.data),
    enabled: q.length >= 2,
  })
}

export function useStats() {
  return useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats').then(r => r.data),
    refetchInterval: 30000,
  })
}

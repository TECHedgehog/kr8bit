import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'
import type { QbitStatus } from '../types'

export function useQbitStatus() {
  return useQuery<QbitStatus>({
    queryKey: ['qbit-status'],
    queryFn: () => api.get('/qbittorrent/status').then(r => r.data),
    refetchInterval: 15000,
  })
}

export function useAddMagnet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { magnet_uri: string; save_path?: string }) =>
      api.post('/qbittorrent/add', null, { params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qbit-status'] })
    },
  })
}

export function useQbitSync() {
  return useQuery({
    queryKey: ['qbit-sync'],
    queryFn: () => api.get('/qbittorrent/sync').then(r => r.data),
    refetchInterval: 30000,
  })
}

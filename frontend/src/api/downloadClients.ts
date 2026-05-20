import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'
import type {
  DownloadClient,
  DownloadClientCreate,
  DownloadClientUpdate,
  DownloadClientTestRequest,
  AggregateDownloadStatus,
} from '../types'

export function useDownloadClients() {
  return useQuery<DownloadClient[]>({
    queryKey: ['download-clients'],
    queryFn: () => api.get('/download-clients').then(r => r.data),
  })
}

export function useAddDownloadClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DownloadClientCreate) =>
      api.post('/download-clients', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['download-clients'] })
      qc.invalidateQueries({ queryKey: ['download-clients-status'] })
    },
  })
}

export function useUpdateDownloadClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DownloadClientUpdate }) =>
      api.put(`/download-clients/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['download-clients'] })
      qc.invalidateQueries({ queryKey: ['download-clients-status'] })
    },
  })
}

export function useDeleteDownloadClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/download-clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['download-clients'] })
      qc.invalidateQueries({ queryKey: ['download-clients-status'] })
    },
  })
}

export function useTestDownloadClient() {
  return useMutation({
    mutationFn: (id: number) =>
      api.post(`/download-clients/${id}/test`).then(r => r.data),
  })
}

export function useTestDownloadClientConnection() {
  return useMutation({
    mutationFn: (data: DownloadClientTestRequest) =>
      api.post('/download-clients/test-connection', data).then(r => r.data),
  })
}

export function useDownloadClientsStatus() {
  return useQuery<AggregateDownloadStatus>({
    queryKey: ['download-clients-status'],
    queryFn: () => api.get('/download-clients/status').then(r => r.data),
    refetchInterval: 15000,
  })
}

export function useAddMagnetToClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      client_id: number
      magnet_uri: string
      save_path?: string
    }) =>
      api
        .post('/download-clients/' + params.client_id + '/add-magnet', null, {
          params: {
            magnet_uri: params.magnet_uri,
            save_path: params.save_path || '',
          },
        })
        .then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['download-clients-status'] })
      qc.invalidateQueries({ queryKey: ['qbit-status'] })
    },
  })
}

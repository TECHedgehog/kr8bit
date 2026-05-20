import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'
import type {
  LocalLibraryEntry,
  LocalLibraryEntryDetail,
  LibraryListResponse,
  LibraryStats,
  FileEntry,
  UserLibraryListResponse,
  DownloadListResponse,
  SmartAddRequest,
} from '../types'

export function useLibrary(params: {
  page?: number
  per_page?: number
  search?: string
  format?: string
  matched?: boolean
  enrichment_status?: string
  available?: boolean
  sort?: string
} = {}) {
  return useQuery<LibraryListResponse>({
    queryKey: ['library', params],
    queryFn: () => api.get('/library', { params }).then(r => r.data),
  })
}

export function useLibraryEntry(id: number) {
  return useQuery<LocalLibraryEntryDetail>({
    queryKey: ['library-entry', id],
    queryFn: () => api.get(`/library/${id}`).then(r => r.data),
    enabled: id > 0,
  })
}

export function useLibraryStats() {
  return useQuery<LibraryStats>({
    queryKey: ['library-stats'],
    queryFn: () => api.get('/library/stats').then(r => r.data),
  })
}

export function useLibraryFiles(entryId: number, subPath: string = '') {
  return useQuery<FileEntry[]>({
    queryKey: ['library-files', entryId, subPath],
    queryFn: () => api.get(`/library/${entryId}/files`, { params: { sub_path: subPath } }).then(r => r.data),
    enabled: entryId > 0,
  })
}

export function useScanLibrary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/library/scan').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library'] })
      qc.invalidateQueries({ queryKey: ['library-stats'] })
      qc.invalidateQueries({ queryKey: ['user-library'] })
    },
  })
}

export function useUpdateLibraryEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LocalLibraryEntry> }) =>
      api.put(`/library/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library'] })
      qc.invalidateQueries({ queryKey: ['library-entry'] })
    },
  })
}

export function useDeleteLibraryEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/library/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library'] })
      qc.invalidateQueries({ queryKey: ['library-stats'] })
      qc.invalidateQueries({ queryKey: ['user-library'] })
    },
  })
}

export function useMoveToLibrary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, target_name }: { id: number; target_name?: string }) =>
      api.post(`/library/${id}/move`, null, { params: { target_name } }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library'] })
      qc.invalidateQueries({ queryKey: ['library-stats'] })
      qc.invalidateQueries({ queryKey: ['user-library'] })
    },
  })
}

// User library
export function useUserLibrary(params: { page?: number; per_page?: number; search?: string } = {}) {
  return useQuery<UserLibraryListResponse>({
    queryKey: ['user-library', params],
    queryFn: () => api.get('/user/library', { params }).then(r => r.data),
  })
}

export function useAddToUserLibrary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (library_entry_id: number) =>
      api.post('/user/library/add', null, { params: { library_entry_id } }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-library'] })
      qc.invalidateQueries({ queryKey: ['library-stats'] })
    },
  })
}

export function useSmartAddFromCatalog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SmartAddRequest) =>
      api.post('/user/library/add-from-catalog', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-library'] })
      qc.invalidateQueries({ queryKey: ['library'] })
      qc.invalidateQueries({ queryKey: ['library-stats'] })
      qc.invalidateQueries({ queryKey: ['downloads'] })
      qc.invalidateQueries({ queryKey: ['games'] })
    },
  })
}

export function useRemoveFromUserLibrary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/user/library/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-library'] })
      qc.invalidateQueries({ queryKey: ['library-stats'] })
    },
  })
}

// Downloads
export function useDownloads() {
  return useQuery<DownloadListResponse>({
    queryKey: ['downloads'],
    queryFn: () => api.get('/downloads').then(r => r.data),
    refetchInterval: 5000,
  })
}

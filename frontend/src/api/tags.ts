import { useQuery } from '@tanstack/react-query'
import api from './client'
import type { Tag } from '../types'

export function useTags(search?: string) {
  return useQuery<Tag[]>({
    queryKey: ['tags', search],
    queryFn: () => api.get('/tags', { params: { search } }).then(r => r.data),
    staleTime: 300000,
  })
}

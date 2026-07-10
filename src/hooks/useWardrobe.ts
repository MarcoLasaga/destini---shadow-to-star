import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { wardrobeApi, type WardrobeFilters, type CreateItemPayload } from '../api/wardrobe.api'
import { useAuth } from '../context/useAuth'

export const WARDROBE_KEY = 'wardrobe'

export function useWardrobeItems(filters: WardrobeFilters = {}) {
  const { isLoggedIn } = useAuth()
  return useQuery({
    queryKey: [WARDROBE_KEY, 'list', filters],
    queryFn: async () => {
      const { data } = await wardrobeApi.getAll(filters)
      return data.data
    },
    enabled: isLoggedIn,
    staleTime: 30_000,
  })
}

export function useWardrobeItem(id: string) {
  const { isLoggedIn } = useAuth()
  return useQuery({
    queryKey: [WARDROBE_KEY, 'item', id],
    queryFn: async () => {
      const { data } = await wardrobeApi.getById(id)
      return data.data
    },
    enabled: isLoggedIn && !!id,
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ payload, image }: { payload: CreateItemPayload; image?: File }) =>
      wardrobeApi.create(payload, image),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [WARDROBE_KEY] }) },
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload, image }: { id: string; payload: Partial<CreateItemPayload>; image?: File }) =>
      wardrobeApi.update(id, payload, image),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY, 'list'] })
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY, 'item', id] })
    },
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => wardrobeApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [WARDROBE_KEY] }) },
  })
}

export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => wardrobeApi.toggleFavorite(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY, 'list'] })
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY, 'item', id] })
    },
  })
}

export function useMarkClean() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => wardrobeApi.markClean(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY, 'list'] })
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY, 'item', id] })
    },
  })
}

export function useRecordWear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => wardrobeApi.recordWear(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY, 'list'] })
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY, 'item', id] })
    },
  })
}

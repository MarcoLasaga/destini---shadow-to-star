export const ENDPOINTS = {
  auth: {
    login:    '/auth/login',
    register: '/auth/register',
    logout:   '/auth/logout',
    me:       '/auth/me',
  },
  wardrobe: {
    items:  '/wardrobe/items',
    item:   (id: string) => `/wardrobe/items/${id}`,
    upload: '/wardrobe/items/upload',
  },
  outfits: {
    generate: '/outfits/generate',
    planner:  '/outfits/planner',
    history:  '/outfits/history',
    saved:    '/outfits/saved',
  },
  community: {
    feed:  '/community/feed',
    share: '/community/share',
    like:  (id: string) => `/community/${id}/like`,
  },
  analytics: {
    dashboard: '/analytics/dashboard',
    gaps:      '/analytics/gaps',
  },
}
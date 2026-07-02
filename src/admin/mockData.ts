// ── IPO monitoring stats ───────────────────────────────────────────────────────
export const INPUT_STATS = [
  { key: 'totalUsers',          label: 'TOTAL USERS',           value: 18, icon: 'users'    },
  { key: 'uploadedClothes',     label: 'UPLOADED CLOTHES',      value: 18, icon: 'shirt'    },
  { key: 'userPreferences',     label: 'USER PREFERENCES SET',  value: 18, icon: 'heart'    },
  { key: 'wardrobeEntries',     label: 'WARDROBE ENTRIES',      value: 18, icon: 'layers'   },
]

export const PROCESS_STATS = [
  { key: 'imageProcessing',     label: 'IMAGE PROCESSING REQUESTS', value: 18, icon: 'camera'  },
  { key: 'classificationResults',label: 'CLASSIFICATION RESULTS',   value: 18, icon: 'tag'     },
  { key: 'contentBasedRuns',    label: 'CONTENT-BASED RUNS',        value: 18, icon: 'cpu'     },
  { key: 'collaborativeRuns',   label: 'COLLABORATIVE RUNS',        value: 18, icon: 'users2'  },
]

export const OUTPUT_STATS = [
  { key: 'generatedOutfits',    label: 'GENERATED OUTFITS',         value: 18,  icon: 'sparkles'   },
  { key: 'savedOutfits',        label: 'SAVED OUTFITS',             value: 18,  icon: 'bookmark'   },
  { key: 'topColor',            label: 'TOP RECOMMENDED COLOR',     value: 'N/A', icon: 'palette'  },
  { key: 'mostUsedCategory',    label: 'MOST USED CATEGORY',        value: 'N/A', icon: 'pie'      },
]

// ── Registered users ──────────────────────────────────────────────────────────
export type UserRole   = 'ADMIN' | 'USER'
export interface AdminUser {
  id:     string
  name:   string
  email:  string
  joined: string
  role:   UserRole
}

export const REGISTERED_USERS: AdminUser[] = [
  { id: '1', name: 'Admin',              email: 'admin@stylesense.com',     joined: 'Jan 12, 2026', role: 'ADMIN' },
  { id: '2', name: 'Marco',              email: 'mamamobenten@gmail.com',   joined: 'Jan 11, 2026', role: 'USER'  },
  { id: '3', name: 'marco',              email: 'marconanaman@gmail.com',   joined: 'Jan 10, 2026', role: 'USER'  },
  { id: '4', name: 'mamamobenten',       email: 'admin@stylesense.com',     joined: 'Jan 09, 2026', role: 'ADMIN' },
  { id: '5', name: 'mlasaga.a12346153',  email: 'admin@stylesense.com',     joined: 'Jan 08, 2026', role: 'ADMIN' },
  { id: '6', name: 'James Carter',       email: 'james.carter@email.com',   joined: 'Jan 07, 2026', role: 'USER'  },
  { id: '7', name: 'Sophia Reyes',       email: 'sophia.reyes@email.com',   joined: 'Jan 06, 2026', role: 'USER'  },
  { id: '8', name: 'Ethan Cruz',         email: 'ethan.cruz@email.com',     joined: 'Jan 05, 2026', role: 'USER'  },
]

// ── Clothing distribution ─────────────────────────────────────────────────────
export interface ClothingSlice { name: string; value: number; color: string }

export const CLOTHING_DISTRIBUTION: ClothingSlice[] = [
  { name: 'Tops',        value: 30, color: '#ffd586' },
  { name: 'Bottoms',     value: 22, color: '#756e9e' },
  { name: 'Dresses',     value: 12, color: '#e8b4b8' },
  { name: 'Jackets',     value: 10, color: '#b8c8b8' },
  { name: 'Shoes',       value: 16, color: '#b8bfc6' },
  { name: 'Accessories', value: 10, color: '#c3b091' },
]

// ── User growth chart (weekly) ─────────────────────────────────────────────────
export const USER_GROWTH = [
  { week: 'W1', users: 2  },
  { week: 'W2', users: 4  },
  { week: 'W3', users: 7  },
  { week: 'W4', users: 10 },
  { week: 'W5', users: 14 },
  { week: 'W6', users: 18 },
]
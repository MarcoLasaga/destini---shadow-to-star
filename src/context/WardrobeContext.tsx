import { createContext, useContext, type ReactNode } from 'react'

// WardrobeContext is intentionally thin now.
// All data lives in TanStack Query via useWardrobeItems / useWardrobeItem hooks.
// This context exists only for backwards-compat with components that imported from here.
// New components should import directly from src/hooks/useWardrobe.ts

interface WardrobeCtx {
  // kept empty — consumers should migrate to useWardrobeItems hook directly
}

const Ctx = createContext<WardrobeCtx>({})

export function WardrobeProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={{}}>{children}</Ctx.Provider>
}

export function useWardrobe() {
  return useContext(Ctx)
}
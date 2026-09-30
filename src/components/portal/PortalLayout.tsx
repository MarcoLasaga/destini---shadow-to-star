import { type ReactNode } from 'react'
import PortalNavbar from './PortalNavbar'

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="portal-shell">
      <PortalNavbar />
      <main>{children}</main>
    </div>
  )
}

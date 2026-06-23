import { type ReactNode } from 'react'
import Navbar from '../navbar/Navbar'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#faf7f2' }}>
      <Navbar />
      <main>{children}</main>
    </div>
  )
}
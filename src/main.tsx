import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WardrobeProvider } from './context/WardrobeContext'
import { SettingsProvider } from './context'
import './index.css'
import App from './App'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <WardrobeProvider>
            <App />
          </WardrobeProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
)
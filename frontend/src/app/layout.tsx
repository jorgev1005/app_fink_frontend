import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import DashboardButton from '@/components/DashboardButton'
import KeyboardShortcuts from '@/components/KeyboardShortcuts'
import QuickActionButton from '@/components/QuickActionButton'
import CalculatorWidget from '@/components/CalculatorWidget'
import dynamic from 'next/dynamic'

const CommandPalette = dynamic(() => import('@/components/CommandPalette'), { ssr: false })

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FINK - Sistema Administrativo',
  description: 'Sistema administrativo multi-proyecto con IA y multi-moneda',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <KeyboardShortcuts />
          <div className="min-h-screen">
            <header className="fixed top-4 right-4 z-50 print:hidden">
               <DashboardButton />
            </header>
            <CommandPalette />
            <main className="pt-6">
              {children}
            </main>
            <div className="print:hidden">
              <QuickActionButton />
              <CalculatorWidget />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}

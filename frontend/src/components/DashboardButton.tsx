"use client"

import Link from 'next/link'
import analytics from '@/lib/analytics'
import { LayoutDashboard } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function DashboardButton() {
  const pathname = usePathname()
  
  if (pathname && pathname.startsWith('/login')) {
    return null;
  }

  return (
    <Link
      href="/dashboard"
      prefetch={true}
      onClick={() => analytics.track('dashboard_click')}
      className="glass-btn glass-btn-primary flex items-center gap-2 shadow-lg shadow-blue-200"
      aria-label="Ir al dashboard"
      title="Ir al dashboard (Ctrl/Cmd+K para paleta)"
    >
      <LayoutDashboard size={18} />
      <span className="text-sm font-medium hidden sm:inline">Dashboard</span>
    </Link>
  )
}

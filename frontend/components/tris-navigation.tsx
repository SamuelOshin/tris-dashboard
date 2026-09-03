'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu,
  X,
  TrendingUp,
  Shield,
  Users,
  Database,
  CheckSquare,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { UserMenu } from './user-menu'

export function TRISNavigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useAuth()

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: TrendingUp,
      description: 'Platform Overview & KPI Ledger',
    },
    {
      name: 'Cases & Fraud',
      href: '/fraud-detection',
      icon: Shield,
      description: 'Anomaly Intelligence & Cases',
    },
    {
      name: 'Suppliers',
      href: '/suppliers',
      icon: Users,
      description: 'Supplier Directory & Baselines',
    },
    {
      name: 'Data Ingestion',
      href: '/ingestion',
      icon: Database,
      description: 'Excel Relational Pipeline',
    },
    {
      name: 'Acceptance Matrix',
      href: '/developer-tests',
      icon: CheckSquare,
      description: 'T01 - T10 Compliance Matrix',
    },
  ]

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl text-primary tracking-tight">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Shield className="w-5 h-5" />
            </div>
            <span>TRIS</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-1">
              v1.3
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>

          {/* User Menu (Desktop) */}
          <div className="hidden md:flex items-center">
            <UserMenu />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-1.5 border-t border-border pt-3 animate-in slide-in-from-top-2 duration-200">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] text-sm rounded-xl transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium leading-tight truncate">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground font-normal truncate mt-0.5">{item.description}</div>
                  </div>
                </Link>
              )
            })}
            <div className="px-1 pt-3 border-t border-border mt-2">
              <UserMenu />
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

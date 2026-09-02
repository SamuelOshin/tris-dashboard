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
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-1.5 border-t border-border pt-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <div>
                      <div>{item.name}</div>
                      <div className="text-[11px] text-muted-foreground font-normal">{item.description}</div>
                    </div>
                  </div>
                </Link>
              )
            })}
            <div className="px-3 pt-3 border-t border-border mt-2">
              <UserMenu />
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, TrendingUp, Shield, Users, FileCheck, Activity, Database, CheckSquare } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { UserMenu } from './user-menu'

export function TRISNavigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user } = useAuth()

  const navigationItems = [
    { 
      name: 'Dashboard', 
      href: '/', 
      icon: TrendingUp,
      description: 'Overview & Risk Scores'
    },
    { 
      name: 'Financial Fraud', 
      href: '/fraud-detection', 
      icon: Shield,
      description: 'Anomaly Detection'
    },
    { 
      name: 'Suppliers', 
      href: '/suppliers', 
      icon: Users,
      description: 'Risk Management'
    },
    { 
      name: 'Zero-Trust', 
      href: '/zero-trust', 
      icon: Activity,
      description: 'Access Monitoring'
    },
    { 
      name: 'Compliance', 
      href: '/compliance', 
      icon: FileCheck,
      description: 'Audit & Reports'
    },
    { 
      name: 'Ingestion', 
      href: '/ingestion', 
      icon: Database,
      description: 'Excel Data Pipeline'
    },
    { 
      name: 'Dev Tests', 
      href: '/developer-tests', 
      icon: CheckSquare,
      description: 'Acceptance Matrix'
    },
  ]

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
            <Shield className="w-6 h-6" />
            <span>TRIS</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navigationItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <div>
                      <div className="font-medium text-foreground">{item.name}</div>
                      <div className="text-xs">{item.description}</div>
                    </div>
                  </div>
                </Link>
              )
            })}
            <div className="px-4 py-2 border-t border-border mt-2">
              <UserMenu />
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp,
  Shield,
  Users,
  FileCheck,
  Activity,
  LogOut,
  BarChart3,
  FileBarChart,
  Settings as SettingsIcon,
} from 'lucide-react'

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar'

import { ThemeToggle } from './theme-toggle'
import { NotificationsPopover } from './notifications-popover'
import { HeaderSearch } from './header-search'

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  description: string
}

// Sectioned navigation for clean grouping
const coreNavigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: TrendingUp,
    description: 'Overview & Risk Scores',
  },
  {
    name: 'Financial Fraud',
    href: '/fraud-detection',
    icon: Shield,
    description: 'Anomaly Detection',
  },
  {
    name: 'Suppliers',
    href: '/suppliers',
    icon: Users,
    description: 'Risk Management',
  },
  {
    name: 'Zero-Trust',
    href: '/zero-trust',
    icon: Activity,
    description: 'Access Monitoring',
  },
]

const intelligenceNavigation = [
  {
    name: 'Compliance',
    href: '/compliance',
    icon: FileCheck,
    description: 'Audit & Reports',
  },
  {
    name: 'Correlation Intelligence',
    href: '/dashboard/correlation',
    icon: BarChart3,
    description: 'Correlation & Pattern Insights',
  },
  {
    name: 'Reports & Compliance',
    href: '/dashboard/reports',
    icon: FileBarChart,
    description: 'Automated Reports & Compliance Files',
  },
]

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TRIS...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        
        {/* Sidebar Header */}
        <SidebarHeader className="border-b border-sidebar-border pb-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary px-2">
            <Shield className="w-5 h-5" />
            <span className="group-data-[collapsible=icon]:hidden">TRIS</span>
          </Link>
        </SidebarHeader>

        {/* Sidebar Content */}
        <SidebarContent>

          {/* CORE MODULES */}
          <SidebarGroup>
            <SidebarGroupLabel className="px-2">CORE MODULES</SidebarGroupLabel>
            <SidebarMenu className="gap-2">
              {coreNavigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <SidebarMenuItem key={item.href} className="mb-1">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`py-3 px-3 rounded-lg transition-all ${
                        isActive ? 'bg-primary/15 text-primary font-semibold shadow-sm' : 'hover:bg-sidebar-accent/50'
                      }`}
                      tooltip={{
                        children: (
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.description}</div>
                          </div>
                        ),
                      }}
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground hidden md:inline">{item.description}</span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>

          {/* SECTION DIVIDER */}
          <div className="border-t border-sidebar-border opacity-60 my-px" />

          {/* GOVERNANCE & INTELLIGENCE */}
          <SidebarGroup>
            <SidebarGroupLabel className="px-2">GOVERNANCE & INTELLIGENCE</SidebarGroupLabel>

            <SidebarMenu className="gap-2">
              {intelligenceNavigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <SidebarMenuItem key={item.href} className="mb-1">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`py-3 px-3 rounded-lg transition-all ${
                        isActive ? 'bg-primary/15 text-primary font-semibold shadow-sm' : 'hover:bg-sidebar-accent/50'
                      }`}
                      tooltip={{
                        children: (
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.description}</div>
                          </div>
                        ),
                      }}
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground hidden md:inline">{item.description}</span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>

        </SidebarContent>

        {/* SIDEBAR FOOTER */}
        <SidebarFooter className="border-t border-sidebar-border pt-4">

          {/* User */}
          <div className="flex items-center justify-between gap-2 px-2 mb-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-accent-foreground">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 hidden group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-sidebar-muted-foreground truncate">{user?.role || 'Guest'}</p>
              </div>
            </div>
          </div>

          {/* Settings */}
          <Link
            href="/dashboard/settings"
            className="w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-sidebar-accent rounded-md transition-colors mb-2"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="group-data-[collapsible=icon]:hidden">Settings</span>
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-sidebar-accent rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="group-data-[collapsible=icon]:hidden">Logout</span>
          </button>

        </SidebarFooter>
      </Sidebar>

      {/* Main Content */}
      <SidebarInset>
        <div className="flex items-center justify-between h-16 px-6 border-b bg-card sticky top-0 z-40">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1">
              <h1 className="text-lg font-semibold">{title}</h1>
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <HeaderSearch />
            <NotificationsPopover />
            <div className="w-px h-6 bg-border" />
            <ThemeToggle />
          </div>
        </div>

        <main>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

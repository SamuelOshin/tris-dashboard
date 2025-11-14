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

// Sectioned navigation
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
    if (!loading && !user) router.push('/login')
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
      <Sidebar collapsible="icon" variant="sidebar" className="overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">

        {/* Sidebar Header */}
        <SidebarHeader className="border-b border-sidebar-border pb-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary px-2">
            <Shield className="w-5 h-5" />
            <span className="group-data-[collapsible=icon]:hidden">TRIS</span>
          </Link>
        </SidebarHeader>

        {/* Sidebar Content with scroll */}
        <SidebarContent className="pr-1">
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[11px] tracking-wider opacity-70">CORE MODULES</SidebarGroupLabel>
            <SidebarMenu className="gap-3">
              {coreNavigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`py-3 rounded-lg transition-all flex items-center gap-3 min-w-0
                        ${isActive ? 'bg-primary/15 text-primary border-l-3 border-primary pl-4 pr-4 ml-1' : 'hover:bg-sidebar-accent/40 px-3'}
                      `}
                    >
                      <Link href={item.href} className="flex items-center gap-3 min-w-0 w-full">
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium text-sm truncate">{item.name}</span>
                          <span className="text-[11px] text-muted-foreground truncate group-data-[collapsible=icon]:hidden">{item.description}</span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>

          {/* Divider */}
          <div className="border-t border-sidebar-border my-2 opacity-40"></div>

          {/* Intelligence Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[11px] tracking-wider opacity-70">GOVERNANCE & INTELLIGENCE</SidebarGroupLabel>
            <SidebarMenu className="gap-3">
              {intelligenceNavigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`py-3 rounded-lg transition-all flex items-center gap-3 min-w-0
                        ${isActive ? 'bg-primary/15 text-primary border-l-2 border-primary pl-[10px] pr-3' : 'hover:bg-sidebar-accent/40 px-3'}
                      `}
                    >
                      <Link href={item.href} className="flex items-center gap-3 min-w-0 w-full">
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium text-sm truncate">{item.name}</span>
                          <span className="text-[11px] text-muted-foreground truncate group-data-[collapsible=icon]:hidden">{item.description}</span>
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
        <SidebarFooter className="border-t border-sidebar-border pt-4 mt-2">

          {/* SETTINGS */}
          <Link
            href="/dashboard/settings"
            className="w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-sidebar-accent rounded-md transition-colors mb-3"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="group-data-[collapsible=icon]:hidden">Settings</span>
          </Link>

          {/* USER + LOGOUT ROW */}
          <div className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-sidebar-accent transition-all">
            {/* User icon */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold uppercase">
                {user?.name?.[0] || 'U'}
              </div>
            </div>

            {/* Logout */}
            <button onClick={handleLogout} className="text-sm flex items-center gap-1 hover:text-primary">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* MAIN CONTENT */}
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

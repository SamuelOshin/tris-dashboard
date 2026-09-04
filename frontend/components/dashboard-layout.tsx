'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp,
  Shield,
  Users,
  LogOut,
  Settings as SettingsIcon,
  Database,
  Activity,
  ShieldAlert,
  ChevronRight,
  Search,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

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
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'

import { ThemeToggle } from './theme-toggle'
import { NotificationsPopover } from './notifications-popover'
import { HeaderSearch } from './header-search'
import { UserNav } from '@/components/user-nav'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  showActions?: boolean
}

const coreNavigation = [
  {
    name: 'Executive Dashboard',
    href: '/',
    icon: TrendingUp,
  },
  {
    name: 'Cases & Fraud',
    href: '/fraud-detection',
    icon: ShieldAlert,
  },
  {
    name: 'Suppliers',
    href: '/suppliers',
    icon: Users,
  },
  {
    name: 'Data Ingestion',
    href: '/ingestion',
    icon: Database,
  },
  {
    name: 'Zero-Trust Access',
    href: '/zero-trust',
    icon: Activity,
  },
]


function DefaultQuickActions() {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
      <Link href="/cases/TEST-CASE-001">
        <Button
          size="sm"
          className="h-8.5 px-3.5 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
          Investigate
        </Button>
      </Link>
      <Link href="/fraud-detection">
        <Button
          variant="outline"
          size="sm"
          className="h-8.5 px-3.5 rounded-xl border-0 bg-card shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:bg-muted/60 text-xs font-medium flex items-center gap-1.5 transition-all"
        >
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          Evaluate Rules
        </Button>
      </Link>
      <Link href="/ingestion">
        <Button
          variant="outline"
          size="sm"
          className="h-8.5 px-3.5 rounded-xl border-0 bg-card shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:bg-muted/60 text-xs font-medium flex items-center gap-1.5 transition-all"
        >
          <Database className="w-3.5 h-3.5 text-muted-foreground" />
          Upload Data
        </Button>
      </Link>
      <Link href="/zero-trust">
        <Button
          variant="outline"
          size="sm"
          className="h-8.5 px-3.5 rounded-xl border-0 bg-card shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:bg-muted/60 text-xs font-medium flex items-center gap-1.5 transition-all"
        >
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          Access Logs
        </Button>
      </Link>
    </div>
  )
}

export function DashboardLayout({
  children,
  title,
  description,
  breadcrumbs,
  actions,
  showActions = true,
}: DashboardLayoutProps) {
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
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  // Compute breadcrumbs if not provided
  const activeNav = coreNavigation.find((n) => n.href === pathname)
  const defaultBreadcrumbs: BreadcrumbItem[] = [
    { label: 'TRIS Studio', href: '/' },
    ...(activeNav && activeNav.href !== '/' ? [{ label: activeNav.name, href: activeNav.href }] : []),
    ...(pathname.startsWith('/cases/') ? [{ label: 'Cases', href: '/fraud-detection' }, { label: pathname.split('/')[2] || 'Case Detail' }] : []),
  ]
  const renderedBreadcrumbs = breadcrumbs || defaultBreadcrumbs

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar" className="border-r border-sidebar-border bg-sidebar">
        {/* Brand Header */}
        <SidebarHeader className="h-14 border-b border-sidebar-border flex items-center px-3">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-foreground hover:opacity-90 transition-opacity min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden min-w-0">
              <span className="text-sm font-bold tracking-tight font-mono truncate">TRIS</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold shrink-0">
                v1.3
              </span>
            </div>
          </Link>
        </SidebarHeader>

        {/* Navigation Content */}
        <SidebarContent className="px-2 py-3 space-y-4">
          {/* Core Modules */}
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
              Core Modules
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              {coreNavigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                      className={`h-9 px-2.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-primary/15 text-primary font-semibold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
                      }`}
                    >
                      <Link href={item.href} className="flex items-center gap-2.5 w-full">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="truncate group-data-[collapsible=icon]:hidden">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>


        </SidebarContent>

        {/* Sidebar Footer */}
        <SidebarFooter className="border-t border-sidebar-border p-2 space-y-1">
          <Link
            href="/dashboard/settings"
            title="Settings & Governance"
            className="flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <SettingsIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Settings & Governance</span>
          </Link>

          {/* User Session Bar */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/50 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5">
            <div className="flex items-center gap-2 min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-mono truncate leading-tight">
                  {user?.role || 'Auditor'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </SidebarFooter>

        {/* Interactive Resize & Collapse Rail */}
        <SidebarRail />
      </Sidebar>

      {/* Main App Inset */}
      <SidebarInset className="bg-background flex flex-col min-h-screen min-w-0 w-full overflow-x-hidden">
        {/* Sticky Command Header with Global Collapse Trigger */}
        <header className="h-14 px-3 sm:px-6 border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Sidebar Collapse/Expand Toggle (Always accessible) */}
            <SidebarTrigger
              title="Toggle Sidebar (Ctrl+B)"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/40 p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0"
            />

            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-1 sm:gap-1.5 text-xs text-muted-foreground min-w-0 overflow-hidden">
              {renderedBreadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-1 sm:gap-1.5 min-w-0 truncate">
                  {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                  {crumb.href && idx < renderedBreadcrumbs.length - 1 ? (
                    <Link href={crumb.href} className="hover:text-foreground truncate transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground truncate">{crumb.label}</span>
                  )}
                </div>
              ))}
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Live System Status */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-success/10 border border-success/20 text-[11px] font-mono text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>All Systems Operational</span>
            </div>

            <HeaderSearch />
            <NotificationsPopover />
            <div className="hidden sm:block w-px h-4 bg-border" />
            <ThemeToggle />
            <div className="hidden sm:block w-px h-4 bg-border" />
            <UserNav />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 min-w-0">
          {title && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 pb-1">
              <div className="min-w-0">
                <p className="text-xs font-mono text-muted-foreground">{todayFormatted}</p>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground mt-0.5 truncate">
                  {title}
                </h1>
                {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
              </div>

              {showActions !== false && (
                <div className="w-full md:w-auto overflow-x-auto pb-1 md:pb-0">{actions !== undefined ? actions : <DefaultQuickActions />}</div>
              )}
            </div>
          )}
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useAuth } from '@/lib/auth-context'
import {
  canViewManufacturing,
  navItemsFor,
} from '@/components/manufacturing/manufacturing-navigation'

/** Sidebar section for the Manufacturing domain, visible per role (Ticket 2 / D7). */
export function ManufacturingNavGroup() {
  const pathname = usePathname()
  const { user } = useAuth()

  if (!canViewManufacturing(user?.role)) return null

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1">
        Manufacturing
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {navItemsFor(user?.role).map((item) => {
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
  )
}

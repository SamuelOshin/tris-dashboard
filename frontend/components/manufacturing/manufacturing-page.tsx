'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth-context'
import {
  canViewManufacturing,
  getManufacturingNavItem,
  type ManufacturingPageId,
} from './manufacturing-navigation'
import { NotImplementedState, PermissionDeniedState } from './not-implemented-state'

export function ManufacturingPage({ pageId }: { pageId: ManufacturingPageId }) {
  const { user } = useAuth()
  const item = getManufacturingNavItem(pageId)
  const allowed = canViewManufacturing(user?.role)

  // Roles without access must not see which section they tried to open.
  return (
    <DashboardLayout
      title={allowed ? item.name : undefined}
      description={allowed ? item.description : undefined}
      showActions={false}
      breadcrumbs={
        allowed
          ? [{ label: 'TRIS Studio', href: '/' }, { label: 'Manufacturing' }, { label: item.name }]
          : [{ label: 'TRIS Studio', href: '/' }, { label: 'Manufacturing' }]
      }
    >
      {allowed ? <NotImplementedState item={item} /> : <PermissionDeniedState />}
    </DashboardLayout>
  )
}

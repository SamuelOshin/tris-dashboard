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

  return (
    <DashboardLayout
      title={item.name}
      description={item.description}
      showActions={false}
      breadcrumbs={[
        { label: 'TRIS Studio', href: '/' },
        { label: 'Manufacturing' },
        { label: item.name },
      ]}
    >
      {canViewManufacturing(user?.role) ? <NotImplementedState item={item} /> : <PermissionDeniedState />}
    </DashboardLayout>
  )
}

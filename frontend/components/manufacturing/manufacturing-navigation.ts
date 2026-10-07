import {
  BookOpen,
  ClipboardCheck,
  Factory,
  FileSpreadsheet,
  LineChart,
  Settings2,
  type LucideIcon,
} from 'lucide-react'

export type ManufacturingPageId =
  | 'material-cost'
  | 'erp-mapping'
  | 'forecasting'
  | 'validation'
  | 'case-studies'
  | 'administration'

export interface ManufacturingNavItem {
  id: ManufacturingPageId
  name: string
  href: string
  icon: LucideIcon
  description: string
  /** Shown only to administrators (configuration and the audit log). */
  adminOnly?: boolean
}

export const MANUFACTURING_NAV_ITEMS: ManufacturingNavItem[] = [
  {
    id: 'material-cost',
    name: 'Material Cost Intelligence',
    href: '/manufacturing/material-cost',
    icon: Factory,
    description: 'Material price trends, deviations and bill-of-materials impact',
  },
  {
    id: 'erp-mapping',
    name: 'ERP/BOM Data Mapping',
    href: '/manufacturing/erp-mapping',
    icon: FileSpreadsheet,
    description: 'Map source ERP and bill-of-materials files to the TRIS data structure',
  },
  {
    id: 'forecasting',
    name: 'Forecasting & Scenarios',
    href: '/manufacturing/forecasting',
    icon: LineChart,
    description: 'Material cost forecasts and what-if scenario analysis',
  },
  {
    id: 'validation',
    name: 'Validation',
    href: '/manufacturing/validation',
    icon: ClipboardCheck,
    description: 'Retrospective checks of forecast and risk-signal accuracy',
  },
  {
    id: 'case-studies',
    name: 'Case Studies / Results',
    href: '/manufacturing/case-studies',
    icon: BookOpen,
    description: 'Documented end-to-end results and findings',
  },
  {
    id: 'administration',
    name: 'Administration',
    href: '/manufacturing/administration',
    icon: Settings2,
    description: 'Forecast models, risk weights, datasets, saved mappings and the audit log',
    adminOnly: true,
  },
]

/** Roles that may see the Manufacturing section (Ticket 2 / D7 role model). */
export const MANUFACTURING_VIEW_ROLES: readonly string[] = [
  'admin',
  'reviewer',
  'read_only_reviewer',
]

export function canViewManufacturing(role: string | undefined | null): boolean {
  return !!role && MANUFACTURING_VIEW_ROLES.includes(role.toLowerCase())
}

/** The pages a role may open: administrators also see the administration page. */
export function navItemsFor(role: string | undefined | null): ManufacturingNavItem[] {
  const isAdmin = !!role && role.toLowerCase() === 'admin'
  return MANUFACTURING_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
}

export function getManufacturingNavItem(id: ManufacturingPageId): ManufacturingNavItem {
  const item = MANUFACTURING_NAV_ITEMS.find((i) => i.id === id)
  if (!item) throw new Error(`Unknown manufacturing page: ${id}`)
  return item
}

import { DashboardLayout } from '@/components/dashboard-layout'

export const metadata = {
  title: 'TRIS Dashboard',
  description: 'Financial fraud and supplier risk monitoring',
}

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

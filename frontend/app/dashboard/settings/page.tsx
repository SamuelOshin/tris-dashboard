'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth-context'

export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <DashboardLayout
      title="Settings"
      description="Configure TRIS preferences and integrations"
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          {/* Account Settings */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" defaultValue={user?.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" defaultValue={user?.email} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" disabled value={user?.role || 'User'} />
                </div>
                <Button>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alert Settings */}
          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Alert Preferences</CardTitle>
                <CardDescription>Configure how and when you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { id: 'fraud', label: 'Fraud Alerts', description: 'High-risk invoice and anomaly detection' },
                  { id: 'supplier', label: 'Supplier Alerts', description: 'Supplier risk changes and compliance issues' },
                  { id: 'access', label: 'Access Alerts', description: 'Suspicious access patterns and violations' },
                  { id: 'compliance', label: 'Compliance Alerts', description: 'Audit and regulatory notifications' },
                ].map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{alert.label}</p>
                      <p className="text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
                <Button>Save Preferences</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Integrations</CardTitle>
                <CardDescription>Manage external system connections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'SAP', status: 'connected' },
                  { name: 'Oracle', status: 'connected' },
                  { name: 'Salesforce', status: 'disconnected' },
                  { name: 'Slack', status: 'disconnected' },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{integration.name}</p>
                      <p className={`text-xs ${integration.status === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        {integration.status === 'connected' ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      {integration.status === 'connected' ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Notification {
  id: string
  title: string
  description: string
  time: string
  type: 'fraud' | 'supplier' | 'access' | 'compliance'
  read: boolean
}

const sampleNotifications: Notification[] = [
  {
    id: '1',
    title: 'High-Risk Invoice Detected',
    description: 'Invoice #INV-2024-8734 from Vendor Corp flagged for anomalous amount',
    time: '5 min ago',
    type: 'fraud',
    read: false,
  },
  {
    id: '2',
    title: 'Supplier Risk Alert',
    description: 'TechSupply Inc. compliance score dropped to 45%',
    time: '15 min ago',
    type: 'supplier',
    read: false,
  },
  {
    id: '3',
    title: 'Unauthorized Access Attempt',
    description: 'Unusual login from new IP detected for admin account',
    time: '2 hours ago',
    type: 'access',
    read: true,
  },
  {
    id: '4',
    title: 'Compliance Report Due',
    description: 'SOX compliance audit trail report ready for review',
    time: '6 hours ago',
    type: 'compliance',
    read: true,
  },
]

const typeColors = {
  fraud: 'bg-red-500/10 text-red-700 dark:text-red-400',
  supplier: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  access: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  compliance: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
}

export function NotificationsPopover() {
  const unreadCount = sampleNotifications.filter(n => !n.read).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-lg">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="border-b p-4">
          <h2 className="font-semibold text-sm">Notifications</h2>
          <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
        </div>
        <ScrollArea className="h-96">
          <div className="divide-y">
            {sampleNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                  !notification.read ? 'bg-muted/30' : ''
                }`}
              >
                <div className="flex gap-3">
                  <div
                    className={`h-2 w-2 rounded-full mt-2 shrink-0 ${
                      !notification.read ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {notification.title}
                      </p>
                      <Badge
                        variant="secondary"
                        className={`text-xs shrink-0 ${typeColors[notification.type]}`}
                      >
                        {notification.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                      {notification.description}
                    </p>
                    <p className="text-xs text-muted-foreground">{notification.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

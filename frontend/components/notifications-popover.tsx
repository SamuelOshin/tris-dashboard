'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { api, Notification } from '@/lib/api'
import { toast } from 'sonner'

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 45) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHour < 24) return `${diffHour}h ago`
    if (diffDay === 1) return 'Yesterday'
    if (diffDay < 7) return `${diffDay}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'Recently'
  }
}

function getSeverityBadge(severity: Notification['severity']) {
  switch (severity) {
    case 'CRITICAL':
      return {
        icon: ShieldAlert,
        badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
        dotClass: 'bg-red-500 ring-4 ring-red-500/20',
      }
    case 'WARNING':
      return {
        icon: AlertTriangle,
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
        dotClass: 'bg-amber-500 ring-4 ring-amber-500/20',
      }
    case 'SUCCESS':
      return {
        icon: CheckCircle2,
        badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        dotClass: 'bg-emerald-500',
      }
    case 'INFO':
    default:
      return {
        icon: Info,
        badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
        dotClass: 'bg-blue-500',
      }
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'CASE_ALERT':
      return 'Case Alert'
    case 'SECURITY_EVENT':
      return 'Security'
    case 'INGESTION_JOB':
      return 'Data Ingestion'
    case 'SYSTEM':
      return 'System'
    default:
      return category.replace(/_/g, ' ')
  }
}

export function NotificationsPopover() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'high_risk'>('all')

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.getUnreadNotificationCount()
      setUnreadCount(res.unread_count || 0)
    } catch {
      // Silently ignore background polling errors
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getNotifications({ limit: 50 })
      setNotifications(data || [])
      const unread = (data || []).filter((n) => !n.is_read).length
      setUnreadCount(unread)
    } catch {
      // Fail gracefully
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30_000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // When popover opens, fetch full notifications list
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      fetchNotifications()
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notification.notification_id ? { ...n, is_read: true } : n
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      try {
        await api.markNotificationRead(notification.notification_id)
      } catch {
        // Revert on error if needed
      }
    }

    if (notification.link_url) {
      setOpen(false)
      router.push(notification.link_url)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return
    setMarkingAll(true)
    try {
      await api.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark notifications as read')
    } finally {
      setMarkingAll(false)
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.is_read
    if (activeTab === 'high_risk') return n.severity === 'CRITICAL' || n.severity === 'WARNING'
    return true
  })

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl h-8.5 w-8.5 hover:bg-muted/80 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-foreground/80" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background animate-in zoom-in-50">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[380px] sm:w-[440px] p-0 shadow-2xl border-border/70 rounded-2xl overflow-hidden backdrop-blur-xl bg-card/95"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
            {unreadCount > 0 ? (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold rounded-full">
                {unreadCount} new
              </Badge>
            ) : (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-full text-muted-foreground">
                All caught up
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markingAll}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 transition-colors"
          >
            {markingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5" />
            )}
            Mark all read
          </Button>
        </div>

        {/* Tab Filters */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'all' | 'unread' | 'high_risk')}
          className="w-full"
        >
          <div className="px-3 pt-2.5 pb-1 border-b border-border/40">
            <TabsList className="grid grid-cols-3 h-7 p-0.5 bg-muted/60 rounded-lg">
              <TabsTrigger value="all" className="text-[11px] h-6 rounded-md font-medium">
                All
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-[11px] h-6 rounded-md font-medium">
                Unread {unreadCount > 0 && `(${unreadCount})`}
              </TabsTrigger>
              <TabsTrigger value="high_risk" className="text-[11px] h-6 rounded-md font-medium">
                High Risk
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="m-0 focus-visible:outline-none">
            <ScrollArea className="h-[360px]">
              {loading && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs">Loading notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-2.5">
                    <Inbox className="w-5 h-5 opacity-70" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    {activeTab === 'unread'
                      ? 'No unread notifications'
                      : activeTab === 'high_risk'
                      ? 'No high-risk alerts'
                      : 'No notifications yet'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[220px]">
                    {activeTab === 'unread'
                      ? 'You are all caught up on pending review items.'
                      : 'Risk alerts, ingestion logs, and assignments will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filteredNotifications.map((notification) => {
                    const sev = getSeverityBadge(notification.severity)
                    const IconComponent = sev.icon

                    return (
                      <div
                        key={notification.notification_id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-3.5 hover:bg-muted/40 cursor-pointer transition-all flex gap-3 relative group ${
                          !notification.is_read ? 'bg-primary/[0.03]' : ''
                        }`}
                      >
                        {/* Unread indicator / Severity Icon */}
                        <div className="shrink-0 mt-0.5 relative">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center border ${sev.badgeClass}`}
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                          </div>
                          {!notification.is_read && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                              {notification.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                              {formatRelativeTime(notification.created_at)}
                            </span>
                          </div>

                          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mb-2">
                            {notification.message}
                          </p>

                          <div className="flex items-center justify-between text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium text-[10px]">
                              {getCategoryLabel(notification.category)}
                            </span>

                            {notification.link_url && (
                              <span className="text-primary flex items-center gap-0.5 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Open <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border/50 bg-muted/10 text-center">
          <p className="text-[10px] text-muted-foreground">
            Risk & compliance alerts update automatically in real time.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

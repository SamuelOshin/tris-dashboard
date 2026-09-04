'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorCardProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorCard({
  title = 'Failed to Load',
  message,
  onRetry,
  className,
}: ErrorCardProps) {
  return (
    <Card
      className={cn(
        'p-6 border-destructive/20 bg-destructive/5 text-center space-y-3',
        className,
      )}
    >
      <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
      <h4 className="font-semibold text-foreground text-sm">{title}</h4>
      <p className="text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mx-auto text-xs">
          <RotateCcw className="w-3.5 h-3.5" />
          Retry Connection
        </Button>
      )}
    </Card>
  )
}

'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CaseError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md text-center space-y-4 p-8 rounded-2xl bg-card border-0 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.35)] dark:bg-[#16181f]">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
        <h1 className="text-lg font-bold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load this case. Please try again.
        </p>
        <Button onClick={retry} className="mx-auto">
          Try Again
        </Button>
      </div>
    </div>
  )
}

'use client'

import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          background: '#0d0e12',
          color: '#e7e7ea',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '26rem',
              textAlign: 'center',
              background: '#16181f',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 10px 35px rgba(0,0,0,0.35)',
            }}
          >
            <AlertTriangle
              style={{ width: 40, height: 40, color: '#ef4444', margin: '0 auto' }}
            />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e7e7ea', marginTop: 16 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={retry}
              style={{
                marginTop: 16,
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#4f46e5',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 16 }}>{error.message}</p>
          </div>
        </div>
      </body>
    </html>
  )
}

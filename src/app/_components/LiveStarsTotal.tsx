'use client'

import { useEffect, useState } from 'react'

const FALLBACK = 1953

export function LiveStarsTotal({ className }: { className?: string }) {
  const [total, setTotal] = useState<number>(FALLBACK)

  useEffect(() => {
    let cancelled = false
    fetch('/api/stars')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data && typeof data.total === 'number') setTotal(data.total)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const display = total >= 1000 ? `${(total / 1000).toFixed(1)}k+` : `${total}+`
  return <span className={className}>{display}</span>
}

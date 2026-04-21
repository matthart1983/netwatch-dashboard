'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SOURCE_KIND } from './source'

export function useRedirectIfLocal() {
  const router = useRouter()
  useEffect(() => {
    if (SOURCE_KIND === 'local') router.replace('/')
  }, [router])
  return SOURCE_KIND === 'local'
}

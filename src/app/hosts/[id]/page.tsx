'use client'

import { use } from 'react'
import { HostView } from '@/app/_components/dashboard/HostView'

export default function HostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <HostView id={id} />
}

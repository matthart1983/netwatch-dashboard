import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { TokenInjector } from '@/lib/token-injector'
import { Nav } from './nav'

export const dynamic = 'force-dynamic'

const sans = Geist({ subsets: ['latin'], variable: '--font-sans' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://netwatchlabs.com'),
  title: {
    default: 'NetWatch Labs',
    template: '%s · NetWatch Labs',
  },
  description: 'Professional-grade network monitoring for Linux fleets. Fast install, real-time health, and alerts without the Datadog sprawl.',
  openGraph: {
    title: 'NetWatch Labs',
    description: 'Professional-grade network monitoring for Linux fleets.',
    type: 'website',
    siteName: 'NetWatch Labs',
    // og:image / twitter:image are provided by app/opengraph-image.tsx (a real
    // 1200×630 PNG). The old /og.svg was ignored by most unfurlers.
  },
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <TokenInjector />
      </head>
      <body className={`${sans.variable} ${mono.variable} font-sans min-h-screen antialiased`}>
        <AuthProvider>
          <Nav />
          <main className="relative mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { IBM_Plex_Mono, Sora } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { TokenInjector } from '@/lib/token-injector'
import { Nav } from './nav'

export const dynamic = 'force-dynamic'

const sans = Sora({ subsets: ['latin'], variable: '--font-sans' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://netwatchlabs.com'),
  title: {
    default: 'NetWatch Cloud',
    template: '%s · NetWatch Cloud',
  },
  description: 'Professional-grade network monitoring for Linux fleets. Fast install, real-time health, and alerts without the Datadog sprawl.',
  openGraph: {
    title: 'NetWatch Cloud',
    description: 'Professional-grade network monitoring for Linux fleets.',
    images: ['/og.svg'],
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

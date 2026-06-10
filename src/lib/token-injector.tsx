import 'server-only'
import Script from 'next/script'
import { getConfig } from './config'

const SOURCE_KIND = process.env.NEXT_PUBLIC_NETWATCH_SOURCE === 'core' ? 'core' : 'local'

export function TokenInjector() {
  if (SOURCE_KIND !== 'local') return null
  const token = getConfig().apiKey
  return (
    <Script id="nw-token-injector" strategy="beforeInteractive">
      {`window.__NETWATCH_TOKEN__=${JSON.stringify(token)};`}
    </Script>
  )
}

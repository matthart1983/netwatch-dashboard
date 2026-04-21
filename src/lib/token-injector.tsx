import 'server-only'
import { getConfig } from './config'

const SOURCE_KIND = process.env.NEXT_PUBLIC_NETWATCH_SOURCE === 'core' ? 'core' : 'local'

export function TokenInjector() {
  if (SOURCE_KIND !== 'local') return null
  const token = getConfig().apiKey
  const script = `window.__NETWATCH_TOKEN__=${JSON.stringify(token)};`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}

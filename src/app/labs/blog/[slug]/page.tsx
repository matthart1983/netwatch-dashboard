import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { posts, getPost, formatDate } from '@/lib/posts'

export async function generateStaticParams() {
  return posts.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.excerpt,
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const otherPosts = posts.filter(p => p.slug !== slug)

  return (
    <div className="-mx-4 -mt-8 sm:-mx-6 lg:-mx-8">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/6 bg-[#08111a]/78 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(61,214,198,0.25)] bg-[rgba(61,214,198,0.12)] text-xs font-bold text-[var(--nw-text)]">
                NW
              </div>
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <Link href="/labs" className="nw-kicker py-1 text-[0.65rem]">Labs</Link>
            <div className="hidden h-4 w-px bg-white/10 sm:block" />
            <span className="hidden max-w-[200px] truncate text-sm nw-subtle sm:block">
              {post.title}
            </span>
          </div>
          <Link href="/labs" className="text-sm nw-muted hover:text-[var(--nw-text)] transition-colors">
            ← Writing
          </Link>
        </div>
      </nav>

      {/* Article */}
      <article className="mx-auto max-w-[720px] px-4 py-14 sm:px-6 lg:px-8">
        {/* Meta */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs nw-subtle">{formatDate(post.date)}</span>
          <span className="text-white/10">·</span>
          <span className="text-xs nw-subtle">{post.readTime}</span>
          <span className="text-white/10">·</span>
          {post.tags.map(tag => (
            <span
              key={tag}
              className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[0.68rem] nw-subtle"
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="mb-8 text-4xl font-semibold leading-[1.1] tracking-[-0.045em] text-[var(--nw-text)] sm:text-5xl">
          {post.title}
        </h1>

        {/* Content */}
        <div
          className="nw-prose"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Author */}
        <div className="mt-14 flex items-center gap-4 border-t border-white/6 pt-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
            M
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--nw-text)]">Matt Hartley</div>
            <div className="text-xs nw-subtle">Building NetWatch Labs</div>
          </div>
        </div>
      </article>

      {/* More writing */}
      {otherPosts.length > 0 && (
        <section className="mx-auto max-w-[720px] border-t border-white/6 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] nw-subtle">
            More writing
          </div>
          <div className="space-y-3">
            {otherPosts.map(p => (
              <Link
                key={p.slug}
                href={`/labs/blog/${p.slug}`}
                className="nw-card-hover group flex items-start gap-4 rounded-[1.2rem] p-5"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--nw-text)] group-hover:text-[var(--nw-accent)] transition-colors">
                    {p.title}
                  </div>
                  <div className="mt-1 text-sm nw-subtle">{p.readTime} · {formatDate(p.date)}</div>
                </div>
                <span className="shrink-0 nw-subtle group-hover:text-[var(--nw-accent)] transition-colors">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/6 px-4 py-8 text-center">
        <div className="mx-auto flex max-w-[720px] flex-col items-center gap-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <div className="text-xs nw-subtle">NetWatch Labs</div>
          <div className="flex items-center gap-5 text-xs nw-subtle">
            <Link href="/labs" className="hover:text-[var(--nw-text)] transition-colors">← All posts</Link>
            <Link href="/" className="hover:text-[var(--nw-text)] transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

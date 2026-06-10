'use client'

import { useEffect, useRef, useState } from 'react'

export function useInView<T extends HTMLElement = HTMLDivElement>(
  opts: { rootMargin?: string; threshold?: number } = {},
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (!ref.current || seen) return
    const el = ref.current
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight
    if (r.top < vh && r.bottom > 0) {
      const raf = requestAnimationFrame(() => setSeen(true))
      return () => cancelAnimationFrame(raf)
    }
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true)
            io.disconnect()
            break
          }
        }
      },
      { rootMargin: opts.rootMargin ?? '0px', threshold: opts.threshold ?? 0.01 },
    )
    io.observe(el)
    const fallback = window.setTimeout(() => setSeen(true), 4000)
    return () => {
      io.disconnect()
      window.clearTimeout(fallback)
    }
  }, [seen, opts.rootMargin, opts.threshold])
  return [ref, seen]
}

export function useCountUp(
  target: number,
  { active, durationMs = 1400, format = (n: number) => String(Math.round(n)) }:
    { active: boolean; durationMs?: number; format?: (n: number) => string },
): string {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf: number
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(target * e)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, durationMs])
  return format(val)
}

export function useTypewriter(
  text: string,
  { speed = 50, startDelay = 0, loop = false, pauseAfter = 1500 }:
    { speed?: number; startDelay?: number; loop?: boolean; pauseAfter?: number } = {},
): string {
  const [i, setI] = useState(0)
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    let cancelled = false
    let timer = 0
    const start = window.setTimeout(function tick() {
      if (cancelled) return
      if (i < text.length) {
        setI(j => Math.min(j + 1, text.length))
        timer = window.setTimeout(tick, speed)
      } else if (loop) {
        timer = window.setTimeout(() => {
          if (cancelled) return
          setI(0)
          setPulse(p => p + 1)
          tick()
        }, pauseAfter)
      }
    }, startDelay)
    return () => {
      cancelled = true
      window.clearTimeout(start)
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, pulse])
  return text.slice(0, i)
}

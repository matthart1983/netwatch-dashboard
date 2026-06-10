// The NetWatch "pulse" logo — shared so the homepage, the app nav, and any
// other surface render the exact same mark.
export function PulseLogo({ size = 28, accent, fg }: { size?: number; accent: string; fg: string }) {
  const s = size
  const path = `M ${s * 0.05} ${s * 0.5} L ${s * 0.30} ${s * 0.5} L ${s * 0.36} ${s * 0.42} L ${s * 0.42} ${s * 0.5} L ${s * 0.48} ${s * 0.18} L ${s * 0.54} ${s * 0.82} L ${s * 0.60} ${s * 0.5} L ${s * 0.66} ${s * 0.5} L ${s * 0.72} ${s * 0.36} L ${s * 0.78} ${s * 0.5} L ${s * 0.95} ${s * 0.5}`
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }} aria-hidden>
      <rect x={s * 0.04} y={s * 0.04} width={s * 0.92} height={s * 0.92} rx={s * 0.18} fill="none" stroke={fg} strokeWidth={s * 0.04} />
      <path d={path} fill="none" stroke={accent} strokeWidth={s * 0.05} strokeLinecap="square" strokeLinejoin="miter" />
      <path d={path} fill="none" stroke={accent} strokeWidth={s * 0.05} strokeLinecap="square" opacity="0.5">
        <animate attributeName="stroke-dasharray" values={`0,${s * 4};${s * 2},${s * 2};${s * 4},0`} dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite" />
      </path>
    </svg>
  )
}

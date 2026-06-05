export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin text-gold">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="none"
        strokeDasharray="31" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  )
}

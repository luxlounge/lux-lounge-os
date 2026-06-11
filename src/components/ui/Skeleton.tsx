interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: string
}

export function Skeleton({ className = '', width, height, rounded = '8px' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: rounded }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton width={32} height={32} rounded="8px" />
        <Skeleton width={120} height={14} />
      </div>
      <Skeleton height={28} width={80} />
      <Skeleton height={12} width={100} />
    </div>
  )
}

export function SkeletonMesa() {
  return (
    <div className="mesa-card mesa-disponivel opacity-50">
      <Skeleton height={24} width={40} rounded="6px" />
      <Skeleton height={12} width={60} rounded="4px" />
    </div>
  )
}

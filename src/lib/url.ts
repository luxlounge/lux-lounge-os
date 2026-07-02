export function getAppOrigin(): string {
  const env = (import.meta.env.VITE_APP_URL as string | undefined)?.trim()
  if (env) return env.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function buildSessionUrl(sessionToken: string): string {
  return `${getAppOrigin()}/q/${sessionToken}`
}

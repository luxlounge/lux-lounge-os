export type SoundType = 'order' | 'request' | 'ready'

const SOUNDS: Record<SoundType, { freq: number; duration: number; gain: number }> = {
  order:   { freq: 880,  duration: 0.4, gain: 0.30 },
  request: { freq: 660,  duration: 0.35, gain: 0.25 },
  ready:   { freq: 1100, duration: 0.5, gain: 0.35 },
}

export function playSound(type: SoundType) {
  try {
    const ctx = new AudioContext()
    const { freq, duration, gain: gainVal } = SOUNDS[type]
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    gain.gain.setValueAtTime(gainVal, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
    setTimeout(() => ctx.close(), duration * 1000 + 200)
  } catch { /* AudioContext not available */ }
}

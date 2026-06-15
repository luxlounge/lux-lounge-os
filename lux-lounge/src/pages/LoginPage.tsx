import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../lib/auth'
import { Spinner } from '../components/ui/Spinner'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 mb-5">
            <span className="w-2.5 h-2.5 rounded-full bg-gold pulse-dot" />
          </div>
          <h1 className="font-display font-extrabold text-white text-3xl tracking-tight">Lux Lounge</h1>
          <p className="text-[11px] text-[#333] mt-1.5 tracking-widest uppercase">Gestão Operacional</p>
        </div>

        <div className="bg-ink-card border border-ink-border rounded-3xl p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="seu@email.com" required autoComplete="email" />
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-10" placeholder="••••••••" required autoComplete="current-password" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#333] hover:text-[#666] transition">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            <button type="submit" className="btn-primary w-full py-3.5 text-base mt-1" disabled={loading}>
              {loading ? <Spinner size={18} /> : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#222] text-xs mt-6">Lux Lounge OS · v1.0</p>
      </div>
    </div>
  )
}

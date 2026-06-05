import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LayoutGrid, ClipboardList, ShoppingBag, Package, Settings, LogOut, Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/mesas', icon: LayoutGrid, label: 'Mesas' },
  { to: '/pedidos', icon: ClipboardList, label: 'Pedidos' },
  { to: '/produtos', icon: ShoppingBag, label: 'Produtos' },
  { to: '/estoque', icon: Package, label: 'Estoque' },
  { to: '/config', icon: Settings, label: 'Config' },
]

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const filtered = navItems.filter(item => {
    if (profile?.role === 'operador' && ['/estoque', '/config'].includes(item.to)) return false
    return true
  })

  const isActive = (to: string) => location.pathname === to || (to !== '/' && location.pathname.startsWith(to))

  return (
    <div className="flex h-screen overflow-hidden bg-ink">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-[#0A0A0A] border-r border-ink-border shrink-0">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-ink-border">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-gold pulse-dot" />
            <span className="font-display font-extrabold text-white text-base tracking-tight">Lux Lounge</span>
          </div>
          <p className="text-[10px] text-[#2E2E2E] uppercase tracking-[0.2em] mt-1.5 pl-4">OS v1.0</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {filtered.map(({ to, icon: Icon, label }) => {
            const active = isActive(to)
            return (
              <Link key={to} to={to}
                className={[
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-gold/10 text-gold border border-gold/20'
                    : 'text-[#444] hover:text-[#888] hover:bg-ink-raised',
                ].join(' ')}>
                <Icon size={15} className="shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-ink-border">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold text-xs font-bold">
              {profile?.nome?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{profile?.nome}</p>
              <p className="text-[#333] text-[10px] capitalize">{profile?.role}</p>
            </div>
          </div>
          <button onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[#333] hover:text-[#666] hover:bg-ink-raised text-sm transition">
            <LogOut size={13} /> Sair
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0A0A0A] border-b border-ink-border flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gold pulse-dot" />
          <span className="font-display font-extrabold text-white text-base">Lux Lounge</span>
        </div>
        <button onClick={() => setDrawerOpen(v => !v)} className="w-8 h-8 flex items-center justify-center text-[#555] hover:text-white transition">
          {drawerOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="absolute left-0 top-0 h-full w-64 bg-[#0A0A0A] border-r border-ink-border flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="h-14 border-b border-ink-border" />
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {filtered.map(({ to, icon: Icon, label }) => {
                const active = isActive(to)
                return (
                  <Link key={to} to={to} onClick={() => setDrawerOpen(false)}
                    className={[
                      'flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-medium transition-all',
                      active ? 'bg-gold/10 text-gold border border-gold/20' : 'text-[#444] hover:text-[#888]',
                    ].join(' ')}>
                    <Icon size={15} /> {label}
                  </Link>
                )
              })}
            </nav>
            <div className="p-3 border-t border-ink-border">
              <button onClick={logout} className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-[#333] hover:text-[#666] text-sm">
                <LogOut size={13} /> Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A] border-t border-ink-border flex">
        {filtered.slice(0, 5).map(({ to, icon: Icon, label }) => {
          const active = isActive(to)
          return (
            <Link key={to} to={to}
              className={`flex-1 flex flex-col items-center py-2.5 text-[10px] font-semibold transition
                ${active ? 'text-gold' : 'text-[#333] hover:text-[#555]'}`}>
              <Icon size={19} className="mb-0.5" />
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

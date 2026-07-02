import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, LayoutGrid, ClipboardList,
  ShoppingBag, Package, Settings, LogOut,
  Menu, X, Sun, Moon, Landmark, Users, BookOpen, ChefHat, BarChart2, BellRing,
} from 'lucide-react'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'
import { NotificationBell } from './ui/NotificationBell'
import { useToast } from './ui/Toast'
import { playSound } from '../lib/sound'

const navItems = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard', roles: [] },
  { to: '/mesas',    icon: LayoutGrid,      label: 'Mesas',     roles: [] },
  { to: '/caixa',    icon: Landmark,        label: 'Caixa',     roles: ['admin', 'caixa'] },
  { to: '/pedidos',   icon: ClipboardList,   label: 'Pedidos',   roles: [] },
  { to: '/producao',     icon: ChefHat,     label: 'Produção',     roles: [] },
  { to: '/solicitacoes', icon: BellRing,    label: 'Solicitações', roles: [] },
  { to: '/produtos', icon: ShoppingBag,     label: 'Produtos',  roles: [] },
  { to: '/estoque',  icon: Package,         label: 'Estoque',   roles: ['admin', 'caixa'] },
  { to: '/clientes', icon: Users,           label: 'Clientes',  roles: [] },
  { to: '/crm',      icon: BarChart2,       label: 'CRM',       roles: ['admin', 'caixa'] },
  { to: '/config',   icon: Settings,        label: 'Config',    roles: ['admin'] },
  { to: '/guia',     icon: BookOpen,        label: 'Guia',      roles: [] },
]

export function Layout({ children }: { children: ReactNode }) {
  const location    = useLocation()
  const navigate    = useNavigate()
  const { profile } = useAuth()
  const { theme, toggle } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingSolicCount, setPendingSolicCount] = useState(0)
  const { warning: toastWarning } = useToast()
  const soundReadyRef = useRef(false)

  useEffect(() => {
    // Load initial pending count
    supabase
      .from('mesa_solicitacoes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .then(({ count }) => { setPendingSolicCount(count ?? 0) })

    const ch = supabase
      .channel('layout-solicitacoes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mesa_solicitacoes' }, payload => {
        setPendingSolicCount(n => n + 1)
        if (soundReadyRef.current) {
          playSound('request')
          toastWarning(`Nova solicitação — Mesa ${(payload.new as any).mesa_numero ?? ''}`)
        }
        soundReadyRef.current = true
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mesa_solicitacoes' }, payload => {
        const updated = payload.new as any
        if (updated.status === 'atendido') {
          setPendingSolicCount(n => Math.max(0, n - 1))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [toastWarning])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const filtered = navItems.filter(item =>
    item.roles.length === 0 || item.roles.includes(profile?.role ?? '')
  )

  const isActive = (to: string) =>
    location.pathname === to || (to !== '/' && location.pathname.startsWith(to))

  const initials = profile?.nome?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── Desktop Sidebar ── */}
      <aside className="sidebar hidden md:flex flex-col w-[220px] shrink-0">
        <div className="px-4 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: 'var(--gold)' }} />
              <span className="font-bold text-[15px] tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Lux Lounge
              </span>
            </div>
            <NotificationBell />
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] mt-1.5 pl-4" style={{ color: 'var(--text-muted)' }}>
            OS v2.0
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {filtered.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className={`sidebar-item ${isActive(to) ? 'active' : ''}`}>
              <Icon size={15} className="shrink-0" />
              {label}
              {to === '/solicitacoes' && pendingSolicCount > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--red, #ef4444)', color: '#fff', minWidth: 18, textAlign: 'center' }}>
                  {pendingSolicCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={toggle}
            className="sidebar-item w-full mb-2"
            style={{ width: '100%' }}>
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>

          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {profile?.nome}
              </p>
              <p className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>
                {profile?.role}
              </p>
            </div>
          </div>
          <button onClick={logout} className="sidebar-item w-full">
            <LogOut size={13} /> Sair
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--bg-topbar)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--gold)' }} />
          <span className="font-bold text-[15px]" style={{ color: 'var(--text-primary)' }}>Lux Lounge</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={toggle} className="theme-toggle">
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <button onClick={() => setDrawerOpen(v => !v)} className="theme-toggle">
            {drawerOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div className="absolute left-0 top-0 h-full w-64 sidebar flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="h-14" style={{ borderBottom: '1px solid var(--border-subtle)' }} />
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {filtered.map(({ to, icon: Icon, label }) => (
                <Link key={to} to={to} onClick={() => setDrawerOpen(false)}
                  className={`sidebar-item ${isActive(to) ? 'active' : ''}`}>
                  <Icon size={15} /> {label}
                  {to === '/solicitacoes' && pendingSolicCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--red, #ef4444)', color: '#fff', minWidth: 18, textAlign: 'center' }}>
                      {pendingSolicCount}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={logout} className="sidebar-item w-full">
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex"
        style={{ background: 'var(--bg-topbar)', borderTop: '1px solid var(--border-subtle)' }}>
        {filtered.map(({ to, icon: Icon, label }) => {
          const active = isActive(to)
          return (
            <Link key={to} to={to}
              className="flex-1 flex flex-col items-center py-2.5 text-[10px] font-semibold transition relative"
              style={{ color: active ? 'var(--gold)' : 'var(--text-muted)' }}>
              <div className="relative">
                <Icon size={19} className="mb-0.5" />
                {to === '/solicitacoes' && pendingSolicCount > 0 && (
                  <span className="absolute -top-1 -right-2 text-[9px] font-bold px-1 rounded-full"
                    style={{ background: 'var(--red, #ef4444)', color: '#fff', lineHeight: '14px', minWidth: 14, textAlign: 'center' }}>
                    {pendingSolicCount}
                  </span>
                )}
              </div>
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

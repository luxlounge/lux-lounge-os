import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { Plus, Users, LayoutGrid, Lock } from 'lucide-react'
import type { Profile, Mesa } from '../types'
import type { UserRole } from '../types'

const ROLE_LABELS: Record<UserRole, string> = { admin: 'Admin', caixa: 'Caixa', operador: 'Operador' }
const ROLE_COLORS: Record<UserRole, { bg: string; color: string; border: string }> = {
  admin:    { bg: 'var(--red-bg)',   color: 'var(--red)',   border: 'var(--red-border)' },
  caixa:    { bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-border)' },
  operador: { bg: 'var(--blue-bg)',  color: 'var(--blue)',  border: 'var(--blue-border)' },
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  disponivel: { bg: 'var(--green-bg)',  color: 'var(--green)',  border: 'var(--green-border)' },
  ocupada:    { bg: 'var(--amber-bg)',  color: 'var(--amber)',  border: 'var(--amber-border)' },
  reservada:  { bg: 'var(--blue-bg)',   color: 'var(--blue)',   border: 'var(--blue-border)' },
  manutencao: { bg: 'var(--red-bg)',    color: 'var(--red)',    border: 'var(--red-border)' },
}

export default function ConfigPage() {
  const { profile } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [userModal, setUserModal] = useState(false)
  const [mesaModal, setMesaModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', password: '', nome: '', role: 'operador' as UserRole })
  const [mesaForm, setMesaForm] = useState({ numero: '' })
  const [tab, setTab] = useState<'users' | 'tables'>('users')

  async function load() {
    const [{ data: ps }, { data: ms }] = await Promise.all([
      supabase.from('profiles').select('*').order('nome'),
      supabase.from('mesas').select('*').order('numero'),
    ])
    setProfiles(ps ?? [])
    setMesas(ms ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createUser() {
    setSaving(true)
    const { data, error } = await supabase.auth.admin.createUser({
      email: userForm.email, password: userForm.password, email_confirm: true,
    })
    if (error) { alert(error.message); setSaving(false); return }
    await supabase.from('profiles').insert({ id: data.user.id, nome: userForm.nome, role: userForm.role })
    setSaving(false)
    setUserModal(false)
    setUserForm({ email: '', password: '', nome: '', role: 'operador' })
    load()
  }

  async function addMesa() {
    setSaving(true)
    await supabase.from('mesas').insert({ numero: parseInt(mesaForm.numero) })
    setSaving(false)
    setMesaModal(false)
    setMesaForm({ numero: '' })
    load()
  }

  if (profile?.role !== 'admin') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
      style={{ background: 'var(--bg-base)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <Lock size={22} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Acesso Restrito</p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Apenas administradores podem acessar as configurações.</p>
    </div>
  )

  if (loading) return (
    <div className="flex justify-center items-center h-screen" style={{ background: 'var(--bg-base)' }}>
      <Spinner size={32} />
    </div>
  )

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Configurações</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {tab === 'users' ? `${profiles.length} usuários` : `${mesas.length} mesas`}
            </p>
          </div>
          {tab === 'users' ? (
            <button onClick={() => setUserModal(true)} className="btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
              <Plus size={14} /> Usuário
            </button>
          ) : (
            <button onClick={() => setMesaModal(true)} className="btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
              <Plus size={14} /> Mesa
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5">
          {([
            { key: 'users',  icon: Users,       label: 'Usuários' },
            { key: 'tables', icon: LayoutGrid,   label: 'Mesas' },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 150ms',
                background: tab === key ? 'var(--gold)' : 'var(--bg-raised)',
                color: tab === key ? '#000' : 'var(--text-muted)',
                border: `1px solid ${tab === key ? 'var(--gold)' : 'var(--border-subtle)'}`,
              }}>
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">

        {/* Users tab */}
        {tab === 'users' && (
          <div className="space-y-2">
            {profiles.map(p => {
              const rc = ROLE_COLORS[p.role]
              return (
                <div key={p.id} className="card flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold-fg)' }}>
                    {p.nome[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.nome}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mt-0.5"
                      style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                      {ROLE_LABELS[p.role]}
                    </span>
                  </div>
                  {!p.ativo && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                      Inativo
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Tables tab */}
        {tab === 'tables' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {mesas.map(m => {
              const sc = STATUS_COLORS[m.status] ?? STATUS_COLORS.disponivel
              return (
                <div key={m.id} className="card text-center" style={{ padding: '16px 8px' }}>
                  <p className="stat-number text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{m.numero}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mt-2"
                    style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                    {m.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New User Modal */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title="Novo Usuário">
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={userForm.nome}
              onChange={e => setUserForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input type="email" className="input" value={userForm.email}
              onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Senha</label>
            <input type="password" className="input" value={userForm.password}
              onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="label">Perfil</label>
            <select className="input" value={userForm.role}
              onChange={e => setUserForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              <option value="admin">Admin</option>
              <option value="caixa">Caixa</option>
              <option value="operador">Operador</option>
            </select>
          </div>
          <button onClick={createUser}
            disabled={!userForm.nome || !userForm.email || !userForm.password || saving}
            className="btn-primary w-full" style={{ padding: '14px', justifyContent: 'center' }}>
            {saving ? <Spinner size={18} /> : 'Criar Usuário'}
          </button>
        </div>
      </Modal>

      {/* New Mesa Modal */}
      <Modal open={mesaModal} onClose={() => setMesaModal(false)} title="Nova Mesa">
        <div className="space-y-4">
          <div>
            <label className="label">Número</label>
            <input type="number" className="input" value={mesaForm.numero}
              onChange={e => setMesaForm({ numero: e.target.value })} />
          </div>
          <button onClick={addMesa}
            disabled={!mesaForm.numero || saving}
            className="btn-primary w-full" style={{ padding: '14px', justifyContent: 'center' }}>
            {saving ? <Spinner size={18} /> : 'Adicionar Mesa'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

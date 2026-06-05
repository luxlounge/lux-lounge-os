import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { Plus, Users, LayoutGrid, Lock } from 'lucide-react'
import type { Profile, Mesa } from '../types'
import type { UserRole } from '../types'

const ROLE_LABELS: Record<UserRole, string> = { admin: 'Admin', caixa: 'Caixa', operador: 'Operador' }
const ROLE_COLORS: Record<UserRole, string> = { admin: 'badge-red', caixa: 'badge-yellow', operador: 'badge-gray' }

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
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-ink-card border border-ink-border flex items-center justify-center mb-4">
        <Lock size={22} className="text-[#333]" />
      </div>
      <p className="text-white font-semibold text-lg">Acesso Restrito</p>
      <p className="text-[#444] text-sm mt-1">Apenas administradores podem acessar as configurações.</p>
    </div>
  )

  if (loading) return <div className="flex justify-center items-center h-screen bg-ink"><Spinner size={32} /></div>

  return (
    <div className="min-h-screen bg-ink pb-24 md:pb-6">
      <div className="sticky top-0 z-20 bg-ink/95 backdrop-blur-sm border-b border-ink-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="page-header">Configurações</h1>
          {tab === 'users' ? (
            <button onClick={() => setUserModal(true)} className="btn-primary btn-sm"><Plus size={14} /> Usuário</button>
          ) : (
            <button onClick={() => setMesaModal(true)} className="btn-primary btn-sm"><Plus size={14} /> Mesa</button>
          )}
        </div>
        <div className="flex gap-2">
          {(['users', 'tables'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition ${tab === t ? 'bg-gold text-ink' : 'bg-ink-raised border border-ink-border text-[#555] hover:text-white'}`}>
              {t === 'users' ? <><Users size={11} />Usuários</> : <><LayoutGrid size={11} />Mesas</>}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {tab === 'users' && (
          <div className="space-y-2">
            {profiles.map(p => (
              <div key={p.id} className="bg-ink-card border border-ink-border rounded-2xl flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold text-sm font-bold shrink-0">
                  {p.nome[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white truncate">{p.nome}</p>
                  <span className={`badge text-[10px] mt-0.5 ${ROLE_COLORS[p.role]}`}>{ROLE_LABELS[p.role]}</span>
                </div>
                {!p.ativo && <span className="badge badge-gray text-[10px]">Inativo</span>}
              </div>
            ))}
          </div>
        )}

        {tab === 'tables' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {mesas.map(m => (
              <div key={m.id} className="bg-ink-card border border-ink-border rounded-2xl text-center p-4">
                <p className="font-display font-bold text-xl text-white">{m.numero}</p>
                <span className={`badge mt-1.5 text-[10px] ${
                  m.status === 'disponivel' ? 'badge-green' :
                  m.status === 'ocupada' ? 'badge-yellow' :
                  m.status === 'reservada' ? 'badge-gray' : 'badge-red'
                }`}>{m.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Novo Usuário">
        <div className="space-y-4">
          <div><label className="label">Nome</label><input className="input" value={userForm.nome} onChange={e => setUserForm(f => ({ ...f, nome: e.target.value }))} /></div>
          <div><label className="label">E-mail</label><input type="email" className="input" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label">Senha</label><input type="password" className="input" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} /></div>
          <div>
            <label className="label">Perfil</label>
            <select className="input" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              <option value="admin">Admin</option>
              <option value="caixa">Caixa</option>
              <option value="operador">Operador</option>
            </select>
          </div>
          <button onClick={createUser} disabled={!userForm.nome || !userForm.email || !userForm.password || saving} className="btn-primary w-full py-3.5">
            {saving ? <Spinner size={18} /> : 'Criar Usuário'}
          </button>
        </div>
      </Modal>

      <Modal open={mesaModal} onClose={() => setMesaModal(false)} title="Nova Mesa">
        <div className="space-y-4">
          <div><label className="label">Número *</label><input type="number" className="input" value={mesaForm.numero} onChange={e => setMesaForm({ numero: e.target.value })} /></div>
          <button onClick={addMesa} disabled={!mesaForm.numero || saving} className="btn-primary w-full py-3.5">
            {saving ? <Spinner size={18} /> : 'Adicionar Mesa'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { Plus, Users, LayoutGrid, Lock, Tag, Edit2, Trash2, Heart } from 'lucide-react'
import { PageHelp } from '../components/ui/PageHelp'
import { useToast } from '../components/ui/Toast'
import type { Profile, Mesa, Categoria, CrmConfig } from '../types'
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

const STATUS_LABELS: Record<string, string> = {
  disponivel: 'Disponível', ocupada: 'Ocupada', reservada: 'Reservada', manutencao: 'Manutenção',
}

export default function ConfigPage() {
  const { profile } = useAuth()
  const { success: toast, error: toastError } = useToast()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [categories, setCategories] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'users' | 'tables' | 'cats' | 'crm'>('users')
  const [crmConfig, setCrmConfig] = useState<CrmConfig | null>(null)
  const [crmForm, setCrmForm] = useState({ vip_min_spent: '1500', vip_min_visits: '10', frequent_min_visits: '5', inactive_days: '60' })
  const [savingCrm, setSavingCrm] = useState(false)

  // User modals
  const [userModal, setUserModal] = useState(false)
  const [editUserModal, setEditUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [userForm, setUserForm] = useState({ email: '', password: '', nome: '', role: 'operador' as UserRole })
  const [editUserForm, setEditUserForm] = useState({ nome: '', role: 'operador' as UserRole, ativo: true })

  // Mesa modals
  const [mesaModal, setMesaModal] = useState(false)
  const [editMesaModal, setEditMesaModal] = useState(false)
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null)
  const [mesaForm, setMesaForm] = useState({ numero: '' })
  const [editMesaForm, setEditMesaForm] = useState({ numero: '' })

  // Category modals
  const [catModal, setCatModal] = useState(false)
  const [editCatModal, setEditCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState<Categoria | null>(null)
  const [catForm, setCatForm] = useState({ nome: '', ordem: '0', exibe_cardapio: true, controla_estoque: false })

  async function load() {
    const [{ data: ps }, { data: ms }, { data: cs }, { data: crm }] = await Promise.all([
      supabase.from('profiles').select('*').order('nome'),
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('categorias').select('*').order('ordem'),
      supabase.from('crm_config').select('*').eq('id', 1).single(),
    ])
    setProfiles(ps ?? [])
    setMesas(ms ?? [])
    setCategories(cs ?? [])
    if (crm) {
      setCrmConfig(crm)
      setCrmForm({
        vip_min_spent: String(crm.vip_min_spent),
        vip_min_visits: String(crm.vip_min_visits),
        frequent_min_visits: String(crm.frequent_min_visits),
        inactive_days: String(crm.inactive_days),
      })
    }
    setLoading(false)
  }

  async function saveCrmConfig() {
    setSavingCrm(true)
    await supabase.from('crm_config').upsert({
      id: 1,
      vip_min_spent: parseFloat(crmForm.vip_min_spent) || 1500,
      vip_min_visits: parseInt(crmForm.vip_min_visits) || 10,
      frequent_min_visits: parseInt(crmForm.frequent_min_visits) || 5,
      inactive_days: parseInt(crmForm.inactive_days) || 60,
      updated_at: new Date().toISOString(),
    })
    setSavingCrm(false)
    toast('Configurações CRM salvas')
    load()
  }

  useEffect(() => { load() }, [])

  // ── User CRUD ──

  async function createUser() {
    setSaving(true)
    const { data, error } = await supabase.auth.signUp({
      email: userForm.email,
      password: userForm.password,
    })
    if (error) { toastError(error.message); setSaving(false); return }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id, nome: userForm.nome, role: userForm.role, ativo: true,
      })
    }
    setSaving(false)
    setUserModal(false)
    setUserForm({ email: '', password: '', nome: '', role: 'operador' })
    toast('Usuário criado com sucesso')
    load()
  }

  function openEditUser(p: Profile) {
    setEditingUser(p)
    setEditUserForm({ nome: p.nome, role: p.role, ativo: p.ativo })
    setEditUserModal(true)
  }

  async function saveUser() {
    if (!editingUser) return
    setSaving(true)
    await supabase.from('profiles').update({
      nome: editUserForm.nome, role: editUserForm.role, ativo: editUserForm.ativo,
    }).eq('id', editingUser.id)
    setSaving(false)
    setEditUserModal(false)
    toast('Usuário atualizado')
    load()
  }

  // ── Mesa CRUD ──

  async function addMesa() {
    setSaving(true)
    await supabase.from('mesas').insert({ numero: parseInt(mesaForm.numero) })
    setSaving(false)
    setMesaModal(false)
    setMesaForm({ numero: '' })
    toast('Mesa criada')
    load()
  }

  function openEditMesa(m: Mesa) {
    setEditingMesa(m)
    setEditMesaForm({ numero: String(m.numero) })
    setEditMesaModal(true)
  }

  async function saveMesa() {
    if (!editingMesa) return
    setSaving(true)
    await supabase.from('mesas').update({ numero: parseInt(editMesaForm.numero) }).eq('id', editingMesa.id)
    setSaving(false)
    setEditMesaModal(false)
    toast('Mesa atualizada')
    load()
  }

  async function deleteMesa(m: Mesa) {
    if (m.status === 'ocupada') { toastError('Não é possível remover uma mesa ocupada.'); return }
    if (!confirm(`Remover Mesa ${m.numero}? Esta ação é irreversível.`)) return
    await supabase.from('mesas').delete().eq('id', m.id)
    toast(`Mesa ${m.numero} removida`)
    load()
  }

  // ── Categoria CRUD ──

  async function createCat() {
    setSaving(true)
    await supabase.from('categorias').insert({
      nome: catForm.nome,
      ordem: parseInt(catForm.ordem) || 0,
      exibe_cardapio: catForm.exibe_cardapio,
      controla_estoque: catForm.controla_estoque,
    })
    setSaving(false)
    setCatModal(false)
    setCatForm({ nome: '', ordem: '0', exibe_cardapio: true, controla_estoque: false })
    toast('Categoria criada')
    load()
  }

  function openEditCat(c: Categoria) {
    setEditingCat(c)
    setCatForm({ nome: c.nome, ordem: String(c.ordem), exibe_cardapio: c.exibe_cardapio, controla_estoque: c.controla_estoque })
    setEditCatModal(true)
  }

  async function saveCat() {
    if (!editingCat) return
    setSaving(true)
    await supabase.from('categorias').update({
      nome: catForm.nome,
      ordem: parseInt(catForm.ordem) || 0,
      exibe_cardapio: catForm.exibe_cardapio,
      controla_estoque: catForm.controla_estoque,
    }).eq('id', editingCat.id)
    setSaving(false)
    setEditCatModal(false)
    toast('Categoria atualizada')
    load()
  }

  async function deleteCat(c: Categoria) {
    if (!confirm(`Remover categoria "${c.nome}"? Produtos vinculados ficarão sem categoria.`)) return
    await supabase.from('categorias').delete().eq('id', c.id)
    toast(`Categoria "${c.nome}" removida`)
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

  const TABS = [
    { key: 'users',  icon: Users,      label: 'Usuários' },
    { key: 'tables', icon: LayoutGrid,  label: 'Mesas' },
    { key: 'cats',   icon: Tag,         label: 'Categorias' },
    { key: 'crm',    icon: Heart,       label: 'CRM' },
  ] as const

  return (
    <div className="min-h-screen pb-24 md:pb-6" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Configurações</h1>
              <PageHelp title="Configurações" lines={[
                'Gerencie usuários do sistema: crie contas para caixa e operadores com acesso controlado por função.',
                'Gerencie as mesas do salão: adicione, edite nomes e altere status (disponível, reservada, manutenção).',
                'Gerencie as categorias de produtos e defina quais aparecem no cardápio.',
                'Em CRM, configure os critérios de classificação dos clientes: gasto mínimo VIP, visitas mínimas e dias de inatividade.',
              ]} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {tab === 'users' ? `${profiles.length} usuários` : tab === 'tables' ? `${mesas.length} mesas` : tab === 'cats' ? `${categories.length} categorias` : 'Regras de segmentação CRM'}
            </p>
          </div>
          {tab === 'users' && (
            <button onClick={() => setUserModal(true)} className="btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
              <Plus size={14} /> Usuário
            </button>
          )}
          {tab === 'tables' && (
            <button onClick={() => setMesaModal(true)} className="btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
              <Plus size={14} /> Mesa
            </button>
          )}
          {tab === 'cats' && (
            <button onClick={() => setCatModal(true)} className="btn-primary" style={{ padding: '7px 14px', fontSize: '13px' }}>
              <Plus size={14} /> Categoria
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {TABS.map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 150ms',
                background: tab === key ? 'var(--gold)' : 'var(--bg-raised)',
                color: tab === key ? 'var(--gold-fg)' : 'var(--text-muted)',
                border: `1px solid ${tab === key ? 'var(--gold)' : 'var(--border-subtle)'}`,
              }}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-2">

        {/* Users */}
        {tab === 'users' && profiles.map(p => {
          const rc = ROLE_COLORS[p.role]
          return (
            <div key={p.id} className="card flex items-center gap-3 cursor-pointer transition"
              onClick={() => openEditUser(p)} style={{ opacity: p.ativo ? 1 : 0.55 }}>
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
              <Edit2 size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          )
        })}

        {/* Tables */}
        {tab === 'tables' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {mesas.map(m => {
              const sc = STATUS_COLORS[m.status] ?? STATUS_COLORS.disponivel
              return (
                <div key={m.id} className="card text-center relative group" style={{ padding: '16px 8px' }}>
                  <p className="stat-number text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{m.numero}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                    {STATUS_LABELS[m.status] ?? m.status}
                  </span>
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={e => { e.stopPropagation(); openEditMesa(m) }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                      <Edit2 size={10} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteMesa(m) }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)' }}>
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Categories */}
        {tab === 'cats' && (
          <div className="space-y-2">
            {categories.length === 0 && (
              <div className="text-center py-12">
                <Tag size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Nenhuma categoria cadastrada</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Crie categorias antes de cadastrar produtos.
                </p>
              </div>
            )}
            {categories.map(c => (
              <div key={c.id} className="card flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm shrink-0"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                  {c.ordem}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{c.nome}</p>
                  <div className="flex gap-2 mt-0.5">
                    {c.exibe_cardapio && (
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--green)' }}>· Cardápio</span>
                    )}
                    {c.controla_estoque && (
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--amber)' }}>· Estoque</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEditCat(c)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => deleteCat(c)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                    style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* CRM Config */}
        {tab === 'crm' && (
          <div className="space-y-4 max-w-lg">
            <div className="card space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tag VIP</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Gasto mínimo (R$)</label>
                  <input type="number" className="input" value={crmForm.vip_min_spent}
                    onChange={e => setCrmForm(f => ({ ...f, vip_min_spent: e.target.value }))} />
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Total gasto ≥ R$ {crmForm.vip_min_spent}</p>
                </div>
                <div>
                  <label className="label">Visitas mínimas</label>
                  <input type="number" className="input" value={crmForm.vip_min_visits}
                    onChange={e => setCrmForm(f => ({ ...f, vip_min_visits: e.target.value }))} />
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Visitas ≥ {crmForm.vip_min_visits} (ou gasto VIP)</p>
                </div>
              </div>
            </div>

            <div className="card space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tag Frequente</p>
              <div>
                <label className="label">Visitas mínimas para Frequente</label>
                <input type="number" className="input" value={crmForm.frequent_min_visits}
                  onChange={e => setCrmForm(f => ({ ...f, frequent_min_visits: e.target.value }))} />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Visitas ≥ {crmForm.frequent_min_visits} (sem ser VIP)</p>
              </div>
            </div>

            <div className="card space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tag Inativo</p>
              <div>
                <label className="label">Dias sem visita</label>
                <input type="number" className="input" value={crmForm.inactive_days}
                  onChange={e => setCrmForm(f => ({ ...f, inactive_days: e.target.value }))} />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Sem visita há ≥ {crmForm.inactive_days} dias</p>
              </div>
            </div>

            <button onClick={saveCrmConfig} disabled={savingCrm}
              className="btn-primary w-full" style={{ padding: '14px', justifyContent: 'center' }}>
              {savingCrm ? <Spinner size={18} /> : 'Salvar Configurações CRM'}
            </button>

            {crmConfig && (
              <p className="text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Última atualização: {new Date(crmConfig.updated_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}

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
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Requer confirmação de e-mail desativada no painel Supabase → Authentication → Settings.
          </p>
          <button onClick={createUser} disabled={!userForm.nome || !userForm.email || !userForm.password || saving}
            className="btn-primary w-full" style={{ padding: '14px', justifyContent: 'center' }}>
            {saving ? <Spinner size={18} /> : 'Criar Usuário'}
          </button>
        </div>
      </Modal>

      <Modal open={editUserModal} onClose={() => setEditUserModal(false)} title="Editar Usuário">
        <div className="space-y-4">
          <div><label className="label">Nome</label><input className="input" value={editUserForm.nome} onChange={e => setEditUserForm(f => ({ ...f, nome: e.target.value }))} /></div>
          <div>
            <label className="label">Perfil</label>
            <select className="input" value={editUserForm.role} onChange={e => setEditUserForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              <option value="admin">Admin</option>
              <option value="caixa">Caixa</option>
              <option value="operador">Operador</option>
            </select>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={editUserForm.ativo}
              onChange={e => setEditUserForm(f => ({ ...f, ativo: e.target.checked }))}
              className="w-4 h-4 mt-0.5" style={{ accentColor: 'var(--gold)' }} />
            <div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Usuário ativo</span>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Desativar bloqueia o acesso sem excluir o usuário</p>
            </div>
          </label>
          <button onClick={saveUser} disabled={!editUserForm.nome || saving}
            className="btn-primary w-full" style={{ padding: '14px', justifyContent: 'center' }}>
            {saving ? <Spinner size={18} /> : 'Salvar Alterações'}
          </button>
        </div>
      </Modal>

      <Modal open={mesaModal} onClose={() => setMesaModal(false)} title="Nova Mesa">
        <div className="space-y-4">
          <div><label className="label">Número</label><input type="number" className="input" value={mesaForm.numero} onChange={e => setMesaForm({ numero: e.target.value })} /></div>
          <button onClick={addMesa} disabled={!mesaForm.numero || saving}
            className="btn-primary w-full" style={{ padding: '14px', justifyContent: 'center' }}>
            {saving ? <Spinner size={18} /> : 'Adicionar Mesa'}
          </button>
        </div>
      </Modal>

      <Modal open={editMesaModal} onClose={() => setEditMesaModal(false)} title={`Editar Mesa ${editingMesa?.numero}`}>
        <div className="space-y-4">
          <div><label className="label">Número</label><input type="number" className="input" value={editMesaForm.numero} onChange={e => setEditMesaForm({ numero: e.target.value })} /></div>
          <button onClick={saveMesa} disabled={!editMesaForm.numero || saving}
            className="btn-primary w-full" style={{ padding: '14px', justifyContent: 'center' }}>
            {saving ? <Spinner size={18} /> : 'Salvar'}
          </button>
        </div>
      </Modal>

      <Modal open={catModal} onClose={() => setCatModal(false)} title="Nova Categoria">
        <CatForm form={catForm} setForm={setCatForm} onSave={createCat} saving={saving} label="Criar Categoria" />
      </Modal>

      <Modal open={editCatModal} onClose={() => setEditCatModal(false)} title="Editar Categoria">
        <CatForm form={catForm} setForm={setCatForm} onSave={saveCat} saving={saving} label="Salvar Alterações" />
      </Modal>
    </div>
  )
}

type CatFormState = { nome: string; ordem: string; exibe_cardapio: boolean; controla_estoque: boolean }

function CatForm({ form, setForm, onSave, saving, label }: {
  form: CatFormState
  setForm: React.Dispatch<React.SetStateAction<CatFormState>>
  onSave: () => void
  saving: boolean
  label: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Nome</label>
        <input className="input" placeholder="Ex: Narguilés, Bebidas, Petiscos…"
          value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
      </div>
      <div>
        <label className="label">Ordem de exibição</label>
        <input type="number" className="input" value={form.ordem}
          onChange={e => setForm(f => ({ ...f, ordem: e.target.value }))} />
      </div>
      <div className="space-y-3">
        {[
          { key: 'exibe_cardapio',   lbl: 'Exibir no cardápio QR',   desc: 'Produtos aparecem no app do cliente' },
          { key: 'controla_estoque', lbl: 'Controlar estoque',        desc: 'Decrementa estoque ao fechar comanda' },
        ].map(({ key, lbl, desc }) => (
          <label key={key} className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form[key as keyof CatFormState] as boolean}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
              className="w-4 h-4 mt-0.5" style={{ accentColor: 'var(--gold)' }} />
            <div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{lbl}</span>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
            </div>
          </label>
        ))}
      </div>
      <button onClick={onSave} disabled={!form.nome || saving}
        className="btn-primary w-full" style={{ padding: '14px', justifyContent: 'center' }}>
        {saving ? <Spinner size={18} /> : label}
      </button>
    </div>
  )
}

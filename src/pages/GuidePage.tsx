import { useState } from 'react'
import {
  BookOpen, CheckCircle, Circle, ChevronDown, ChevronRight,
  LayoutDashboard, LayoutGrid, Landmark, ClipboardList,
  ShoppingBag, Package, Users, Settings, Zap,
} from 'lucide-react'

// ─── Checklist ────────────────────────────────────────────────────────────────

const CHECKLIST = [
  'Criar categorias principais (ex: Bebidas, Narguile, Petisco)',
  'Cadastrar produtos com preço e estoque inicial',
  'Registrar primeira compra para ativar custo médio',
  'Criar ficha técnica de pelo menos 1 drink',
  'Abrir uma mesa no salão',
  'Cadastrar cliente com WhatsApp no check-in',
  'Lançar pedido na comanda',
  'Registrar pagamento parcial',
  'Registrar pagamento total e fechar comanda',
  'Conferir cliente salvo no CRM',
  'Conferir Dashboard com dados do movimento',
  'Conferir estoque baixado automaticamente',
  'Testar alerta de estoque crítico',
]

// ─── Sections ─────────────────────────────────────────────────────────────────

interface GuideItem {
  title: string
  body: string
}

interface GuideSection {
  id: string
  icon: typeof BookOpen
  label: string
  color: string
  items: GuideItem[]
}

const SECTIONS: GuideSection[] = [
  {
    id: 'inicio',
    icon: Zap,
    label: 'Começando',
    color: 'var(--gold)',
    items: [
      {
        title: 'Como abrir uma mesa',
        body: 'Vá em Mesas. Clique em uma mesa disponível (verde). Selecione "Abrir Mesa". O sistema vai pedir o WhatsApp do cliente — isso é opcional, mas recomendado para o CRM. A mesa passa para o status Ocupada.',
      },
      {
        title: 'Como cadastrar cliente',
        body: 'No momento de abrir a mesa, o sistema busca o cliente pelo WhatsApp. Se não existir, você pode cadastrar na hora: preencha nome e número. O cliente fica salvo automaticamente para visitas futuras.',
      },
      {
        title: 'Como abrir comanda',
        body: 'A comanda é aberta automaticamente ao abrir a mesa. Você não precisa criar nada separado. Cada mesa tem uma comanda ativa enquanto estiver ocupada.',
      },
      {
        title: 'Como lançar pedido',
        body: 'Entre na comanda da mesa. Clique em "Novo Pedido". Selecione os produtos e quantidades. Confirme. O pedido aparece na comanda e desconta automaticamente do estoque.',
      },
      {
        title: 'Como registrar pagamento',
        body: 'Dentro da comanda, clique em "Registrar Pagamento". Escolha o método: dinheiro, Pix, cartão de crédito, débito ou cortesia. Você pode registrar vários pagamentos parciais até o total ser quitado.',
      },
      {
        title: 'Como fechar comanda',
        body: 'Com o pagamento completo, clique em "Fechar Comanda". O sistema confirma e libera a mesa. O cliente é atualizado no CRM com visita, total gasto e data.',
      },
    ],
  },
  {
    id: 'caixa',
    icon: Landmark,
    label: 'Operação do Caixa',
    color: 'var(--green)',
    items: [
      {
        title: 'Aprovar pedidos internos',
        body: 'Na tela Caixa, você vê todos os pedidos pendentes do salão. Cada card mostra a mesa, os itens e o total. Você pode aprovar ou cancelar cada pedido antes de enviar para preparo.',
      },
      {
        title: 'Registrar pagamento',
        body: 'Acesse a comanda da mesa desejada. Use o botão de pagamento. Cada registro fica salvo com método, valor e horário. Pagamentos parciais são aceitos — o sistema calcula o saldo automaticamente.',
      },
      {
        title: 'Fechar comanda',
        body: 'Só é possível fechar quando o total pago é igual ou maior que o consumo. Ao fechar, a mesa volta para disponível e o cliente é registrado no histórico.',
      },
      {
        title: 'Transferir mesa',
        body: 'Dentro da comanda, use a opção de transferência. Selecione a mesa de destino (deve estar disponível). Toda a comanda, pedidos e pagamentos parciais migram junto. O QR Code da nova mesa passa a refletir o consumo.',
      },
      {
        title: 'Resolver saldo pendente',
        body: 'Se o total pago for menor que o consumo, o sistema não deixa fechar. Registre o valor restante com o método correto ou use Cortesia se a diferença for desconto autorizado.',
      },
    ],
  },
  {
    id: 'mesas',
    icon: LayoutGrid,
    label: 'Mesas',
    color: 'var(--blue)',
    items: [
      {
        title: 'Entendendo os status',
        body: 'Cada mesa tem uma cor que indica seu estado atual. Verde = disponível para abertura. Laranja/Âmbar = ocupada com comanda ativa. Azul = reservada. Cinza = em manutenção.',
      },
      {
        title: 'Mesa disponível',
        body: 'Pronta para ser aberta. Clique nela para iniciar o atendimento. Você pode informar o nome e WhatsApp do cliente logo no começo.',
      },
      {
        title: 'Mesa ocupada',
        body: 'Tem uma comanda ativa. Ao clicar, você entra na comanda e pode ver o consumo, lançar pedidos e registrar pagamentos.',
      },
      {
        title: 'Mesa reservada',
        body: 'Bloqueada para um cliente que vai chegar. Não pode ser aberta por outro atendimento. O status pode ser alterado manualmente na tela de configuração de mesas.',
      },
      {
        title: 'Mesa em manutenção',
        body: 'Fora de operação temporariamente. Não aparece disponível para abertura. Use para sinalizar quando uma mesa está com problema.',
      },
    ],
  },
  {
    id: 'produtos',
    icon: ShoppingBag,
    label: 'Produtos e Estoque',
    color: 'var(--amber)',
    items: [
      {
        title: 'Como cadastrar produto',
        body: 'Vá em Produtos. Clique em "Novo Produto". Preencha nome, categoria, preço de venda e quantidade inicial em estoque. Ative o produto para ele aparecer nos pedidos.',
      },
      {
        title: 'Como registrar compra',
        body: 'Na tela Estoque, selecione o produto e clique em "Registrar Compra". Informe a quantidade, o custo por unidade e o fornecedor. O sistema calcula o custo médio automaticamente.',
      },
      {
        title: 'Como funciona o custo médio',
        body: 'Cada compra nova é integrada ao custo médio ponderado do produto. Isso significa que o sistema calcula o custo real por unidade levando em conta compras anteriores e atuais. Isso afeta o lucro estimado no Dashboard.',
      },
      {
        title: 'Como criar ficha técnica',
        body: 'Na tela de Produtos, abra um produto e acesse "Ficha Técnica". Adicione os insumos que esse produto consome. Exemplo: 1 drink pode consumir 50ml de vodca + 1 limão. Ao vender o drink, esses insumos são baixados automaticamente.',
      },
      {
        title: 'Como funciona a baixa automática',
        body: 'Quando um pedido é confirmado, o sistema desconta as quantidades de estoque de cada produto vendido. Se o produto tiver ficha técnica, os insumos da ficha também são descontados. Você vê o estoque atualizado em tempo real.',
      },
    ],
  },
  {
    id: 'crm',
    icon: Users,
    label: 'CRM de Clientes',
    color: 'var(--purple)',
    items: [
      {
        title: 'Como o cliente é salvo',
        body: 'O cliente é cadastrado no momento do check-in da mesa, pelo WhatsApp. Nas visitas seguintes, o sistema reconhece o número e vincula automaticamente à comanda. Histórico, total gasto e visitas são atualizados a cada fechamento.',
      },
      {
        title: 'Como funciona o WhatsApp',
        body: 'O WhatsApp é o identificador único do cliente. Não é necessário app ou integração — é só o número usado para busca e cadastro. No futuro, poderá ser usado para envio de mensagens e campanhas.',
      },
      {
        title: 'Tags automáticas',
        body: 'O sistema classifica os clientes automaticamente com base em histórico. As tags são calculadas no momento em que você consulta o CRM, usando os critérios configurados na tela de Configurações.',
      },
      {
        title: 'VIP',
        body: 'Cliente com alto gasto total ou muitas visitas, conforme os limites definidos nas Configurações. Pode ser marcado manualmente também, independente dos critérios automáticos.',
      },
      {
        title: 'Frequente',
        body: 'Cliente que visita com regularidade, mas ainda não atingiu o nível VIP. O número mínimo de visitas para essa tag é definido nas Configurações.',
      },
      {
        title: 'Novo cliente',
        body: 'Cadastrado nos últimos 30 dias. Útil para acompanhar a entrada de clientes recentes no negócio.',
      },
      {
        title: 'Inativo',
        body: 'Cliente que não visita há mais de X dias (configurável). Sinal de que pode ser interessante uma ação de reativação.',
      },
      {
        title: 'Observações internas',
        body: 'Cada cliente pode ter anotações internas visíveis apenas para a equipe. Use para registrar preferências, alergias, observações de atendimento ou qualquer informação relevante.',
      },
    ],
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    color: 'var(--red)',
    items: [
      {
        title: 'Como ler os indicadores',
        body: 'O Dashboard mostra um resumo do período selecionado: hoje, últimos 7 ou 15 dias, mês atual ou mês anterior. Troque o período no topo da tela para comparar diferentes momentos.',
      },
      {
        title: 'Faturamento',
        body: 'Total recebido em pagamentos no período. O percentual mostra a variação em relação ao período anterior equivalente. Verde = crescimento. Vermelho = queda.',
      },
      {
        title: 'Lucro estimado',
        body: 'Diferença entre o faturamento e o custo médio dos produtos vendidos. Depende do custo médio estar atualizado (via compras no Estoque). Quanto mais compras você registrar, mais preciso fica o número.',
      },
      {
        title: 'Ticket médio',
        body: 'Faturamento dividido pelo número de comandas fechadas no período. Indica quanto cada mesa gerou em média.',
      },
      {
        title: 'Clientes atendidos',
        body: 'Número de comandas fechadas no período. Cada comanda equivale a uma mesa atendida.',
      },
      {
        title: 'Estoque crítico',
        body: 'Produtos com estoque zerado ou muito baixo (menos de 3 unidades). Veja na parte inferior do Dashboard e providencie reposição antes do próximo turno.',
      },
      {
        title: 'Alertas operacionais',
        body: 'O sino no topo da tela pisca quando há situações que precisam de atenção: mesa aberta há mais de 4 horas, pedido sem resposta há mais de 10 minutos, estoque zerado. Clique no sino para ver os detalhes.',
      },
    ],
  },
  {
    id: 'config',
    icon: Settings,
    label: 'Configurações',
    color: 'var(--text-muted)',
    items: [
      {
        title: 'Critérios do CRM',
        body: 'Define quando um cliente vira VIP, Frequente ou Inativo. Ajuste os valores de gasto mínimo, visitas mínimas e dias sem visita conforme a realidade do seu negócio.',
      },
      {
        title: 'Usuários do sistema',
        body: 'Gerencie quem tem acesso ao sistema. Cada usuário tem uma função: admin, caixa ou operador. A função define o que cada pessoa pode ver e fazer.',
      },
      {
        title: 'Mesas',
        body: 'Gerencie o número de mesas, nomes e status. Mesas em manutenção ou reservadas podem ser configuradas aqui.',
      },
    ],
  },
]

// ─── Flow steps ───────────────────────────────────────────────────────────────

const FLOW_STEPS = [
  { n: 1, label: 'Caixa abre a mesa',                  detail: 'Clica na mesa disponível e inicia o atendimento.' },
  { n: 2, label: 'Informa nome e WhatsApp do cliente', detail: 'O cliente é cadastrado ou reconhecido automaticamente.' },
  { n: 3, label: 'Mesa fica ocupada',                  detail: 'Status muda para ocupada. Comanda ativa.' },
  { n: 4, label: 'Pedido é lançado na comanda',        detail: 'Itens são adicionados e confirmados.' },
  { n: 5, label: 'Estoque é baixado',                  detail: 'Produtos saem do estoque automaticamente.' },
  { n: 6, label: 'Pagamento é registrado',             detail: 'Dinheiro, Pix ou cartão. Parcial ou total.' },
  { n: 7, label: 'Comanda é fechada',                  detail: 'Mesa liberada. Histórico registrado.' },
  { n: 8, label: 'Cliente salvo no CRM',               detail: 'Visita e gasto acumulados no perfil.' },
  { n: 9, label: 'Dashboard atualiza',                 detail: 'Faturamento, lucro e métricas refletem o movimento.' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function GuidePage() {
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['inicio']))
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleItem(key: string) {
    setOpenItems(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleCheck(i: number) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const doneCount = checked.size

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-24 md:pb-6">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)' }}>
            <BookOpen size={17} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Guia Operacional
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Aprenda a usar o Lux Lounge OS do jeito certo.
            </p>
          </div>
        </div>
      </div>

      {/* ── Fluxo ideal ── */}
      <div className="rounded-2xl p-4 mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} style={{ color: 'var(--gold)' }} />
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            Fluxo ideal da operação
          </span>
        </div>
        <div className="space-y-2">
          {FLOW_STEPS.map(step => (
            <div key={step.n} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold)' }}>
                {step.n}
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{step.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Checklist ── */}
      <div className="rounded-2xl p-4 mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} style={{ color: 'var(--green)' }} />
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Checklist do Teste Real
            </span>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: doneCount === CHECKLIST.length ? 'var(--green-bg)' : 'var(--gold-bg)',
              color: doneCount === CHECKLIST.length ? 'var(--green)' : 'var(--gold)',
              border: `1px solid ${doneCount === CHECKLIST.length ? 'var(--green-border)' : 'var(--gold-border)'}`,
            }}>
            {doneCount}/{CHECKLIST.length}
          </span>
        </div>

        <div className="space-y-2">
          {CHECKLIST.map((item, i) => {
            const done = checked.has(i)
            return (
              <button
                key={i}
                onClick={() => toggleCheck(i)}
                className="w-full flex items-start gap-3 text-left transition hover:opacity-80"
              >
                {done
                  ? <CheckCircle size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--green)' }} />
                  : <Circle size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--border-default)' }} />
                }
                <span className="text-sm" style={{
                  color: done ? 'var(--text-muted)' : 'var(--text-secondary)',
                  textDecoration: done ? 'line-through' : 'none',
                }}>
                  {item}
                </span>
              </button>
            )
          })}
        </div>

        {doneCount === CHECKLIST.length && (
          <div className="mt-4 p-3 rounded-xl text-center"
            style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--green)' }}>
              Teste concluído! O sistema está pronto para operar.
            </p>
          </div>
        )}
      </div>

      {/* ── Guide sections ── */}
      <div className="space-y-3">
        {SECTIONS.map(section => {
          const Icon = section.icon
          const isOpen = openSections.has(section.id)
          return (
            <div key={section.id} className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition hover:opacity-80"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
                  <Icon size={14} style={{ color: section.color }} />
                </div>
                <span className="flex-1 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {section.label}
                </span>
                <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>
                  {section.items.length} tópicos
                </span>
                {isOpen
                  ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                  : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                }
              </button>

              {isOpen && (
                <div className="px-4 pb-3 space-y-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {section.items.map((item, idx) => {
                    const key = `${section.id}-${idx}`
                    const expanded = openItems.has(key)
                    return (
                      <div key={key} className="rounded-xl overflow-hidden mt-2"
                        style={{ border: '1px solid var(--border-subtle)' }}>
                        <button
                          onClick={() => toggleItem(key)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition hover:opacity-80"
                          style={{ background: 'var(--bg-raised)' }}
                        >
                          <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {item.title}
                          </span>
                          {expanded
                            ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
                            : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                          }
                        </button>
                        {expanded && (
                          <div className="px-3 py-2.5" style={{ background: 'var(--bg-card)' }}>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                              {item.body}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

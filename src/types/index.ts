export type UserRole = 'admin' | 'caixa' | 'operador'
export type ProductType = 'simples' | 'composto'
export type MesaStatus = 'disponivel' | 'ocupada' | 'reservada' | 'manutencao' | 'solicitou_fechamento'
export type SolicitacaoTipo = 'atendimento' | 'rosh' | 'fechamento'
export type SolicitacaoStatus = 'pendente' | 'atendido'
export type PedidoStatus = 'pendente' | 'preparo' | 'entregue' | 'cancelado'
export type PagamentoMetodo = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'cortesia'
export type MovimentoTipo = 'entrada' | 'saida' | 'ajuste'
export type ComandaStatus = 'aberta' | 'fechada'

export interface Profile {
  id: string
  nome: string
  role: UserRole
  ativo: boolean
  created_at: string
}

export interface Mesa {
  id: number
  numero: number
  status: MesaStatus
  qr_slug: string
  created_at: string
}

export interface Categoria {
  id: number
  nome: string
  ordem: number
  exibe_cardapio: boolean
  controla_estoque: boolean
}

export interface Product {
  id: number
  nome: string
  categoria_id: number | null
  preco: number
  stock_quantity: number
  active: boolean
  exibe_cardapio: boolean
  is_rosh: boolean
  is_insumo_rosh: boolean
  is_essencia: boolean
  is_carvao: boolean
  carvao_por_rosh: number
  preco_adicional_rosh: number
  quantidade_total_essencia: number
  carvao_product_id: number | null
  imagem_url: string | null
  cost_price: number
  unit_type: string
  package_quantity: number
  avg_cost: number
  last_purchase_at: string | null
  stock_minimo: number
  created_at: string
  production_sector?: 'BAR' | 'NARGUILE' | 'COZINHA' | 'CAIXA' | null
  product_type?: ProductType
  categorias?: Categoria
}

export interface RecipeItem {
  id: number
  product_id: number
  ingredient_product_id: number
  quantity_used: number
  created_at: string
  ingredient?: Product
}

export interface Cliente {
  id: number
  nome: string
  whatsapp: string
  created_at: string
  last_visit: string | null
  total_visits: number
  total_spent: number
  notes: string | null
  is_vip_manual: boolean
  birthday: string | null
}

export interface CrmConfig {
  id: number
  vip_min_spent: number
  vip_min_visits: number
  frequent_min_visits: number
  inactive_days: number
  updated_at: string
}

export interface Comanda {
  id: number
  mesa_id: number
  status: ComandaStatus
  aberta_por: string | null
  fechada_por: string | null
  total: number
  total_pago: number
  aberta_em: string
  fechada_em: string | null
  cliente_id: number | null
  pessoas: number | null
  observacao: string | null
  session_token: string | null
  created_at: string
  mesas?: Mesa
  clientes?: Cliente
}

export interface Pedido {
  id: number
  comanda_id: number
  mesa_id: number
  status: PedidoStatus
  criado_por: string | null
  observacao: string | null
  created_at: string
  pedido_itens?: PedidoItem[]
}

export interface SelectedOption {
  group_id: number
  group_nome: string
  option_id: number
  option_nome: string
  price_delta: number
}

export interface ProductOptionGroup {
  id: number
  product_id: number
  nome: string
  tipo: 'single' | 'multiple'
  obrigatorio: boolean
  min_select: number
  max_select: number
  ordem: number
  ativo: boolean
  created_at: string
  product_options?: ProductOption[]
}

export interface ProductOption {
  id: number
  group_id: number
  nome: string
  price_delta: number
  ordem: number
  ativo: boolean
  created_at: string
}

export interface CompositeItem {
  id: number
  product_id: number
  component_product_id: number
  quantity: number
  ordem: number
  created_at: string
  component?: Product
}

export interface CompositePersonalizationOption {
  id: number
  personalization_id: number
  component_product_id: number
  price_delta: number
  is_default: boolean
  ordem: number
  created_at: string
  component?: Product
}

export interface CompositePersonalization {
  id: number
  product_id: number
  nome: string
  quantidade: number
  ordem: number
  created_at: string
  options?: CompositePersonalizationOption[]
}

export interface CompositeAddon {
  id: number
  product_id: number
  component_product_id: number
  price_delta: number
  ordem: number
  created_at: string
  component?: Product
}

export interface CompositeConfig {
  inclusions?: { component_product_id: number; component_nome: string; quantity: number }[]
  personalizations: {
    personalization_id: number
    personalization_nome: string
    option_id: number
    option_nome: string
    quantidade: number
    price_delta: number
    component_product_id: number
    component_production_sector: string | null
  }[]
  addons: {
    addon_id: number
    addon_nome: string
    price_delta: number
    component_product_id: number
    component_production_sector: string | null
  }[]
}

export interface RoshEssencia {
  id: number
  nome: string
  percentual: number       // 100 (única) | 50 (meio a meio)
  gramas: number           // sessao_gramas_total × (percentual / 100)
  preco_adicional: number  // snapshot do preco_adicional_rosh no momento da venda
}

export interface RoshConfig {
  sessao_gramas_total: number
  essencias: RoshEssencia[]
  // tipo_mistura omitido — derivado de essencias.length (1=única, 2=meio a meio)
}

export interface PedidoItem {
  id: number
  pedido_id: number
  product_id: number | null
  nome_produto: string
  preco_unitario: number
  quantidade: number
  total_item: number
  is_rosh: boolean
  selected_options?: SelectedOption[] | null
  price_additions?: number
  composite_config?: CompositeConfig | null
  rosh_config?: RoshConfig | null
}

export interface Pagamento {
  id: number
  comanda_id: number
  metodo: PagamentoMetodo
  valor: number
  registrado_por: string | null
  observacao: string | null
  created_at: string
}

export interface StockPurchase {
  id: number
  product_id: number
  quantity: number
  unit_cost: number
  total_cost: number
  supplier: string | null
  purchased_at: string
  created_by: string | null
  created_at: string
}

export interface OperationalNotification {
  id: number
  tipo: string
  titulo: string
  descricao: string | null
  lida: boolean
  created_at: string
  action_url: string | null
  ref_id: string | null
}

export interface MesaSolicitacao {
  id: number
  mesa_id: number
  comanda_id: number | null
  mesa_numero: number
  tipo: SolicitacaoTipo
  status: SolicitacaoStatus
  created_at: string
  mesas?: { id: number; numero: number }
}

export interface Avaliacao {
  id: number
  comanda_id: number
  session_token: string | null
  nota_geral: number | null
  nota_atendimento: number | null
  nota_produto: number | null
  nota_ambiente: number | null
  comentario: string | null
  created_at: string
}

export interface EstoqueMovimento {
  id: number
  product_id: number
  tipo: MovimentoTipo
  quantidade: number
  motivo: string | null
  pedido_id: number | null
  criado_por: string | null
  created_at: string
  products?: Product
}

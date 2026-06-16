export type UserRole = 'admin' | 'caixa' | 'operador'
export type MesaStatus = 'disponivel' | 'ocupada' | 'reservada' | 'manutencao'
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
  carvao_por_rosh: number
  imagem_url: string | null
  cost_price: number
  unit_type: string
  package_quantity: number
  avg_cost: number
  last_purchase_at: string | null
  created_at: string
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

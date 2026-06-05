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
  created_at: string
  categorias?: Categoria
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
  created_at: string
  mesas?: Mesa
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

export interface PedidoItem {
  id: number
  pedido_id: number
  product_id: number | null
  nome_produto: string
  preco_unitario: number
  quantidade: number
  total_item: number
  is_rosh: boolean
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

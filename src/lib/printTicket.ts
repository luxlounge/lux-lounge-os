export interface PrintTicketItem {
  quantidade: number
  nome: string
  options: string[]
}

export interface PrintTicket {
  mesa: number | null
  pedidoId: number
  setor: string
  horario: string
  items: PrintTicketItem[]
  observacao: string | null
}

export function buildPrintTicket(pedido: {
  id: number
  observacao: string | null
  created_at: string
  mesa_numero: number | null
  pedido_itens: {
    id: number
    nome_produto: string
    quantidade: number
    selected_options: { group_nome: string; option_nome: string }[] | null
  }[]
}, setor: string): PrintTicket {
  return {
    mesa: pedido.mesa_numero,
    pedidoId: pedido.id,
    setor,
    horario: new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    observacao: pedido.observacao,
    items: pedido.pedido_itens.map(item => ({
      quantidade: item.quantidade,
      nome: item.nome_produto,
      options: (item.selected_options ?? []).map(o => o.option_nome),
    })),
  }
}

export function renderTicketText(t: PrintTicket): string {
  const lines: string[] = []
  lines.push('================================')
  lines.push(`  LUX LOUNGE — ${t.setor}`)
  lines.push('================================')
  lines.push(`Mesa: ${t.mesa ?? '?'}        Pedido #${t.pedidoId}`)
  lines.push(`Horário: ${t.horario}`)
  lines.push('--------------------------------')
  for (const item of t.items) {
    lines.push(`${item.quantidade}x ${item.nome}`)
    for (const opt of item.options) {
      lines.push(`   • ${opt}`)
    }
  }
  if (t.observacao) {
    lines.push('--------------------------------')
    lines.push(`Obs: ${t.observacao}`)
  }
  lines.push('================================')
  return lines.join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function printTicket(ticket: PrintTicket): void {
  const text = escapeHtml(renderTicketText(ticket))
  const win = window.open('', '_blank', 'width=320,height=600')
  if (!win) return
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ticket #${ticket.pedidoId}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 13px; padding: 8px; background: #fff; color: #000; }
        pre { white-space: pre-wrap; word-break: break-word; }
        @media print {
          body { padding: 0; }
          button { display: none !important; }
        }
      </style>
    </head>
    <body>
      <pre>${text}</pre>
      <br/>
      <button onclick="window.print()" style="width:100%;padding:8px;font-size:14px;cursor:pointer;margin-top:4px">
        Imprimir
      </button>
    </body>
    </html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

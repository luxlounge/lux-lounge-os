import { supabase } from './supabase'

export type WppProvider = 'evolution' | 'zapi' | 'twilio'

interface WppConfig {
  ativo: boolean
  provider: WppProvider
  instance_url: string | null
  api_key: string | null
  instance_name: string | null
  base_url: string | null
}

interface WelcomePayload {
  phone: string
  mesaNumero: number
  mesaId: number
  comandaId: number
  clienteNome: string
  sessionToken: string
}

async function fetchConfig(): Promise<WppConfig | null> {
  const { data } = await supabase.from('whatsapp_config').select('*').eq('id', 1).single()
  return data ?? null
}

function buildSessionUrl(sessionToken: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/q/${sessionToken}`
}

async function sendViaEvolution(cfg: WppConfig, phone: string, message: string): Promise<void> {
  if (!cfg.instance_url || !cfg.api_key || !cfg.instance_name) {
    throw new Error('Evolution API: configuração incompleta (instance_url, api_key, instance_name obrigatórios)')
  }
  const url = `${cfg.instance_url}/message/sendText/${cfg.instance_name}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: cfg.api_key },
    body: JSON.stringify({ number: `55${phone}`, text: message }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Evolution API ${res.status}: ${body}`)
  }
}

async function sendViaZapi(cfg: WppConfig, phone: string, message: string): Promise<void> {
  if (!cfg.instance_url || !cfg.api_key) {
    throw new Error('Z-API: configuração incompleta (instance_url, api_key obrigatórios)')
  }
  const res = await fetch(`${cfg.instance_url}/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': cfg.api_key },
    body: JSON.stringify({ phone: `55${phone}`, message }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Z-API ${res.status}: ${body}`)
  }
}

async function sendViaTwilio(cfg: WppConfig, phone: string, message: string): Promise<void> {
  if (!cfg.base_url || !cfg.api_key || !cfg.instance_name) {
    throw new Error('Twilio: configuração incompleta (base_url = account_sid, api_key = auth_token, instance_name = from number)')
  }
  const [accountSid, authToken, from] = [cfg.base_url, cfg.api_key, cfg.instance_name]
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
    },
    body: new URLSearchParams({ From: `whatsapp:+${from}`, To: `whatsapp:+55${phone}`, Body: message }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Twilio ${res.status}: ${body}`)
  }
}

export async function sendWhatsAppWelcome(payload: WelcomePayload): Promise<void> {
  const cfg = await fetchConfig()
  if (!cfg || !cfg.ativo) return

  const sessionUrl = buildSessionUrl(payload.sessionToken)
  const message =
    `Olá, ${payload.clienteNome} 👋\n\n` +
    `Seja bem-vindo à Lux Lounge.\n\n` +
    `Sua mesa já está ativa.\n\n` +
    `Através deste link você poderá:\n\n` +
    `🍹 Fazer pedidos\n` +
    `🔥 Solicitar troca de rosh\n` +
    `🔔 Chamar atendimento\n` +
    `💳 Solicitar sua conta\n` +
    `📦 Acompanhar pedidos em tempo real\n\n` +
    `Acesse:\n\n` +
    `${sessionUrl}\n\n` +
    `Tenha uma ótima experiência.`

  const logPayload = { phone: payload.phone, provider: cfg.provider, mesaNumero: payload.mesaNumero }

  try {
    if (cfg.provider === 'evolution') await sendViaEvolution(cfg, payload.phone, message)
    else if (cfg.provider === 'zapi')  await sendViaZapi(cfg, payload.phone, message)
    else if (cfg.provider === 'twilio') await sendViaTwilio(cfg, payload.phone, message)

    await Promise.resolve(supabase.from('whatsapp_logs').insert({
      phone: payload.phone,
      mesa_id: payload.mesaId,
      comanda_id: payload.comandaId,
      status: 'sent',
      provider: cfg.provider,
      payload: logPayload,
    })).catch(() => {})
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    await Promise.resolve(supabase.from('whatsapp_logs').insert({
      phone: payload.phone,
      mesa_id: payload.mesaId,
      comanda_id: payload.comandaId,
      status: 'error',
      provider: cfg.provider,
      payload: logPayload,
      error_msg: errorMsg,
    })).catch(() => {})
    throw err
  }
}

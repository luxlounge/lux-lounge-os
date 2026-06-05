import { supabase } from './supabase'
import type { UserRole } from '../types'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getProfile(userId: string) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export async function createProfile(userId: string, nome: string, role: UserRole) {
  const { data, error } = await supabase.from('profiles').insert({ id: userId, nome, role }).select().single()
  if (error) throw error
  return data
}

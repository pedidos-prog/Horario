'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { BreakType, EntryType } from '@/types'

/** Registra un fichaje (entrada, salida, inicio/fin de parada) */
export async function registerTimeEntry(
  type: EntryType,
  breakType?: BreakType,
  breakLabel?: string,
  notes?: string
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'No autenticado' }
  }

  const { error } = await supabase.from('time_entries').insert({
    user_id: user.id,
    type,
    break_type: breakType ?? null,
    break_label: breakLabel ?? null,
    notes: notes ?? null,
    timestamp: new Date().toISOString(),
  })

  if (error) {
    console.error('Error registrando fichaje:', error)
    return { error: 'Error al registrar el fichaje' }
  }

  revalidatePath('/worker/clock')
  return { success: true }
}

/** Obtiene todos los fichajes del empleado para el día de hoy */
export async function getTodayEntries() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { data: null, error: 'No autenticado' }

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('timestamp', `${today}T00:00:00`)
    .lte('timestamp', `${today}T23:59:59`)
    .order('timestamp', { ascending: true })

  return { data, error: error?.message }
}

/** Obtiene historial de sesiones del empleado actual */
export async function getMyWorkSessions(limit = 30) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(limit)

  return { data, error: error?.message }
}

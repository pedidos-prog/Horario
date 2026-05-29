'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { BreakType, EntryType, TimeEntry } from '@/types'

/** Registra un fichaje (entrada, salida, inicio/fin de parada) */
export async function registerTimeEntry(
  type: EntryType,
  breakType?: BreakType,
  breakLabel?: string,
  notes?: string
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Verificar si hay un día anterior sin cerrar
  const { data: pendingEntries } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('timestamp', `${yesterday}T00:00:00`)
    .lt('timestamp', `${today}T00:00:00`)
    .order('timestamp', { ascending: false })

  if (pendingEntries && pendingEntries.length > 0) {
    const lastPending = pendingEntries[0]
    if (lastPending.type !== 'exit') {
      return {
        error: 'Tienes el fichaje de ayer sin cerrar. Ve a Historial para añadir la salida manualmente antes de continuar.'
      }
    }
  }

  // Obtener fichajes de hoy
  const { data: todayEntries } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('timestamp', `${today}T00:00:00`)
    .lte('timestamp', `${today}T23:59:59`)
    .order('timestamp', { ascending: false })

  const lastEntry = (todayEntries ?? [])[0] as TimeEntry | undefined

  // Validaciones de orden
  if (type === 'entry') {
    if (lastEntry && (lastEntry.type === 'entry' || lastEntry.type === 'break_end')) {
      return { error: 'Ya tienes la entrada fichada' }
    }
  }

  if (type === 'exit') {
    if (!lastEntry || lastEntry.type === 'exit') {
      return { error: 'Debes fichar la entrada primero' }
    }
    if (lastEntry.type === 'break_start') {
      return { error: 'Debes terminar la parada antes de fichar la salida' }
    }
  }

  if (type === 'break_start') {
    if (!lastEntry || lastEntry.type === 'exit' || lastEntry.type === 'break_start') {
      return { error: 'Debes fichar la entrada primero' }
    }
  }

  if (type === 'break_end') {
    if (!lastEntry || lastEntry.type !== 'break_start') {
      return { error: 'No tienes ninguna parada activa' }
    }
  }

  // Insertar fichaje
  const { error } = await supabase.from('time_entries').insert({
    user_id: user.id,
    type,
    break_type: breakType ?? null,
    break_label: breakLabel ?? null,
    notes: notes ?? null,
    timestamp: new Date().toISOString(),
  })

  if (error) return { error: 'Error al registrar el fichaje' }

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

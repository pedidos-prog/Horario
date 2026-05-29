'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { EntryType, BreakType } from '@/types'

/**
 * Empleado: corrige el timestamp de un fichaje propio ya existente
 * Queda registrado con motivo y quién lo hizo
 */
export async function correctTimeEntry(
  entryId: string,
  newTimestamp: string,
  reason: string
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  if (!reason.trim()) return { error: 'El motivo es obligatorio' }

  // Obtener fichaje original para verificar que es del empleado
  const { data: entry, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !entry) return { error: 'Fichaje no encontrado' }

  const originalTimestamp = entry.timestamp

  // Guardar corrección en el log
  const { error: correctionError } = await supabase
    .from('time_entry_corrections')
    .insert({
      time_entry_id: entryId,
      original_timestamp: originalTimestamp,
      corrected_timestamp: newTimestamp,
      reason: reason.trim(),
      corrected_by: user.id,
      corrected_by_role: 'employee',
    })

  if (correctionError) return { error: 'Error al registrar la corrección' }

  // Actualizar el fichaje
  const { error: updateError } = await supabase
    .from('time_entries')
    .update({
      timestamp: newTimestamp,
      is_corrected: true,
      corrected_at: new Date().toISOString(),
      corrected_by: user.id,
      corrected_by_role: 'employee',
    })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (updateError) return { error: 'Error al actualizar el fichaje' }

  // Recalcular sesión del día
  const date = newTimestamp.split('T')[0]
  await supabase.rpc('calculate_work_session', {
    p_user_id: user.id,
    p_date: date,
  })

  revalidatePath('/worker/history')
  revalidatePath('/worker/clock')
  return { success: true }
}

/**
 * Empleado: añade un fichaje manual para un momento pasado que se olvidó registrar
 */
export async function addManualTimeEntry(
  type: EntryType,
  manualTimestamp: string,
  reason: string,
  breakType?: BreakType,
  breakLabel?: string
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  if (!reason.trim()) return { error: 'El motivo es obligatorio' }

  // No permitir fichajes futuros
  if (new Date(manualTimestamp) > new Date()) {
    return { error: 'No se puede registrar un fichaje en el futuro' }
  }

  const { error } = await supabase.from('time_entries').insert({
    user_id: user.id,
    type,
    break_type: breakType ?? null,
    break_label: breakLabel ?? null,
    timestamp: manualTimestamp,
    notes: `[MANUAL] ${reason.trim()}`,
    is_manual: true,
  })

  if (error) return { error: 'Error al registrar el fichaje manual' }

  // Registrar también en el log de correcciones como referencia
  const { data: newEntry } = await supabase
    .from('time_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('timestamp', manualTimestamp)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (newEntry) {
    await supabase.from('time_entry_corrections').insert({
      time_entry_id: newEntry.id,
      original_timestamp: manualTimestamp,
      corrected_timestamp: manualTimestamp,
      reason: `Fichaje manual añadido: ${reason.trim()}`,
      corrected_by: user.id,
      corrected_by_role: 'employee',
    })
  }

  revalidatePath('/worker/history')
  revalidatePath('/worker/clock')
  return { success: true }
}

/**
 * ADMIN: corrige el timestamp de cualquier fichaje
 */
export async function adminCorrectTimeEntry(
  entryId: string,
  newTimestamp: string,
  reason: string
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Sin permisos' }
  if (!reason.trim()) return { error: 'El motivo es obligatorio' }

  const { data: entry, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .single()

  if (fetchError || !entry) return { error: 'Fichaje no encontrado' }

  // Log de corrección
  const { error: correctionError } = await supabase
    .from('time_entry_corrections')
    .insert({
      time_entry_id: entryId,
      original_timestamp: entry.timestamp,
      corrected_timestamp: newTimestamp,
      reason: reason.trim(),
      corrected_by: user.id,
      corrected_by_role: 'admin',
    })

  if (correctionError) return { error: 'Error al registrar la corrección' }

  // Actualizar fichaje
  const { error: updateError } = await supabase
    .from('time_entries')
    .update({
      timestamp: newTimestamp,
      is_corrected: true,
      corrected_at: new Date().toISOString(),
      corrected_by: user.id,
      corrected_by_role: 'admin',
    })
    .eq('id', entryId)

  if (updateError) return { error: 'Error al actualizar el fichaje' }

  // Recalcular sesión del día original y del nuevo día (si cambia)
  const originalDate = entry.timestamp.split('T')[0]
  const newDate = newTimestamp.split('T')[0]

  await supabase.rpc('calculate_work_session', {
    p_user_id: entry.user_id,
    p_date: originalDate,
  })
  if (newDate !== originalDate) {
    await supabase.rpc('calculate_work_session', {
      p_user_id: entry.user_id,
      p_date: newDate,
    })
  }

  revalidatePath('/admin/dashboard')
  return { success: true }
}

/**
 * ADMIN: añade un fichaje manual para un empleado
 */
export async function adminAddManualTimeEntry(
  userId: string,
  type: EntryType,
  manualTimestamp: string,
  reason: string,
  breakType?: BreakType
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Sin permisos' }
  if (!reason.trim()) return { error: 'El motivo es obligatorio' }

  const { error } = await supabase.from('time_entries').insert({
    user_id: userId,
    type,
    break_type: breakType ?? null,
    timestamp: manualTimestamp,
    notes: `[ADMIN] ${reason.trim()}`,
    is_manual: true,
    is_corrected: true,
    corrected_at: new Date().toISOString(),
    corrected_by: user.id,
    corrected_by_role: 'admin',
  })

  if (error) return { error: 'Error al registrar el fichaje manual' }

  const date = manualTimestamp.split('T')[0]
  await supabase.rpc('calculate_work_session', { p_user_id: userId, p_date: date })

  revalidatePath('/admin/dashboard')
  return { success: true }
}

/**
 * Obtiene los fichajes de un día concreto con sus correcciones
 */
export async function getDayEntriesWithCorrections(date: string, userId?: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'No autenticado' }

  const targetUserId = userId ?? user.id

  // Si se pide otro usuario, verificar que es admin
  if (userId && userId !== user.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') return { data: null, error: 'Sin permisos' }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .select('*, time_entry_corrections(*)')
    .eq('user_id', targetUserId)
    .gte('timestamp', `${date}T00:00:00`)
    .lte('timestamp', `${date}T23:59:59`)
    .order('timestamp', { ascending: true })

  return { data, error: error?.message }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { countWorkingDays } from '@/lib/clock'

/** Crea una nueva solicitud de vacaciones */
export async function createVacationRequest(
  startDate: string,
  endDate: string,
  notes?: string
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: 'No autenticado' }

  // Calcular días laborables
  const daysCount = countWorkingDays(new Date(startDate), new Date(endDate))

  if (daysCount <= 0) {
    return { error: 'El rango de fechas no incluye días laborables' }
  }

  // Verificar días disponibles
  const { data: profile } = await supabase
    .from('profiles')
    .select('vacation_days_total, vacation_days_used')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Perfil no encontrado' }

  const available = profile.vacation_days_total - profile.vacation_days_used
  if (daysCount > available) {
    return { error: `Solo tienes ${available} días disponibles` }
  }

  // Verificar que no hay solicitud pendiente o aprobada en esas fechas
  const { data: existing } = await supabase
    .from('vacation_requests')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['pending', 'approved'])
    .lte('start_date', endDate)
    .gte('end_date', startDate)

  if (existing && existing.length > 0) {
    return { error: 'Ya tienes una solicitud en esas fechas' }
  }

  const { error } = await supabase.from('vacation_requests').insert({
    user_id: user.id,
    start_date: startDate,
    end_date: endDate,
    days_count: daysCount,
    notes: notes ?? null,
  })

  if (error) {
    console.error('Error creando solicitud:', error)
    return { error: 'Error al crear la solicitud' }
  }

  revalidatePath('/worker/vacations')
  return { success: true, daysCount }
}

/** Obtiene las solicitudes de vacaciones del empleado actual */
export async function getMyVacationRequests() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return { data, error: error?.message }
}

/** ADMIN: Aprueba o rechaza una solicitud de vacaciones */
export async function reviewVacationRequest(
  requestId: string,
  action: 'approved' | 'rejected',
  adminNotes?: string
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: 'No autenticado' }

  // Verificar que es admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Sin permisos' }

  // Obtener la solicitud
  const { data: request } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (!request) return { error: 'Solicitud no encontrada' }

  // Actualizar solicitud
  const { error: updateError } = await supabase
    .from('vacation_requests')
    .update({
      status: action,
      admin_notes: adminNotes ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) return { error: 'Error al actualizar la solicitud' }

  // Si se aprueba, actualizar días usados del empleado
  if (action === 'approved') {
    await supabase.rpc('increment_vacation_days_used', {
      p_user_id: request.user_id,
      p_days: request.days_count,
    })
  }

  // Si se rechaza y antes estaba aprobada, devolver días
  if (action === 'rejected' && request.status === 'approved') {
    await supabase.rpc('decrement_vacation_days_used', {
      p_user_id: request.user_id,
      p_days: request.days_count,
    })
  }

  revalidatePath('/admin/vacations')
  return { success: true }
}

/** ADMIN: Obtiene todas las solicitudes con perfil de empleado */
export async function getAllVacationRequests(status?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('vacation_requests')
    .select('*, profiles(full_name, email, department)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  return { data, error: error?.message }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { countWorkingDays } from '@/lib/clock'
import { VacationRequest, VacationStatus } from '@/types'

type VacationRequestWithProfile = VacationRequest & {
  profiles: { full_name: string; email: string; department: string | null } | null
}

/** Crea una nueva solicitud de vacaciones */
export async function createVacationRequest(
  startDate: string,
  endDate: string,
  notes?: string
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  const daysCount = countWorkingDays(new Date(startDate), new Date(endDate))
  if (daysCount <= 0) return { error: 'El rango de fechas no incluye días laborables' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('vacation_days_total, vacation_days_used')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Perfil no encontrado' }

  const available = profile.vacation_days_total - profile.vacation_days_used
  if (daysCount > available) return { error: `Solo tienes ${available} días disponibles` }

  const { data: existing } = await supabase
    .from('vacation_requests')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['pending', 'approved'])
    .lte('start_date', endDate)
    .gte('end_date', startDate)

  if (existing && existing.length > 0) return { error: 'Ya tienes una solicitud en esas fechas' }

  const { error } = await supabase.from('vacation_requests').insert({
    user_id: user.id,
    start_date: startDate,
    end_date: endDate,
    days_count: daysCount,
    notes: notes ?? null,
  })

  if (error) return { error: 'Error al crear la solicitud' }

  revalidatePath('/worker/vacations')
  return { success: true, daysCount }
}

/** Obtiene las solicitudes de vacaciones del empleado actual */
export async function getMyVacationRequests(): Promise<{
  data: VacationRequest[] | null
  error: string | undefined
}> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return { data: (data ?? null) as VacationRequest[] | null, error: error?.message }
}

/** ADMIN: Aprueba o rechaza una solicitud de vacaciones */
export async function reviewVacationRequest(
  requestId: string,
  action: 'approved' | 'rejected',
  adminNotes?: string
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

  const { data: request } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (!request) return { error: 'Solicitud no encontrada' }

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

  if (action === 'approved') {
    await supabase.rpc('increment_vacation_days_used', {
      p_user_id: request.user_id,
      p_days: request.days_count,
    })
  }

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
export async function getAllVacationRequests(status?: string): Promise<{
  data: VacationRequestWithProfile[] | null
  error: string | undefined
}> {
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
    .from('vacation_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data: vacations, error } = await query

  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log('vacations count:', vacations?.length)
  console.log('error:', JSON.stringify(error))

  if (error || !vacations) return { data: null, error: error?.message } 

  // Obtener perfiles por separado
  const userIds = Array.from(new Set(vacations.map((v: any) => v.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, department')
    .in('id', userIds)

  console.log('vacations antes del map:', JSON.stringify(vacations))
  console.log('profiles antes del map:', JSON.stringify(profiles)) 

  const data = vacations.map((v: any) => ({
    ...v,
    profiles: profiles?.find((p: any) => p.id === v.user_id) ?? null,
  }))
  console.log('profiles count:', profiles?.length)
  console.log('userIds:', JSON.stringify(userIds))
  console.log('data final:', JSON.stringify(data))
  return { data: data as VacationRequestWithProfile[], error: undefined }
}
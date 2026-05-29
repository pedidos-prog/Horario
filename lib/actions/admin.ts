'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Obtiene el estado de presencia de todos los empleados hoy */
export async function getTodayPresence() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(`
      *,
      work_sessions!inner(
        date, entry_time, exit_time, total_minutes, break_minutes, overtime_minutes, status
      )
    `)
    .eq('active', true)
    .eq('role', 'employee')
    .eq('work_sessions.date', today)

  // También obtener empleados sin sesión hoy
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('active', true)
    .eq('role', 'employee')

  const { data: todaySessions } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('date', today)

  // Obtener último fichaje de cada empleado hoy
  const { data: todayEntries } = await supabase
    .from('time_entries')
    .select('*')
    .gte('timestamp', `${today}T00:00:00`)
    .lte('timestamp', `${today}T23:59:59`)
    .order('timestamp', { ascending: false })

  return {
    profiles: allProfiles ?? [],
    sessions: todaySessions ?? [],
    entries: todayEntries ?? [],
    error: error?.message,
  }
}

/** ADMIN: Obtiene resumen de horas por empleado en un rango */
export async function getWorkSummary(startDate: string, endDate: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('work_sessions')
    .select('*, profiles(full_name, email, department)')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  return { data, error: error?.message }
}

/** ADMIN: Da de alta un nuevo empleado con contraseña */
export async function createEmployee(
  email: string,
  fullName: string,
  password: string,
  department?: string,
  vacationDays = 22
) {
  const supabase = await createClient()

  // Crear usuario con email y contraseña
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authError) {
    return { error: authError.message }
  }

  // Actualizar perfil con datos adicionales
  if (authData.user) {
    await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        department: department ?? null,
        vacation_days_total: vacationDays,
      })
      .eq('id', authData.user.id)
  }

  revalidatePath('/admin/workers')
  return { success: true }
}

/** ADMIN: Actualiza datos de un empleado */
export async function updateEmployee(
  userId: string,
  updates: {
    full_name?: string
    department?: string
    vacation_days_total?: number
    active?: boolean
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/workers')
  return { success: true }
}

/** ADMIN: Obtiene alertas del día (tardanzas y ausencias) */
export async function getTodayAlerts(workStartHour = 9) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()

  // Solo generar alertas si ya pasó la hora de entrada
  if (now.getHours() < workStartHour) return { alerts: [] }

  const { profiles, sessions } = await getTodayPresence()

  const alerts = []

  for (const profile of profiles) {
    const session = sessions.find((s: { user_id: string }) => s.user_id === profile.id)

    if (!session || !session.entry_time) {
      // No ha fichado entrada
      alerts.push({
        type: 'absent' as const,
        profile,
        message: 'No ha fichado entrada',
      })
    } else {
      // Verificar tardanza (más de 15 min respecto a hora esperada)
      const entryHour = new Date(session.entry_time).getHours()
      const entryMin = new Date(session.entry_time).getMinutes()
      const entryTotal = entryHour * 60 + entryMin
      const expectedTotal = workStartHour * 60

      if (entryTotal > expectedTotal + 15) {
        const delay = entryTotal - expectedTotal
        alerts.push({
          type: 'late' as const,
          profile,
          message: `Tardanza de ${delay} minutos`,
        })
      }
    }
  }

  return { alerts }
}

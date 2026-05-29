import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Verificar admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Parámetros de fecha
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start') ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const endDate = searchParams.get('end') ?? new Date().toISOString().split('T')[0]

  // Obtener datos
  const { data: sessions } = await supabase
    .from('work_sessions')
    .select('*, profiles(full_name, email, department)')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  // Crear Excel
  const wb = XLSX.utils.book_new()

  // Hoja 1: Resumen por empleado
  const summaryData = sessions?.reduce<Record<string, {
    Nombre: string; Email: string; Departamento: string;
    'Días trabajados': number; 'Horas totales': string; 'Horas extra': string;
  }>>((acc, s) => {
    const key = (s as { profiles?: { email: string } }).profiles?.email ?? s.user_id
    const prof = (s as { profiles?: { full_name: string; email: string; department?: string } }).profiles
    if (!acc[key]) {
      acc[key] = {
        Nombre: prof?.full_name ?? '',
        Email: prof?.email ?? '',
        Departamento: prof?.department ?? '',
        'Días trabajados': 0,
        'Horas totales': '0h 0m',
        'Horas extra': '0h 0m',
      }
    }
    acc[key]['Días trabajados'] += s.status === 'complete' ? 1 : 0
    const totalMins = (parseInt(acc[key]['Horas totales']) || 0) + s.total_minutes
    const extraMins = (parseInt(acc[key]['Horas extra']) || 0) + s.overtime_minutes
    acc[key]['Horas totales'] = `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`
    acc[key]['Horas extra'] = `${Math.floor(extraMins / 60)}h ${extraMins % 60}m`
    return acc
  }, {}) ?? {}

  const wsSummary = XLSX.utils.json_to_sheet(Object.values(summaryData))
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')

  // Hoja 2: Detalle de sesiones
  const detailRows = sessions?.map((s) => {
    const prof = (s as { profiles?: { full_name: string; email: string; department?: string } }).profiles
    const totalH = Math.floor(s.total_minutes / 60)
    const totalM = s.total_minutes % 60
    return {
      Empleado: prof?.full_name ?? '',
      Email: prof?.email ?? '',
      Departamento: prof?.department ?? '',
      Fecha: s.date,
      Entrada: s.entry_time ? new Date(s.entry_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
      Salida: s.exit_time ? new Date(s.exit_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
      'Min. paradas': s.break_minutes,
      'Horas netas': `${totalH}h ${totalM}m`,
      'Min. extra': s.overtime_minutes,
      Estado: s.status === 'complete' ? 'Completo' : s.status === 'absent' ? 'Ausente' : 'Incompleto',
    }
  }) ?? []

  const wsDetail = XLSX.utils.json_to_sheet(detailRows)
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle')

  // Generar buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="control-horario-${startDate}-${endDate}.xlsx"`,
    },
  })
}

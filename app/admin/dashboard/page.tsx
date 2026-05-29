import { createClient } from '@/lib/supabase/server'
import { getTodayPresence, getTodayAlerts } from '@/lib/actions/admin'
import { getAllVacationRequests, reviewVacationRequest } from '@/lib/actions/vacations'
import { minutesToDuration, formatTime, BREAK_LABELS } from '@/lib/clock'
import { BreakType, TimeEntry } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const { profiles, sessions, entries } = await getTodayPresence()
  const { alerts } = await getTodayAlerts()
  const { data: pendingVacations } = await getAllVacationRequests('pending')

  const totalWorking = profiles.filter((p: { id: string }) => {
    const session = sessions.find((s: { user_id: string }) => s.user_id === p.id)
    return session?.entry_time && !session?.exit_time
  }).length

  const totalOnBreak = profiles.filter((p: { id: string }) => {
    const lastEntry = (entries as TimeEntry[])
      .filter((e) => e.user_id === p.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    return lastEntry?.type === 'break_start'
  }).length

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Panel de control</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Empleados activos</p>
          <p className="text-3xl font-semibold text-gray-900">{profiles.length}</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4">
          <p className="text-xs text-green-600 mb-1">Trabajando ahora</p>
          <p className="text-3xl font-semibold text-green-700">{totalWorking - totalOnBreak}</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4">
          <p className="text-xs text-red-500 mb-1">Alertas</p>
          <p className="text-3xl font-semibold text-red-600">{alerts.length}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-xs text-blue-500 mb-1">Vacaciones pendientes</p>
          <p className="text-3xl font-semibold text-blue-700">{pendingVacations?.length ?? 0}</p>
        </div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="bg-white border border-red-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-red-100 bg-red-50">
            <h2 className="text-sm font-semibold text-red-700">⚠ Alertas del día</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {alerts.map((alert, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{alert.profile.full_name}</p>
                  <p className="text-xs text-gray-400">{alert.profile.department ?? 'Sin departamento'}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  alert.type === 'absent' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {alert.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de presencia */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Presencia hoy</h2>
          <a href="/admin/export" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            ↓ Exportar Excel
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Empleado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Entrada</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Paradas</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Horas netas</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {profiles.map((profile: { id: string; full_name: string; department?: string }) => {
                const session = sessions.find((s: { user_id: string }) => s.user_id === profile.id)
                const lastEntry = (entries as TimeEntry[])
                  .filter((e) => e.user_id === profile.id)
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

                const isOnBreak = lastEntry?.type === 'break_start'
                const isWorking = session?.entry_time && !session?.exit_time
                const isOnVacation = false // TODO: conectar con vacation_requests

                const status = !session?.entry_time
                  ? { label: 'Sin fichar', style: 'bg-gray-50 text-gray-500' }
                  : isOnBreak
                  ? { label: `Parada · ${lastEntry.break_type ? BREAK_LABELS[lastEntry.break_type as BreakType] : ''}`, style: 'bg-amber-50 text-amber-700' }
                  : isWorking
                  ? { label: 'Trabajando', style: 'bg-green-50 text-green-700' }
                  : { label: 'Salida registrada', style: 'bg-blue-50 text-blue-700' }

                return (
                  <tr key={profile.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{profile.full_name}</p>
                      {profile.department && <p className="text-xs text-gray-400">{profile.department}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 tabular-nums">
                      {formatTime(session?.entry_time ?? null)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {session?.break_minutes ? minutesToDuration(session.break_minutes) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 tabular-nums">
                      {session?.total_minutes ? minutesToDuration(session.total_minutes) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.style}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Solicitudes de vacaciones pendientes */}
      {pendingVacations && pendingVacations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Vacaciones pendientes de aprobación</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingVacations.map((req) => (
              <div key={req.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {req.profiles?.full_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(req.start_date).toLocaleDateString('es-ES')} → {new Date(req.end_date).toLocaleDateString('es-ES')} · {req.days_count} días
                  </p>
                  {req.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{req.notes}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <form action={async () => {
                    'use server'
                    await reviewVacationRequest(req.id, 'approved')
                  }}>
                    <button type="submit" className="text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium px-3 py-1.5 rounded-lg transition-colors">
                      Aprobar
                    </button>
                  </form>
                  <form action={async () => {
                    'use server'
                    await reviewVacationRequest(req.id, 'rejected')
                  }}>
                    <button type="submit" className="text-xs bg-red-50 hover:bg-red-100 text-red-700 font-medium px-3 py-1.5 rounded-lg transition-colors">
                      Rechazar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

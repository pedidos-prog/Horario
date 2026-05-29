import { getAllVacationRequests, reviewVacationRequest } from '@/lib/actions/vacations'
import { VacationStatus } from '@/types'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<VacationStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

const STATUS_STYLES: Record<VacationStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

export default async function AdminVacationsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const filter = searchParams.status ?? ''
  const { data: requests } = await getAllVacationRequests(filter || undefined)

  const pending = requests?.filter((r) => r.status === 'pending').length ?? 0

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Vacaciones</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {pending > 0 ? `${pending} solicitudes pendientes de revisión` : 'Sin solicitudes pendientes'}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { label: 'Todas', value: '' },
          { label: 'Pendientes', value: 'pending' },
          { label: 'Aprobadas', value: 'approved' },
          { label: 'Rechazadas', value: 'rejected' },
        ].map((f) => (
          <a
            key={f.value}
            href={f.value ? `/admin/vacations?status=${f.value}` : '/admin/vacations'}
            className={`text-sm px-4 py-1.5 rounded-xl border transition-colors ${
              filter === f.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {!requests || requests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No hay solicitudes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Período</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Días</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Notas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{req.profiles?.full_name}</p>
                      <p className="text-xs text-gray-400">{req.profiles?.department ?? req.profiles?.email}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-600 tabular-nums">
                      {new Date(req.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      {' → '}
                      {new Date(req.end_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-4 text-gray-600">{req.days_count}</td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[req.status as VacationStatus]}`}>
                        {STATUS_LABELS[req.status as VacationStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-400 max-w-[160px] truncate">
                      {req.notes ?? '—'}
                    </td>
                    <td className="px-4 py-4">
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <form action={async () => {
                            'use server'
                            await reviewVacationRequest(req.id, 'approved')
                          }}>
                            <button
                              type="submit"
                              className="text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Aprobar
                            </button>
                          </form>
                          <form action={async () => {
                            'use server'
                            await reviewVacationRequest(req.id, 'rejected')
                          }}>
                            <button
                              type="submit"
                              className="text-xs bg-red-50 hover:bg-red-100 text-red-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Rechazar
                            </button>
                          </form>
                        </div>
                      )}
                      {req.status !== 'pending' && req.reviewed_at && (
                        <p className="text-xs text-gray-300">
                          {new Date(req.reviewed_at).toLocaleDateString('es-ES')}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

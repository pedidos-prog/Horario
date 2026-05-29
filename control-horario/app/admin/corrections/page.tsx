import { createClient } from '@/lib/supabase/server'
import { adminCorrectTimeEntry, adminAddManualTimeEntry, getDayEntriesWithCorrections } from '@/lib/actions/corrections'
import { Profile, EntryType, BreakType } from '@/types'

export const dynamic = 'force-dynamic'

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  entry: '↩ Entrada',
  exit: '↪ Salida',
  break_start: '⏸ Inicio parada',
  break_end: '▶ Fin parada',
}

const BREAK_LABELS: Record<BreakType, string> = {
  food: 'Comida',
  medical: 'Médico',
  personal: 'Personal',
  other: 'Otra',
}

export default async function AdminCorrectionsPage({
  searchParams,
}: {
  searchParams: { user_id?: string; date?: string }
}) {
  const supabase = await createClient()

  const { data: workers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .eq('active', true)
    .order('full_name')

  const selectedUserId = searchParams.user_id ?? workers?.[0]?.id
  const selectedDate = searchParams.date ?? new Date().toISOString().split('T')[0]

  const { data: entries } = selectedUserId
    ? await getDayEntriesWithCorrections(selectedDate, selectedUserId)
    : { data: null }

  const selectedWorker = (workers as Profile[])?.find((w) => w.id === selectedUserId)

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Corrección de fichajes</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Todas las modificaciones quedan registradas con tu nombre y el motivo
        </p>
      </div>

      {/* Aviso */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
        ⚠ Las correcciones realizadas desde admin quedan marcadas como <strong>«corregido por administrador»</strong> y son visibles para el empleado.
      </div>

      {/* Selector empleado y fecha */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <form method="GET" className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-gray-500 block mb-1">Empleado</label>
            <select
              name="user_id"
              defaultValue={selectedUserId}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            >
              {(workers as Profile[])?.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Fecha</label>
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              max={new Date().toISOString().split('T')[0]}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <button
            type="submit"
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            Ver fichajes
          </button>
        </form>
      </div>

      {/* Fichajes del día */}
      {selectedWorker && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-gray-900">{selectedWorker.full_name}</p>
              <p className="text-xs text-gray-400">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {!entries || entries.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-400 mb-4">Sin fichajes para este día</p>
              {/* Añadir primero manual */}
              <AddManualForm
                userId={selectedUserId!}
                date={selectedDate}
                label="Añadir fichaje manual"
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(entries as any[]).map((entry) => (
                <div key={entry.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-700">
                          {ENTRY_TYPE_LABELS[entry.type as EntryType]}
                          {entry.break_type && ` · ${BREAK_LABELS[entry.break_type as BreakType]}`}
                        </p>
                        <p className="text-base font-semibold text-gray-900 tabular-nums">
                          {new Date(entry.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {/* Badges */}
                        {entry.is_manual && !entry.is_corrected && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">manual (empleado)</span>
                        )}
                        {entry.is_corrected && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            entry.corrected_by_role === 'admin'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {entry.corrected_by_role === 'admin' ? 'corregido por admin' : 'corregido por empleado'}
                          </span>
                        )}
                      </div>
                      {/* Log de correcciones anteriores */}
                      {entry.time_entry_corrections?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {entry.time_entry_corrections.map((c: any, i: number) => (
                            <p key={i} className="text-xs text-gray-400">
                              {c.corrected_by_role === 'admin' ? '👤 Admin' : '✏️ Empleado'} ·{' '}
                              {new Date(c.original_timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              {' → '}
                              {new Date(c.corrected_timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              {' · '}<span className="italic">{c.reason}</span>
                              {' · '}{new Date(c.created_at).toLocaleDateString('es-ES')}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Formulario corrección inline */}
                    <CorrectEntryForm entryId={entry.id} currentTimestamp={entry.timestamp} />
                  </div>
                </div>
              ))}

              {/* Añadir fichaje manual al día */}
              <div className="px-5 py-4 bg-gray-50">
                <AddManualForm userId={selectedUserId!} date={selectedDate} label="+ Añadir fichaje manual a este día" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Formulario de corrección de un fichaje existente
function CorrectEntryForm({ entryId, currentTimestamp }: { entryId: string; currentTimestamp: string }) {
  const currentTime = new Date(currentTimestamp).toTimeString().slice(0, 5)
  return (
    <form
      action={async (formData: FormData) => {
        'use server'
        const time = formData.get('new_time') as string
        const reason = formData.get('reason') as string
        const date = currentTimestamp.split('T')[0]
        const newTimestamp = `${date}T${time}:00`
        await adminCorrectTimeEntry(entryId, newTimestamp, reason)
      }}
      className="flex flex-col gap-2 min-w-[200px]"
    >
      <div className="flex gap-2">
        <input
          type="time"
          name="new_time"
          defaultValue={currentTime}
          required
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 w-24"
        />
        <button
          type="submit"
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          Corregir
        </button>
      </div>
      <input
        type="text"
        name="reason"
        required
        placeholder="Motivo obligatorio"
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 w-full"
      />
    </form>
  )
}

// Formulario para añadir fichaje manual desde admin
function AddManualForm({ userId, date, label }: { userId: string; date: string; label: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        'use server'
        const type = formData.get('type') as EntryType
        const time = formData.get('time') as string
        const reason = formData.get('reason') as string
        const timestamp = `${date}T${time}:00`
        await adminAddManualTimeEntry(userId, type, timestamp, reason)
      }}
      className="flex flex-wrap gap-2 items-end"
    >
      <select
        name="type"
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
      >
        <option value="entry">↩ Entrada</option>
        <option value="exit">↪ Salida</option>
        <option value="break_start">⏸ Inicio parada</option>
        <option value="break_end">▶ Fin parada</option>
      </select>
      <input
        type="time"
        name="time"
        required
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
      />
      <input
        type="text"
        name="reason"
        required
        placeholder="Motivo (obligatorio)"
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 min-w-[180px]"
      />
      <button
        type="submit"
        className="text-xs bg-gray-800 hover:bg-gray-900 text-white font-medium px-3 py-1.5 rounded-lg"
      >
        {label}
      </button>
    </form>
  )
}

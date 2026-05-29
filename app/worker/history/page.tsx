'use client'

import { useState, useEffect, useCallback } from 'react'
import { getMyWorkSessions, getTodayEntries } from '@/lib/actions/clock'
import { getDayEntriesWithCorrections } from '@/lib/actions/corrections'
import { correctTimeEntry, addManualTimeEntry } from '@/lib/actions/corrections'
import { WorkSession, EntryType, BreakType } from '@/types'
import { minutesToDuration, BREAK_LABELS } from '@/lib/clock'

type EntryWithCorrections = {
  id: string
  type: EntryType
  timestamp: string
  break_type: BreakType | null
  break_label: string | null
  notes: string | null
  is_manual: boolean
  is_corrected: boolean
  corrected_by_role: 'employee' | 'admin' | null
  time_entry_corrections?: {
    reason: string
    corrected_by_role: string
    created_at: string
    original_timestamp: string
    corrected_timestamp: string
  }[]
}

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  entry: '↩ Entrada',
  exit: '↪ Salida',
  break_start: '⏸ Inicio parada',
  break_end: '▶ Fin parada',
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [dayEntries, setDayEntries] = useState<EntryWithCorrections[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)

  // Estado para el modal de corrección
  const [correctingEntry, setCorrectingEntry] = useState<EntryWithCorrections | null>(null)
  const [newTime, setNewTime] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Estado para añadir fichaje manual
  const [showAddManual, setShowAddManual] = useState(false)
  const [manualType, setManualType] = useState<EntryType>('entry')
  const [manualDate, setManualDate] = useState('')
  const [manualTime, setManualTime] = useState('')
  const [manualReason, setManualReason] = useState('')

  const loadSessions = useCallback(async () => {
    const { data } = await getMyWorkSessions(60)
    if (data) setSessions(data as WorkSession[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const expandDay = async (date: string) => {
    if (expandedDate === date) {
      setExpandedDate(null)
      return
    }
    setExpandedDate(date)
    setLoadingEntries(true)
    const { data } = await getDayEntriesWithCorrections(date)
    if (data) setDayEntries(data as EntryWithCorrections[])
    setLoadingEntries(false)
  }

  const openCorrection = (entry: EntryWithCorrections) => {
    setCorrectingEntry(entry)
    // Precargar la hora actual del fichaje
    const d = new Date(entry.timestamp)
    setNewTime(d.toTimeString().slice(0, 5)) // "HH:MM"
    setReason('')
    setFormError('')
  }

  const handleCorrect = async () => {
    if (!correctingEntry || !newTime || !reason.trim()) {
      setFormError('Indica la nueva hora y el motivo')
      return
    }
    setSubmitting(true)
    setFormError('')
    // Reconstruir timestamp con la misma fecha pero nueva hora
    const datePart = correctingEntry.timestamp.split('T')[0]
    const newTimestamp = `${datePart}T${newTime}:00`
    const result = await correctTimeEntry(correctingEntry.id, newTimestamp, reason)
    if (result.error) {
      setFormError(result.error)
    } else {
      setCorrectingEntry(null)
      await loadSessions()
      if (expandedDate) {
        const { data } = await getDayEntriesWithCorrections(expandedDate)
        if (data) setDayEntries(data as EntryWithCorrections[])
      }
    }
    setSubmitting(false)
  }

  const handleAddManual = async () => {
    if (!manualDate || !manualTime || !manualReason.trim()) {
      setFormError('Rellena todos los campos y el motivo')
      return
    }
    setSubmitting(true)
    setFormError('')
    const timestamp = `${manualDate}T${manualTime}:00`
    const result = await addManualTimeEntry(manualType, timestamp, manualReason)
    if (result.error) {
      setFormError(result.error)
    } else {
      setShowAddManual(false)
      setManualDate('')
      setManualTime('')
      setManualReason('')
      await loadSessions()
      if (expandedDate === manualDate) {
        const { data } = await getDayEntriesWithCorrections(manualDate)
        if (data) setDayEntries(data as EntryWithCorrections[])
      }
    }
    setSubmitting(false)
  }

  // Agrupar por mes
  const grouped = sessions.reduce<Record<string, WorkSession[]>>((acc, s) => {
    const key = s.date.slice(0, 7)
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })
  }

  const totalHoursMonth = sessions
    .filter((s) => s.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((acc, s) => acc + s.total_minutes, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="max-w-sm mx-auto px-4 py-6 space-y-4">

      {/* Resumen del mes */}
      <div className="bg-blue-50 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-blue-500">Este mes</p>
          <p className="text-2xl font-semibold text-blue-700">{minutesToDuration(totalHoursMonth)}</p>
        </div>
        <button
          onClick={() => setShowAddManual(true)}
          className="text-xs bg-white border border-blue-200 text-blue-600 font-medium px-3 py-2 rounded-xl"
        >
          + Añadir fichaje olvidado
        </button>
      </div>

      {/* Formulario añadir fichaje manual */}
      {showAddManual && (
        <div className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Añadir fichaje que olvidé registrar</p>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Este fichaje quedará marcado como manual y visible para el administrador.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['entry', 'exit', 'break_start', 'break_end'] as EntryType[]).map((t) => (
              <button
                key={t}
                onClick={() => setManualType(t)}
                className={`text-xs py-2 px-3 rounded-xl border transition-colors ${
                  manualType === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                {ENTRY_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha</label>
              <input
                type="date"
                value={manualDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Hora</label>
              <input
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Motivo *</label>
            <input
              type="text"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="Ej: Se me olvidó fichar al llegar"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAddManual}
              disabled={submitting}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-xl text-sm disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar fichaje'}
            </button>
            <button
              onClick={() => { setShowAddManual(false); setFormError('') }}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Historial por mes */}
      {Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map((monthKey) => (
        <div key={monthKey} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide capitalize">
              {monthLabel(monthKey)}
            </p>
            <p className="text-xs text-gray-400">
              {minutesToDuration(grouped[monthKey].reduce((a, s) => a + s.total_minutes, 0))} netas
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {grouped[monthKey].map((session) => {
              const isComplete = session.status === 'complete'
              const isExpanded = expandedDate === session.date
              return (
                <div key={session.id}>
                  {/* Fila del día */}
                  <button
                    onClick={() => expandDay(session.date)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(session.date + 'T12:00:00').toLocaleDateString('es-ES', {
                          weekday: 'short', day: 'numeric', month: 'short',
                        })}
                      </p>
                      {isComplete && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(session.entry_time!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          {' → '}
                          {new Date(session.exit_time!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isComplete ? (
                        <p className="text-sm font-semibold text-gray-900">
                          {minutesToDuration(session.total_minutes)}
                        </p>
                      ) : (
                        <span className="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">
                          {session.status === 'absent' ? 'Ausente' : 'Incompleto'}
                        </span>
                      )}
                      <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                    </div>
                  </button>

                  {/* Detalle del día expandido */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 space-y-2">
                      {loadingEntries ? (
                        <p className="text-xs text-gray-400 text-center py-2">Cargando...</p>
                      ) : dayEntries.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">Sin fichajes registrados</p>
                      ) : (
                        dayEntries.map((entry) => (
                          <div key={entry.id} className="bg-white rounded-xl border border-gray-200 px-3 py-2.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-medium text-gray-700">
                                  {ENTRY_TYPE_LABELS[entry.type]}
                                  {entry.break_type && ` · ${BREAK_LABELS[entry.break_type]}`}
                                </p>
                                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                                  {new Date(entry.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Badges de estado */}
                                {entry.is_manual && !entry.is_corrected && (
                                  <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">manual</span>
                                )}
                                {entry.is_corrected && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                    entry.corrected_by_role === 'admin'
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {entry.corrected_by_role === 'admin' ? 'corregido admin' : 'corregido por mí'}
                                  </span>
                                )}
                                {/* Botón corregir */}
                                <button
                                  onClick={() => openCorrection(entry)}
                                  className="text-[10px] text-blue-600 underline"
                                >
                                  Corregir
                                </button>
                              </div>
                            </div>
                            {/* Historial de correcciones */}
                            {entry.time_entry_corrections && entry.time_entry_corrections.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                                {entry.time_entry_corrections.map((c: { reason: string; corrected_by_role: string; created_at: string; original_timestamp: string; corrected_timestamp: string }, i) => (
                                  <p key={i} className="text-[10px] text-gray-400">
                                    {c.corrected_by_role === 'admin' ? '👤 Admin' : '✏️ Yo'} · {c.reason} ·{' '}
                                    {new Date(c.original_timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} → {new Date(c.corrected_timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Modal corrección */}
      {correctingEntry && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 px-4 pb-6"
          onClick={(e) => { if (e.target === e.currentTarget) setCorrectingEntry(null) }}
        >
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Corregir fichaje</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {ENTRY_TYPE_LABELS[correctingEntry.type]} ·{' '}
                {new Date(correctingEntry.timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
              </p>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              La corrección quedará registrada con tu nombre y el motivo.
            </p>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nueva hora</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Motivo *</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: La tablet se quedó sin batería"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCorrect}
                disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Guardar corrección'}
              </button>
              <button
                onClick={() => setCorrectingEntry(null)}
                className="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

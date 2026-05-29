'use client'

import { useState, useEffect, useCallback } from 'react'
import { registerTimeEntry, getTodayEntries } from '@/lib/actions/clock'
import { calculateClockState, formatTime, BREAK_LABELS } from '@/lib/clock'
import { TimeEntry, BreakType, ClockState } from '@/types'

const BREAK_OPTIONS: { value: BreakType; label: string; icon: string }[] = [
  { value: 'food', label: 'Comida', icon: '🍽️' },
  { value: 'medical', label: 'Médico', icon: '🏥' },
  { value: 'personal', label: 'Personal', icon: '🚶' },
  { value: 'other', label: 'Otra', icon: '⏸️' },
]

export default function ClockPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [clockState, setClockState] = useState<ClockState>({
    isWorking: false,
    isOnBreak: false,
    entryTime: null,
    breakStartTime: null,
    breakType: null,
    elapsedSeconds: 0,
    breakSeconds: 0,
  })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showBreakSelector, setShowBreakSelector] = useState(false)
  const [customBreakLabel, setCustomBreakLabel] = useState('')
  const [error, setError] = useState('')

  const loadEntries = useCallback(async () => {
    const { data } = await getTodayEntries()
    if (data) {
      setEntries(data as TimeEntry[])
      setClockState(calculateClockState(data as TimeEntry[]))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const handleEntry = async () => {
    setActionLoading(true)
    setError('')
    const result = await registerTimeEntry('entry')
    if (result.error) setError(result.error)
    await loadEntries()
    setActionLoading(false)
  }

  const handleExit = async () => {
    setActionLoading(true)
    setError('')
    const result = await registerTimeEntry('exit')
    if (result.error) setError(result.error)
    await loadEntries()
    setActionLoading(false)
  }

  const handleBreakStart = async (type: BreakType) => {
    setActionLoading(true)
    setError('')
    const label = type === 'other' ? customBreakLabel : undefined
    const result = await registerTimeEntry('break_start', type, label)
    if (result.error) setError(result.error)
    await loadEntries()
    setShowBreakSelector(false)
    setCustomBreakLabel('')
    setActionLoading(false)
  }

  const handleBreakEnd = async () => {
    setActionLoading(true)
    setError('')
    const result = await registerTimeEntry('break_end')
    if (result.error) setError(result.error)
    await loadEntries()
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const statusColor = clockState.isWorking
    ? clockState.isOnBreak
      ? 'bg-amber-50 border-amber-200'
      : 'bg-green-50 border-green-200'
    : 'bg-gray-50 border-gray-200'

  const statusText = clockState.isWorking
    ? clockState.isOnBreak
      ? `En parada${clockState.breakType ? ` · ${BREAK_LABELS[clockState.breakType]}` : ''}`
      : 'Trabajando'
    : 'Sin fichar'

  const statusTextColor = clockState.isWorking
    ? clockState.isOnBreak
      ? 'text-amber-700'
      : 'text-green-700'
    : 'text-gray-500'

  return (
    <div className="max-w-sm mx-auto px-4 py-6 space-y-4">
      {/* Estado actual */}
      <div className={`rounded-2xl border p-6 ${statusColor}`}>
        <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${statusTextColor}`}>
          Estado actual
        </p>
        <p className={`text-2xl font-semibold mb-3 ${statusTextColor}`}>
          {statusText}
        </p>
        {clockState.entryTime && (
          <p className="text-sm text-gray-500">
            Entrada: <span className="font-medium text-gray-700">{formatTime(clockState.entryTime)}</span>
          </p>
        )}
        {clockState.isOnBreak && clockState.breakStartTime && (
          <p className="text-sm text-amber-600 mt-1">
            Parada desde: <span className="font-medium">{formatTime(clockState.breakStartTime)}</span>
          </p>
        )}
        {!clockState.isWorking && !clockState.entryTime && (
          <p className="text-sm text-gray-400">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
        {error}
        {error.includes('fichaje de ayer sin cerrar') && (
        <a
        href="/worker/history"
        className="block mt-2 bg-red-600 hover:bg-red-700 text-white text-center font-medium py-2 rounded-lg transition-colors"
      >
        Ir a Historial para regularizarlo →
      </a>
    )}
  </div>
)}

      {/* Botones de acción */}
      <div className="space-y-2">
        {!clockState.isWorking && (
          <button
            onClick={handleEntry}
            disabled={actionLoading}
            className="w-full bg-green-600 hover:bg-green-700 active:scale-95 text-white font-medium py-4 rounded-2xl text-base transition-all disabled:opacity-50"
          >
            {actionLoading ? 'Registrando...' : '↩ Registrar entrada'}
          </button>
        )}

        {clockState.isWorking && !clockState.isOnBreak && (
          <>
            <button
              onClick={() => setShowBreakSelector(!showBreakSelector)}
              disabled={actionLoading}
              className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-medium py-4 rounded-2xl text-base transition-all disabled:opacity-50"
            >
              ⏸ Iniciar parada
            </button>
            <button
              onClick={handleExit}
              disabled={actionLoading}
              className="w-full bg-red-500 hover:bg-red-600 active:scale-95 text-white font-medium py-4 rounded-2xl text-base transition-all disabled:opacity-50"
            >
              ↪ Registrar salida
            </button>
          </>
        )}

        {clockState.isWorking && clockState.isOnBreak && (
          <button
            onClick={handleBreakEnd}
            disabled={actionLoading}
            className="w-full bg-green-600 hover:bg-green-700 active:scale-95 text-white font-medium py-4 rounded-2xl text-base transition-all disabled:opacity-50"
          >
            ▶ Reanudar trabajo
          </button>
        )}
      </div>

      {/* Selector de parada */}
      {showBreakSelector && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-medium text-gray-700 mb-3">Tipo de parada</p>
          <div className="grid grid-cols-2 gap-2">
            {BREAK_OPTIONS.filter(o => o.value !== 'other').map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleBreakStart(opt.value)}
                className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-sm"
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          <div className="pt-2">
            <input
              type="text"
              placeholder="Descripción parada personalizada"
              value={customBreakLabel}
              onChange={(e) => setCustomBreakLabel(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mb-2"
            />
            <button
              onClick={() => handleBreakStart('other')}
              disabled={!customBreakLabel.trim()}
              className="w-full bg-gray-800 text-white rounded-xl py-2 text-sm disabled:opacity-40"
            >
              Iniciar parada personalizada
            </button>
          </div>
        </div>
      )}

      {/* Registros del día */}
      {entries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
            Registros de hoy
          </p>
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex justify-between text-sm">
                <span className="text-gray-500">
                  {entry.type === 'entry' && '↩ Entrada'}
                  {entry.type === 'exit' && '↪ Salida'}
                  {entry.type === 'break_start' && `⏸ Inicio parada${entry.break_label ? ` (${entry.break_label})` : entry.break_type ? ` (${BREAK_LABELS[entry.break_type as BreakType]})` : ''}`}
                  {entry.type === 'break_end' && '▶ Fin parada'}
                </span>
                <span className="font-medium text-gray-900 tabular-nums">
                  {formatTime(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

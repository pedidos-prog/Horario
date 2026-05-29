'use client'

import { useState, useEffect, useCallback } from 'react'
import { createVacationRequest, getMyVacationRequests } from '@/lib/actions/vacations'
import { VacationRequest, VacationStatus } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { formatDate, countWorkingDays } from '@/lib/clock'

const STATUS_LABELS: Record<VacationStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

const STATUS_STYLES: Record<VacationStatus, string> = {
  pending: 'bg-blue-50 text-blue-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

export default function VacationsPage() {
  const [requests, setRequests] = useState<VacationRequest[]>([])
  const [profile, setProfile] = useState<{ vacation_days_total: number; vacation_days_used: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('profiles')
      .select('vacation_days_total, vacation_days_used')
      .eq('id', user.id)
      .single()

    setProfile(profileData)

    const { data } = await getMyVacationRequests()
    if (data) setRequests(data as VacationRequest[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const workingDays =
    startDate && endDate
      ? countWorkingDays(new Date(startDate), new Date(endDate))
      : 0

  const available = profile
    ? profile.vacation_days_total - profile.vacation_days_used
    : 0

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      setError('Selecciona las fechas de inicio y fin')
      return
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin')
      return
    }
    setSubmitting(true)
    setError('')
    const result = await createVacationRequest(startDate, endDate, notes)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(`Solicitud enviada: ${result.daysCount} días`)
      setShowForm(false)
      setStartDate('')
      setEndDate('')
      setNotes('')
      await loadData()
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6 space-y-4">
      {/* Resumen de días */}
      {profile && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-2xl p-3 text-center">
            <p className="text-2xl font-semibold text-green-700">{available}</p>
            <p className="text-xs text-green-600 mt-0.5">Disponibles</p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-3 text-center">
            <p className="text-2xl font-semibold text-blue-700">{profile.vacation_days_used}</p>
            <p className="text-xs text-blue-600 mt-0.5">Usados</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3 text-center">
            <p className="text-2xl font-semibold text-gray-700">{profile.vacation_days_total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total año</p>
          </div>
        </div>
      )}

      {/* Mensajes */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">{success}</div>
      )}

      {/* Botón nueva solicitud */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-2xl text-base transition-all active:scale-95"
      >
        {showForm ? '✕ Cancelar' : '+ Nueva solicitud'}
      </button>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Fecha inicio</label>
            <input
              type="date"
              value={startDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Fecha fin</label>
            <input
              type="date"
              value={endDate}
              min={startDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          {workingDays > 0 && (
            <p className="text-sm text-green-600 font-medium">{workingDays} días laborables</p>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Motivo o comentario..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || workingDays <= 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
      )}

      {/* Historial de solicitudes */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Mis solicitudes</p>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No hay solicitudes</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {requests.map((req) => (
              <div key={req.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(req.start_date)} — {formatDate(req.end_date)}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[req.status]}`}>
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{req.days_count} días laborables</p>
                {req.admin_notes && (
                  <p className="text-xs text-gray-500 mt-1 italic">&ldquo;{req.admin_notes}&rdquo;</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

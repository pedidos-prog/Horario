'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Error al cambiar la contraseña')
    } else {
      setSuccess(true)
      setPassword('')
      setConfirm('')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-900 mb-1">Cambiar contraseña</p>
        <p className="text-xs text-gray-400 mb-4">Elige una contraseña que recuerdes fácilmente</p>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 text-center">
            ✓ Contraseña cambiada correctamente
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nueva contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Repetir contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Repite la contraseña"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

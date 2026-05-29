'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl border border-gray-200 p-8">
          <div className="mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                <polyline points="12 6 12 12 16 14" strokeWidth="1.5"/>
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Control Horario</h1>
            <p className="text-sm text-gray-400 mt-1">Accede con tu email de empresa</p>
          </div>

          {sent ? (
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" strokeWidth="2"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">Revisa tu email</p>
              <p className="text-sm text-gray-400">
                Hemos enviado un enlace de acceso a <strong>{email}</strong>. Pulsa el enlace para entrar.
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Usar otro email
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-medium py-3 rounded-xl text-sm transition-all disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar enlace de acceso →'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Sin contraseña. Recibirás un enlace por email.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

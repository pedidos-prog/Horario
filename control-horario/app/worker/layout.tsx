import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin/dashboard')

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Empleado'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-gray-400">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-base font-semibold text-gray-900">{firstName}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold">
          {firstName[0]}
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 pb-24">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-10">
        <Link href="/worker/clock" className="flex-1 flex flex-col items-center py-3 gap-0.5 text-gray-400 hover:text-blue-600 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
            <polyline points="12 6 12 12 16 14" strokeWidth="1.5"/>
          </svg>
          <span className="text-[10px]">Fichar</span>
        </Link>
        <Link href="/worker/vacations" className="flex-1 flex flex-col items-center py-3 gap-0.5 text-gray-400 hover:text-blue-600 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="1.5"/>
            <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.5"/>
            <line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.5"/>
            <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.5"/>
          </svg>
          <span className="text-[10px]">Vacaciones</span>
        </Link>
        <Link href="/worker/history" className="flex-1 flex flex-col items-center py-3 gap-0.5 text-gray-400 hover:text-blue-600 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeWidth="1.5"/>
          </svg>
          <span className="text-[10px]">Historial</span>
        </Link>
      </nav>
    </div>
  )
}

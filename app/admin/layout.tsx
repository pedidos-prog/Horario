import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/worker/clock')

  const logoutAction = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col sticky top-0 h-screen">
        <div className="p-5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">Control Horario</p>
          <p className="text-xs text-gray-400 mt-0.5">Panel de administrador</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" strokeWidth="1.5"/>
              <rect x="14" y="3" width="7" height="7" strokeWidth="1.5"/>
              <rect x="3" y="14" width="7" height="7" strokeWidth="1.5"/>
              <rect x="14" y="14" width="7" height="7" strokeWidth="1.5"/>
            </svg>
            Dashboard
          </Link>
          <Link href="/admin/workers" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="1.5"/>
              <circle cx="9" cy="7" r="4" strokeWidth="1.5"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="1.5"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="1.5"/>
            </svg>
            Trabajadores
          </Link>
          <Link href="/admin/vacations" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="1.5"/>
              <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.5"/>
              <line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.5"/>
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.5"/>
            </svg>
            Vacaciones
          </Link>
          <Link href="/admin/corrections" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth="1.5"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="1.5"/>
            </svg>
            Correcciones
          </Link>
          <a
            href={`/api/export?start=${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]}&end=${new Date().toISOString().split('T')[0]}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="1.5"/>
              <polyline points="7 10 12 15 17 10" strokeWidth="1.5"/>
              <line x1="12" y1="15" x2="12" y2="3" strokeWidth="1.5"/>
            </svg>
            Exportar Excel
          </a>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-900 mb-0.5">{profile?.full_name}</p>
          <p className="text-xs text-gray-400 mb-3">Administrador</p>
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-gray-400 hover:text-gray-600">
              Cerrar sesión →
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

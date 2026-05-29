import { createClient } from '@/lib/supabase/server'
import { createEmployee, updateEmployee } from '@/lib/actions/admin'
import { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function WorkersPage() {
  const supabase = await createClient()

  const { data: workers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .order('full_name')

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Trabajadores</h1>
          <p className="text-sm text-gray-400 mt-0.5">{workers?.length ?? 0} empleados registrados</p>
        </div>
        <a href="/admin/workers/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          + Añadir empleado
        </a>
      </div>

      {/* Formulario nuevo empleado */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Dar de alta empleado</h2>
          <p className="text-xs text-gray-400 mt-0.5">El empleado recibirá un email de invitación para acceder</p>
        </div>
        <form
          action={async (formData: FormData) => {
            'use server'
            const email = formData.get('email') as string
            const fullName = formData.get('full_name') as string
            const password = formData.get('password') as string
            const department = formData.get('department') as string
            const vacationDays = parseInt(formData.get('vacation_days') as string) || 22
            await createEmployee(email, fullName, password, department, vacationDays)
          }}
          className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Nombre completo *</label>
            <input
              name="full_name"
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="María García López"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Email *</label>
            <input
              name="email"
              type="email"
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="maria@empresa.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Contraseña inicial *</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Departamento</label>
            <input
              name="department"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              placeholder="Administración, Producción..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Días de vacaciones al año</label>
            <input
              name="vacation_days"
              type="number"
              defaultValue={22}
              min={0}
              max={60}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              Crear empleado →
            </button>
            <p className="text-xs text-gray-400 mt-2">El empleado entrará con su email y la contraseña que asignes. Puedes comunicársela por teléfono o mensaje.</p>
          </div>
        </form>
      </div>

      {/* Lista de empleados */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Departamento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Vacaciones</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(workers as Profile[])?.map((worker) => (
                <tr key={worker.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-900">{worker.full_name}</p>
                    <p className="text-xs text-gray-400">{worker.email}</p>
                  </td>
                  <td className="px-4 py-4 text-gray-600">{worker.department ?? '—'}</td>
                  <td className="px-4 py-4">
                    <span className="text-gray-900">{worker.vacation_days_total - worker.vacation_days_used}</span>
                    <span className="text-gray-400"> / {worker.vacation_days_total}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      worker.active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-50 text-gray-500'
                    }`}>
                      {worker.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <form action={async () => {
                      'use server'
                      await updateEmployee(worker.id, { active: !worker.active })
                    }}>
                      <button
                        type="submit"
                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                      >
                        {worker.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import { TimeEntry, ClockState, BreakType } from '@/types'

/** Convierte segundos en "Xh Ym" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Convierte minutos en "Xh Ym" */
export function minutesToDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

/** Formatea timestamp a "HH:MM" */
export function formatTime(timestamp: string | null): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Formatea fecha a "dd/mm/yyyy" */
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-ES')
}

/** Obtiene fecha de hoy en formato "YYYY-MM-DD" */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** Calcula el estado actual del reloj a partir de los fichajes de hoy */
export function calculateClockState(entries: TimeEntry[]): ClockState {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  let isWorking = false
  let isOnBreak = false
  let entryTime: string | null = null
  let breakStartTime: string | null = null
  let breakType: BreakType | null = null

  for (const entry of sorted) {
    switch (entry.type) {
      case 'entry':
        isWorking = true
        entryTime = entry.timestamp
        break
      case 'exit':
        isWorking = false
        isOnBreak = false
        break
      case 'break_start':
        isOnBreak = true
        breakStartTime = entry.timestamp
        breakType = entry.break_type
        break
      case 'break_end':
        isOnBreak = false
        breakStartTime = null
        breakType = null
        break
    }
  }

  const now = Date.now()

  // Calcular tiempo trabajado
  let elapsedSeconds = 0
  let breakSeconds = 0

  if (entryTime) {
    const entryMs = new Date(entryTime).getTime()
    const exitEntry = sorted.find((e) => e.type === 'exit')
    const exitMs = exitEntry ? new Date(exitEntry.timestamp).getTime() : now
    elapsedSeconds = Math.floor((exitMs - entryMs) / 1000)

    // Restar pausas
    let tempBreakStart: number | null = null
    for (const entry of sorted) {
      if (entry.type === 'break_start') {
        tempBreakStart = new Date(entry.timestamp).getTime()
      } else if (entry.type === 'break_end' && tempBreakStart) {
        breakSeconds += Math.floor(
          (new Date(entry.timestamp).getTime() - tempBreakStart) / 1000
        )
        tempBreakStart = null
      }
    }
    // Si hay pausa activa, sumar hasta ahora
    if (tempBreakStart && isOnBreak) {
      breakSeconds += Math.floor((now - tempBreakStart) / 1000)
    }

    elapsedSeconds = Math.max(0, elapsedSeconds - breakSeconds)
  }

  return {
    isWorking,
    isOnBreak,
    entryTime,
    breakStartTime,
    breakType,
    elapsedSeconds,
    breakSeconds,
  }
}

/** Etiquetas para tipos de parada */
export const BREAK_LABELS: Record<BreakType, string> = {
  food: 'Comida',
  medical: 'Médico',
  personal: 'Personal',
  other: 'Otra parada',
}

/** Etiquetas cortas de estado del empleado */
export function getWorkerStatusLabel(
  isWorking: boolean,
  isOnBreak: boolean
): string {
  if (!isWorking) return 'Sin fichar'
  if (isOnBreak) return 'En parada'
  return 'Trabajando'
}

export function getWorkerStatusColor(
  isWorking: boolean,
  isOnBreak: boolean
): 'green' | 'amber' | 'gray' {
  if (!isWorking) return 'gray'
  if (isOnBreak) return 'amber'
  return 'green'
}

/** Cuenta días laborables entre dos fechas (lun-vie, sin festivos) */
export function countWorkingDays(start: Date, end: Date): number {
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

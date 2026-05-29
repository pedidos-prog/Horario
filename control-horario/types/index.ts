export type Role = 'admin' | 'employee'
export type EntryType = 'entry' | 'exit' | 'break_start' | 'break_end'
export type BreakType = 'food' | 'medical' | 'personal' | 'other'
export type VacationStatus = 'pending' | 'approved' | 'rejected'
export type SessionStatus = 'incomplete' | 'complete' | 'absent'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  department: string | null
  vacation_days_total: number
  vacation_days_used: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: string
  user_id: string
  type: EntryType
  break_type: BreakType | null
  break_label: string | null
  timestamp: string
  notes: string | null
  created_at: string
}

export interface WorkSession {
  id: string
  user_id: string
  date: string
  entry_time: string | null
  exit_time: string | null
  total_minutes: number
  break_minutes: number
  overtime_minutes: number
  status: SessionStatus
  created_at: string
  updated_at: string
}

export interface VacationRequest {
  id: string
  user_id: string
  start_date: string
  end_date: string
  days_count: number
  status: VacationStatus
  notes: string | null
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
}

// Estado del reloj en tiempo real (calculado en cliente)
export interface ClockState {
  isWorking: boolean
  isOnBreak: boolean
  entryTime: string | null
  breakStartTime: string | null
  breakType: BreakType | null
  elapsedSeconds: number
  breakSeconds: number
}

// Para el panel admin - empleado con sesión del día
export interface WorkerTodayStatus {
  profile: Profile
  session: WorkSession | null
  currentEntry: TimeEntry | null
  isOnBreak: boolean
  breakType: BreakType | null
}

export interface TimeEntryCorrection {
  id: string
  time_entry_id: string
  original_timestamp: string
  corrected_timestamp: string
  reason: string
  corrected_by: string
  corrected_by_role: 'employee' | 'admin'
  created_at: string
}

// TimeEntry extendido con campos de corrección
export interface TimeEntryWithCorrection extends TimeEntry {
  is_manual: boolean
  is_corrected: boolean
  corrected_at: string | null
  corrected_by: string | null
  corrected_by_role: 'employee' | 'admin' | null
  time_entry_corrections?: TimeEntryCorrection[]
}

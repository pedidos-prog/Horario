-- ============================================================
-- Control Horario - Schema Principal
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: profiles (extiende auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  department   TEXT,
  vacation_days_total    INT NOT NULL DEFAULT 22,
  vacation_days_used     INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLA: time_entries (fichajes)
-- ============================================================
CREATE TABLE public.time_entries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('entry', 'exit', 'break_start', 'break_end')),
  break_type   TEXT CHECK (break_type IN ('food', 'medical', 'personal', 'other')),
  break_label  TEXT,   -- descripción libre si break_type = 'other'
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_timestamp ON public.time_entries(timestamp DESC);

-- ============================================================
-- TABLA: work_sessions (sesiones calculadas - vista diaria)
-- ============================================================
CREATE TABLE public.work_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  entry_time      TIMESTAMPTZ,
  exit_time       TIMESTAMPTZ,
  total_minutes   INT DEFAULT 0,        -- minutos trabajados netos
  break_minutes   INT DEFAULT 0,        -- minutos de parada
  overtime_minutes INT DEFAULT 0,       -- minutos extra (>480 min = 8h)
  status          TEXT DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'complete', 'absent')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_work_sessions_user_date ON public.work_sessions(user_id, date DESC);

-- ============================================================
-- TABLA: vacation_requests (solicitudes de vacaciones)
-- ============================================================
CREATE TABLE public.vacation_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  days_count   INT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes        TEXT,
  admin_notes  TEXT,
  reviewed_by  UUID REFERENCES auth.users(id),
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vacation_requests_user_id ON public.vacation_requests(user_id);
CREATE INDEX idx_vacation_requests_status ON public.vacation_requests(status);

-- ============================================================
-- FUNCIÓN: is_admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN: handle_new_user (crea perfil automáticamente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCIÓN: update_updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_work_sessions_updated_at BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_vacation_requests_updated_at BEFORE UPDATE ON public.vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- FUNCIÓN: calculate_work_session (recalcula sesión del día)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_work_session(p_user_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
  v_entries RECORD;
  v_entry_time TIMESTAMPTZ;
  v_exit_time TIMESTAMPTZ;
  v_total_minutes INT := 0;
  v_break_minutes INT := 0;
  v_break_start TIMESTAMPTZ;
  v_status TEXT := 'incomplete';
BEGIN
  -- Obtener entrada del día
  SELECT timestamp INTO v_entry_time
  FROM public.time_entries
  WHERE user_id = p_user_id
    AND type = 'entry'
    AND DATE(timestamp) = p_date
  ORDER BY timestamp ASC
  LIMIT 1;

  -- Obtener salida del día
  SELECT timestamp INTO v_exit_time
  FROM public.time_entries
  WHERE user_id = p_user_id
    AND type = 'exit'
    AND DATE(timestamp) = p_date
  ORDER BY timestamp DESC
  LIMIT 1;

  -- Calcular minutos de pausas
  FOR v_entries IN
    SELECT type, timestamp
    FROM public.time_entries
    WHERE user_id = p_user_id AND DATE(timestamp) = p_date
    ORDER BY timestamp ASC
  LOOP
    IF v_entries.type = 'break_start' THEN
      v_break_start := v_entries.timestamp;
    ELSIF v_entries.type = 'break_end' AND v_break_start IS NOT NULL THEN
      v_break_minutes := v_break_minutes + EXTRACT(EPOCH FROM (v_entries.timestamp - v_break_start)) / 60;
      v_break_start := NULL;
    END IF;
  END LOOP;

  -- Calcular minutos totales
  IF v_entry_time IS NOT NULL AND v_exit_time IS NOT NULL THEN
    v_total_minutes := EXTRACT(EPOCH FROM (v_exit_time - v_entry_time)) / 60 - v_break_minutes;
    v_status := 'complete';
  END IF;

  -- Upsert sesión
  INSERT INTO public.work_sessions (user_id, date, entry_time, exit_time, total_minutes, break_minutes, overtime_minutes, status)
  VALUES (
    p_user_id, p_date, v_entry_time, v_exit_time,
    GREATEST(0, v_total_minutes),
    v_break_minutes,
    GREATEST(0, v_total_minutes - 480),
    v_status
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    entry_time = EXCLUDED.entry_time,
    exit_time = EXCLUDED.exit_time,
    total_minutes = EXCLUDED.total_minutes,
    break_minutes = EXCLUDED.break_minutes,
    overtime_minutes = EXCLUDED.overtime_minutes,
    status = EXCLUDED.status,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER: recalcular sesión al insertar fichaje
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_time_entry_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.calculate_work_session(NEW.user_id, DATE(NEW.timestamp));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER recalc_session_on_entry
  AFTER INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.on_time_entry_insert();

-- ============================================================
-- FUNCIONES: incrementar/decrementar días de vacaciones usados
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_vacation_days_used(p_user_id UUID, p_days INT)
RETURNS VOID AS $$
  UPDATE public.profiles
  SET vacation_days_used = vacation_days_used + p_days
  WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrement_vacation_days_used(p_user_id UUID, p_days INT)
RETURNS VOID AS $$
  UPDATE public.profiles
  SET vacation_days_used = GREATEST(0, vacation_days_used - p_days)
  WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- TABLA: time_entry_corrections (registro de correcciones)
-- ============================================================
CREATE TABLE public.time_entry_corrections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  time_entry_id   UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  original_timestamp  TIMESTAMPTZ NOT NULL,
  corrected_timestamp TIMESTAMPTZ NOT NULL,
  reason          TEXT NOT NULL,
  corrected_by    UUID NOT NULL REFERENCES auth.users(id),  -- puede ser el propio empleado o admin
  corrected_by_role TEXT NOT NULL CHECK (corrected_by_role IN ('employee', 'admin')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_corrections_entry_id ON public.time_entry_corrections(time_entry_id);
CREATE INDEX idx_corrections_corrected_by ON public.time_entry_corrections(corrected_by);

-- Añadir columnas de corrección a time_entries
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS is_manual      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_corrected   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS corrected_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS corrected_by   UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS corrected_by_role TEXT CHECK (corrected_by_role IN ('employee', 'admin'));

-- Añadir también columna para fichajes manuales (entrada/salida olvidada)
-- is_manual = true significa que el timestamp fue introducido manualmente, no capturado al pulsar

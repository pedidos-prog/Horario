-- ============================================================
-- Control Horario - Políticas de Seguridad (RLS)
-- Ejecutar DESPUÉS de 001_schema.sql
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS: profiles
-- ============================================================

-- Empleado: puede ver y editar su propio perfil
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- El empleado NO puede cambiar su propio rol ni vacation_days_total
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND vacation_days_total = (SELECT vacation_days_total FROM public.profiles WHERE id = auth.uid())
  );

-- Admin: puede ver todos los perfiles
CREATE POLICY "profiles_select_all_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admin: puede actualizar cualquier perfil
CREATE POLICY "profiles_update_all_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- POLÍTICAS: time_entries
-- ============================================================

-- Empleado: puede insertar y ver sus propios fichajes
CREATE POLICY "time_entries_insert_own" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "time_entries_select_own" ON public.time_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin: puede ver todos los fichajes
CREATE POLICY "time_entries_select_admin" ON public.time_entries
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- POLÍTICAS: work_sessions
-- ============================================================

-- Empleado: puede ver sus propias sesiones
CREATE POLICY "work_sessions_select_own" ON public.work_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin: puede ver todas las sesiones
CREATE POLICY "work_sessions_select_admin" ON public.work_sessions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Service role puede insertar/actualizar (para el trigger)
CREATE POLICY "work_sessions_upsert_service" ON public.work_sessions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- POLÍTICAS: vacation_requests
-- ============================================================

-- Empleado: puede insertar y ver sus propias solicitudes
CREATE POLICY "vacations_insert_own" ON public.vacation_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vacations_select_own" ON public.vacation_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin: puede ver y actualizar todas las solicitudes
CREATE POLICY "vacations_select_admin" ON public.vacation_requests
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "vacations_update_admin" ON public.vacation_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- POLÍTICAS: time_entry_corrections
-- ============================================================

ALTER TABLE public.time_entry_corrections ENABLE ROW LEVEL SECURITY;

-- Empleado: puede ver correcciones de sus propios fichajes
CREATE POLICY "corrections_select_own" ON public.time_entry_corrections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.time_entries te
      WHERE te.id = time_entry_id AND te.user_id = auth.uid()
    )
  );

-- Empleado: puede insertar correcciones sobre sus propios fichajes
CREATE POLICY "corrections_insert_own" ON public.time_entry_corrections
  FOR INSERT TO authenticated
  WITH CHECK (
    corrected_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.time_entries te
      WHERE te.id = time_entry_id AND te.user_id = auth.uid()
    )
  );

-- Admin: puede ver y crear todas las correcciones
CREATE POLICY "corrections_all_admin" ON public.time_entry_corrections
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Empleado: puede actualizar sus propios fichajes (solo timestamp, para correcciones)
CREATE POLICY "time_entries_update_own" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin: puede actualizar cualquier fichaje
CREATE POLICY "time_entries_update_admin" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Empleado: puede insertar fichajes manuales (pasados) para días anteriores
-- (misma política que insert_own, ya cubierta arriba)

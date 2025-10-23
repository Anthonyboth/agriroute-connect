-- Drop políticas antigas (incorretas)
DROP POLICY IF EXISTS "users_select_own_devices" ON user_devices;
DROP POLICY IF EXISTS "users_insert_own_devices" ON user_devices;
DROP POLICY IF EXISTS "users_update_own_devices" ON user_devices;
DROP POLICY IF EXISTS "users_delete_own_devices" ON user_devices;

-- Criar políticas corretas (comparação direta com auth.uid())
CREATE POLICY "users_select_own_devices"
  ON user_devices
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_devices"
  ON user_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_devices"
  ON user_devices
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_devices"
  ON user_devices
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
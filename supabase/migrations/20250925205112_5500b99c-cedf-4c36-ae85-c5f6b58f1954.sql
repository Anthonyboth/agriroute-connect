-- Function to delete all users from auth.users table
CREATE OR REPLACE FUNCTION delete_all_auth_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users;
  RAISE NOTICE 'All users deleted from auth.users table';
END;
$$;

-- Execute the function
SELECT delete_all_auth_users();

-- Drop the function after use
DROP FUNCTION delete_all_auth_users();
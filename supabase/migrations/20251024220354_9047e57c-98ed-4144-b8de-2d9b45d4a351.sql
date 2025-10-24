-- ✅ Adicionar índice em profiles.user_id para acelerar queries
create index if not exists idx_profiles_user_id on public.profiles(user_id);

-- ✅ Comentário explicativo
comment on index public.idx_profiles_user_id is 'Índice para otimizar queries de perfil por user_id, reduzindo latência de autenticação';
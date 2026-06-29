-- Admin pode editar o perfil de qualquer usuário (nome/setor/instagram/niche) no GPR Core.
drop policy if exists profiles_admin_upd on public.profiles;
create policy profiles_admin_upd on public.profiles for update using (public.is_admin()) with check (public.is_admin());

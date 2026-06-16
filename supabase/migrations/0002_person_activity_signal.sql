-- 0002: per-person activity signal derived from OpenAlex works.
-- Publications stay background-only; we keep only a lightweight signal on people.
alter table public.people add column if not exists works_count      integer;
alter table public.people add column if not exists last_active_year integer;

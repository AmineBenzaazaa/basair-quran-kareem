create table if not exists public.content_modules (
  module_id text primary key,
  document jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_content_modules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists content_modules_set_updated_at on public.content_modules;

create trigger content_modules_set_updated_at
before update on public.content_modules
for each row
execute function public.set_content_modules_updated_at();

alter table public.content_modules enable row level security;

grant select on table public.content_modules to anon, authenticated;

drop policy if exists "Allow public read content modules" on public.content_modules;

create policy "Allow public read content modules"
on public.content_modules
for select
using (true);

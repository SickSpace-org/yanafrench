-- Time-slot booking for the Orientation Test and the free Demo Class (see
-- lib/bookingData.ts). Each kind has its own slots, so their seat counts
-- are independent. Same access model as the other tables: RLS on, no
-- policies, service-role key only.

create table if not exists public.booking_slots (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('orientation', 'demo')),
  starts_at timestamptz not null,
  capacity integer not null default 4 check (capacity between 1 and 50),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kind, starts_at)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.booking_slots (id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null,
  level text,
  message text,
  -- Orientation Test fee, marked paid by hand in Admin -> Bookings once
  -- Yana has received it on WhatsApp. Always null for the free Demo Class.
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bookings_slot_id_idx on public.bookings (slot_id);
-- One seat per person per slot.
create unique index if not exists bookings_slot_email_idx on public.bookings (slot_id, lower(email));

alter table public.booking_slots enable row level security;
alter table public.bookings enable row level security;

-- Takes a seat in a slot. Locks the slot row first, so two people booking
-- the last seat at the same moment can't both get it. Returns the new
-- booking's id, or raises: slot_not_found / slot_closed / slot_past /
-- slot_full / already_booked.
create or replace function public.book_slot(
  p_slot_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_level text,
  p_message text
)
returns uuid
language plpgsql
as $$
declare
  s public.booking_slots%rowtype;
  taken int;
  new_id uuid;
begin
  select * into s from public.booking_slots where id = p_slot_id for update;
  if not found then raise exception 'slot_not_found'; end if;
  if not s.active then raise exception 'slot_closed'; end if;
  if s.starts_at <= now() then raise exception 'slot_past'; end if;

  if exists (select 1 from public.bookings where slot_id = p_slot_id and lower(email) = lower(p_email)) then
    raise exception 'already_booked';
  end if;

  select count(*) into taken from public.bookings where slot_id = p_slot_id;
  if taken >= s.capacity then raise exception 'slot_full'; end if;

  insert into public.bookings (slot_id, name, email, phone, level, message)
  values (p_slot_id, p_name, p_email, p_phone, p_level, p_message)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.book_slot(uuid, text, text, text, text, text) to service_role;
revoke execute on function public.book_slot(uuid, text, text, text, text, text) from anon, authenticated, public;

-- The week of 12-18 Oct 2026 (IST), offered for both kinds.
insert into public.booking_slots (kind, starts_at)
select k.kind, t.starts_at
from (values ('orientation'), ('demo')) as k(kind)
cross join (values
  (timestamptz '2026-10-12 19:00+05:30'), ('2026-10-12 21:00+05:30'), ('2026-10-12 22:00+05:30'),
  ('2026-10-13 21:00+05:30'), ('2026-10-13 22:00+05:30'),
  ('2026-10-14 14:00+05:30'), ('2026-10-14 22:00+05:30'),
  ('2026-10-15 21:00+05:30'), ('2026-10-15 22:00+05:30'), ('2026-10-15 23:00+05:30'),
  ('2026-10-16 21:00+05:30'),
  ('2026-10-17 16:30+05:30'), ('2026-10-17 20:30+05:30'), ('2026-10-17 21:30+05:30'),
  ('2026-10-18 12:00+05:30'), ('2026-10-18 13:00+05:30')
) as t(starts_at)
on conflict (kind, starts_at) do nothing;

notify pgrst, 'reload schema';

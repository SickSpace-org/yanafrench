-- Which teacher takes a slot, and each booking (see lib/bookingData.ts's
-- TEACHERS). A booking starts with its slot's teacher; the admin can switch
-- it in Admin -> Bookings (e.g. when both teachers offer the same time).

alter table public.booking_slots add column if not exists teacher text not null default 'Yana';
alter table public.bookings add column if not exists teacher text;

-- The 13-18 Oct timings added in 20261012180000 are Harnoor's. 15 Oct
-- 10 PM is in both teachers' schedules, so it stays Yana's slot and the
-- admin assigns each booking in it.
update public.booking_slots set teacher = 'Harnoor'
where starts_at in (
  '2026-10-13 23:00+05:30',
  '2026-10-14 11:30+05:30', '2026-10-14 12:00+05:30', '2026-10-14 12:30+05:30', '2026-10-14 13:00+05:30',
  '2026-10-15 16:30+05:30', '2026-10-15 17:00+05:30', '2026-10-15 22:30+05:30',
  '2026-10-16 16:30+05:30', '2026-10-16 17:00+05:30', '2026-10-16 17:30+05:30',
  '2026-10-17 13:30+05:30', '2026-10-17 14:00+05:30', '2026-10-17 14:30+05:30', '2026-10-17 15:00+05:30',
  '2026-10-17 15:30+05:30', '2026-10-17 17:15+05:30', '2026-10-17 22:00+05:30'
);

update public.bookings b set teacher = s.teacher
from public.booking_slots s
where b.slot_id = s.id and b.teacher is null;

-- Same as before, plus: the new booking gets its slot's teacher.
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

  insert into public.bookings (slot_id, name, email, phone, level, message, teacher)
  values (p_slot_id, p_name, p_email, p_phone, p_level, p_message, s.teacher)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.book_slot(uuid, text, text, text, text, text) to service_role;
revoke execute on function public.book_slot(uuid, text, text, text, text, text) from anon, authenticated, public;

notify pgrst, 'reload schema';

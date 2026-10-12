-- One round trip per booking (see lib/bookings.ts's bookSlot): same rules
-- as book_slot(), plus the kind check, and it returns what the booking
-- route needs (slot time, seats) instead of making it query again.
-- book_slot() is left in place for deployments still calling it.
create or replace function public.reserve_slot(
  p_slot_id uuid,
  p_kind text,
  p_name text,
  p_email text,
  p_phone text,
  p_level text,
  p_message text
)
returns json
language plpgsql
as $$
declare
  s public.booking_slots%rowtype;
  taken int;
  new_id uuid;
begin
  select * into s from public.booking_slots where id = p_slot_id for update;
  if not found then raise exception 'slot_not_found'; end if;
  if s.kind <> p_kind then raise exception 'wrong_kind'; end if;
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

  return json_build_object('id', new_id, 'starts_at', s.starts_at, 'capacity', s.capacity, 'booked', taken + 1);
end;
$$;

grant execute on function public.reserve_slot(uuid, text, text, text, text, text, text) to service_role;
revoke execute on function public.reserve_slot(uuid, text, text, text, text, text, text) from anon, authenticated, public;

notify pgrst, 'reload schema';

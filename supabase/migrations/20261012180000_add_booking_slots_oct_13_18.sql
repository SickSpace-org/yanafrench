-- More Orientation Test / Demo Class slots for 13-18 Oct 2026 (IST), for
-- both kinds. Slots that already exist are left as they are.
insert into public.booking_slots (kind, starts_at)
select k.kind, t.starts_at
from (values ('orientation'), ('demo')) as k(kind)
cross join (values
  (timestamptz '2026-10-13 23:00+05:30'),
  ('2026-10-14 11:30+05:30'), ('2026-10-14 12:00+05:30'), ('2026-10-14 12:30+05:30'), ('2026-10-14 13:00+05:30'),
  ('2026-10-15 16:30+05:30'), ('2026-10-15 17:00+05:30'), ('2026-10-15 22:00+05:30'), ('2026-10-15 22:30+05:30'),
  ('2026-10-16 16:30+05:30'), ('2026-10-16 17:00+05:30'), ('2026-10-16 17:30+05:30'),
  ('2026-10-17 13:30+05:30'), ('2026-10-17 14:00+05:30'), ('2026-10-17 14:30+05:30'), ('2026-10-17 15:00+05:30'),
  ('2026-10-17 15:30+05:30'), ('2026-10-17 17:15+05:30'), ('2026-10-17 22:00+05:30')
) as t(starts_at)
on conflict (kind, starts_at) do nothing;

-- Fixed-window rate limiting for the AI routes (see lib/rateLimit.ts) —
-- /api/chat, /api/quiz/generate, /api/quiz/submit, /api/speaking/evaluate,
-- /api/enhance-text, /api/word-of-week, /api/teacher-note. Same access
-- model as the other app-owned tables: RLS enabled with no policies, so
-- only the service-role key (lib/supabaseAdmin.ts) can reach it.

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        integer not null default 1
);

alter table public.rate_limits enable row level security;

grant select, insert, update, delete on public.rate_limits to anon, authenticated;

-- Atomic check-and-increment: resets the window if it's expired, otherwise
-- increments the count within it, in a single statement so concurrent
-- requests for the same key can't race past each other and both succeed
-- past the limit. Returns whether this request is allowed.
create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
as $$
declare
  current_count int;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
        when rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
          then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
          then now()
        else rate_limits.window_start
      end
  returning count into current_count;

  return current_count <= p_limit;
end;
$$;

grant execute on function public.check_rate_limit(text, int, int) to service_role;
revoke execute on function public.check_rate_limit(text, int, int) from anon, authenticated, public;

-- Security Migration: Edge Function Rate Limiting & Audit Logging

-- 1. Rate Limit Table
create table if not exists public.signup_rate_limit (
    ip_address text primary key,
    attempt_count int not null default 1,
    window_started timestamptz not null default now()
);

-- Enable RLS (Only service_role can access)
alter table public.signup_rate_limit enable row level security;
create policy "Service Role Full Access to Rate Limits" on public.signup_rate_limit
    for all to service_role
    using (true)
    with check (true);


-- 2. Security Audit Log Table
create table if not exists public.security_audit_log (
    id uuid primary key default gen_random_uuid(),
    ip_address text not null,
    action text not null,
    email text,
    timestamp timestamptz not null default now(),
    status text not null
);

-- Enable RLS (Only service_role can access)
alter table public.security_audit_log enable row level security;
create policy "Service Role Full Access to Audit Logs" on public.security_audit_log
    for all to service_role
    using (true)
    with check (true);


-- 3. Cleanup Function (Optional, for cron jobs)
-- Removes rate limit windows older than 10 minutes
create or replace function public.cleanup_signup_rate_limits()
returns void
language plpgsql
security definer
as $$
begin
    delete from public.signup_rate_limit
    where window_started < now() - interval '10 minutes';
end;
$$;

create table public.request_limits (
  key text primary key check(length(key)=64),
  window_start timestamptz not null,
  expires_at timestamptz not null,
  hits integer not null check(hits>0)
);
alter table public.request_limits enable row level security;
revoke all on public.request_limits from public,anon,authenticated;
grant all on public.request_limits to service_role;
create index request_limits_expiry on public.request_limits(expires_at);
create function public.consume_request_limit(p_key text,p_limit integer,p_seconds integer)
returns table(allowed boolean,retry_after integer)
language plpgsql security invoker set search_path='' as $$
declare now_at timestamptz := clock_timestamp(); row_value public.request_limits;
begin
  if p_key !~ '^[a-f0-9]{64}$' or p_limit<1 or p_limit>100 or p_seconds<1 or p_seconds>3600 then
    raise exception 'Invalid request limit';
  end if;
  delete from public.request_limits where expires_at < now_at-interval '1 day';
  insert into public.request_limits as r(key,window_start,expires_at,hits)
    values(p_key,now_at,now_at+make_interval(secs=>p_seconds),1)
    on conflict(key) do update set
      window_start=case when r.expires_at<=now_at then now_at else r.window_start end,
      expires_at=case when r.expires_at<=now_at then now_at+make_interval(secs=>p_seconds) else r.expires_at end,
      hits=case when r.expires_at<=now_at then 1 else least(r.hits+1,p_limit+1) end
    returning * into row_value;
  return query select row_value.hits<=p_limit,greatest(1,ceil(extract(epoch from row_value.expires_at-now_at))::integer);
end $$;
revoke all on function public.consume_request_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_request_limit(text,integer,integer) to service_role;

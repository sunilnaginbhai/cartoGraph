create policy "organization members can receive analysis progress"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() like 'analysis:%'
  and exists (
    select 1
    from public.analyses
    where 'analysis:' || public.analyses.id::text = realtime.topic()
      and public.analyses.organization_id = (
        select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')
      )
  )
);

comment on policy "organization members can receive analysis progress" on realtime.messages is
  'Declares the private analysis:<id> topic pattern and limits subscriptions to the owning organization.';

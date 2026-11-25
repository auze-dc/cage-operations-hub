-- Per-record currency, with existing records retaining MWK by default.
set lock_timeout='5s';
alter table public.training_courses add column currency text not null default 'MWK'
  check (currency in ('MWK','USD','GBP','EUR'));

-- Preserve all payroll arithmetic in MWK. Only retain the reviewed entry-currency
-- reference and rate; re-normalizing a salary must never convert it a second time.
create or replace function payroll_private.amounts(input jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text;n numeric;result jsonb:='{}';g numeric;d numeric;entry jsonb;entries jsonb;normalised jsonb:='[]';label text;allowance_total numeric:=0;treatment text;pension_regular numeric:=0;pension_housing numeric:=0;pension_base numeric;entry_currency text;entry_rate numeric;
begin
 if jsonb_typeof(input) is distinct from 'object' then raise exception 'Enter salary amounts';end if;
 foreach k in array array['basic','overtime','bonus','advance','other_deductions'] loop
  if jsonb_typeof(input->k) is distinct from 'number' then raise exception 'Invalid amount: %',k;end if;
  n:=(input->>k)::numeric;
  if n<0 or n>999999999999 or n::text in ('NaN','Infinity','-Infinity') then raise exception 'Amount out of range: %',k;end if;
  result:=result||jsonb_build_object(k,round(n,2));
 end loop;
 -- Older clients / settings with an aggregate allowance remain readable and saveable.
 if input?'allowance_items' then
  entries:=input->'allowance_items';
 else
  if jsonb_typeof(input->'allowances') is distinct from 'number' then raise exception 'Invalid allowances';end if;
  n:=(input->>'allowances')::numeric;
  if n<0 or n>999999999999 then raise exception 'Invalid allowances';end if;
  entries:=case when n=0 then '[]'::jsonb else jsonb_build_array(jsonb_build_object('name','Other allowance','amount',n)) end;
 end if;
 if jsonb_typeof(entries) is distinct from 'array' then raise exception 'Allowances must be a list';end if;
 if jsonb_array_length(entries)>50 then raise exception 'Maximum 50 allowances per employee';end if;
 for entry in select value from jsonb_array_elements(entries) loop
  if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'name') is distinct from 'string' or jsonb_typeof(entry->'amount') is distinct from 'number' then raise exception 'Each allowance needs a name and amount';end if;
  label:=trim(entry->>'name');n:=(entry->>'amount')::numeric;
  if length(label) not between 1 and 100 or label~'[[:cntrl:]]' then raise exception 'Enter an allowance name (1–100 characters)';end if;
  if n<0 or n>999999999999 or n::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid allowance amount';end if;
  n:=round(n,2);allowance_total:=allowance_total+n;
  treatment:=coalesce(entry->>'pension_treatment','regular');
  if treatment not in ('regular','housing_excess','excluded') then raise exception 'Choose a valid pension treatment for each allowance';end if;
  if treatment='regular' then pension_regular:=pension_regular+n;
  elsif treatment='housing_excess' then pension_housing:=pension_housing+n;end if;
  normalised:=normalised||jsonb_build_array(jsonb_build_object('name',label,'amount',n,'pension_treatment',treatment));
 end loop;
 if allowance_total>999999999999 then raise exception 'Allowance total is out of range';end if;
 result:=result||jsonb_build_object('allowances',allowance_total,'allowance_items',normalised);
 g:=(result->>'basic')::numeric+allowance_total+(result->>'overtime')::numeric+(result->>'bonus')::numeric;
 result:=result||jsonb_build_object('taxable_income',g,'paye',payroll_private.monthly_paye(g),'paye_rule','MW-2026-monthly-v1');
 pension_base:=round((result->>'basic')::numeric+pension_regular+greatest(pension_housing-(result->>'basic')::numeric*0.40,0),2);
 result:=result||jsonb_build_object('pensionable_income',round(pension_base,2),'pension',round(pension_base*0.05,2),'employer_pension',round(pension_base*0.10,2),'pension_employee_rate',5,'pension_employer_rate',10,'pension_rule','MW-2023-minimum-2025-emoluments-v1');
 d:=(result->>'paye')::numeric+(result->>'pension')::numeric+(result->>'advance')::numeric+(result->>'other_deductions')::numeric;
 if g<=0 or d>g then raise exception 'Gross pay must be positive; deductions cannot exceed gross pay';end if;
 entry_currency:=coalesce(input->>'entry_currency','MWK');
 if entry_currency not in ('MWK','USD','GBP','EUR') then raise exception 'Choose MWK, USD, GBP or EUR for salary entry';end if;
 if entry_currency='MWK' then entry_rate:=1;
 else
  if jsonb_typeof(input->'mwk_per_unit') is distinct from 'number' then raise exception 'Enter the payroll exchange rate';end if;
  entry_rate:=(input->>'mwk_per_unit')::numeric;
  if entry_rate<0.000001 or entry_rate>1000000000 or entry_rate::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a positive payroll exchange rate';end if;
 end if;
 return result||jsonb_build_object('entry_currency',entry_currency,'mwk_per_unit',entry_rate);
end $$;
-- CREATE OR REPLACE preserves the existing private function privileges.
-- Existing workspace permission/approval checks remain in place.
create function public.validate_record_currency() returns trigger
language plpgsql set search_path='' as $$
declare section text;r jsonb;prior jsonb;c text;old_currency text;
begin
 foreach section in array array['quotes','invoices','expenses','deals','requests','approvals','commercialRecords'] loop
  if new.data->section is not distinct from old.data->section then continue;end if;
  for r in select value from jsonb_array_elements(coalesce(new.data->section,'[]'::jsonb)) loop
   select value into prior from jsonb_array_elements(coalesce(old.data->section,'[]'::jsonb)) where value->>'id'=r->>'id';
   c:=coalesce(nullif(r->>'currency',''),'MWK');old_currency:=coalesce(nullif(prior->>'currency',''),'MWK');
   if (prior is null or c is distinct from old_currency) and c not in ('MWK','USD','GBP','EUR') then raise exception 'Choose MWK, USD, GBP or EUR';end if;
   if section='invoices' and prior is not null and c is distinct from old_currency then
    if prior->>'status'='Paid' or exists(select 1 from public.invoice_payments p where p.organization_id=new.organization_id and p.invoice_id=r->>'id') then
     raise exception 'Currency cannot change after payment';
    end if;
   end if;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function public.validate_record_currency() from public,anon,authenticated;
create trigger validate_record_currency before update of data on public.workspace_states
for each row execute function public.validate_record_currency();
notify pgrst,'reload schema';

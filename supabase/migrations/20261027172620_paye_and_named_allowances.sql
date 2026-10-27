-- Monthly Malawi PAYE bands supplied by CAGE and checked against the MRA notice:
-- https://www.mra.mw/admin/storage/download_files/1767952247_NEW%20TAX%20MEASURES...pdf
-- Cash earnings are the PAYE base; employee deductions do not reduce that base.
create function payroll_private.monthly_paye(income numeric) returns numeric language plpgsql immutable set search_path='' as $$
begin
 if income is null or income<0 or income::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid taxable income';end if;
 return round(greatest(least(income,1570000)-170000,0)*0.30
  +greatest(least(income,10000000)-1570000,0)*0.35
  +greatest(income-10000000,0)*0.40,2);
end $$;
revoke all on function payroll_private.monthly_paye(numeric) from public,anon,authenticated;

create or replace function payroll_private.amounts(input jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text;n numeric;result jsonb:='{}';g numeric;d numeric;entry jsonb;entries jsonb;normalised jsonb:='[]';label text;allowance_total numeric:=0;
begin
 if jsonb_typeof(input) is distinct from 'object' then raise exception 'Enter salary amounts';end if;
 foreach k in array array['basic','overtime','bonus','pension','advance','other_deductions','employer_pension'] loop
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
  normalised:=normalised||jsonb_build_array(jsonb_build_object('name',label,'amount',n));
 end loop;
 if allowance_total>999999999999 then raise exception 'Allowance total is out of range';end if;
 result:=result||jsonb_build_object('allowances',allowance_total,'allowance_items',normalised);
 g:=(result->>'basic')::numeric+allowance_total+(result->>'overtime')::numeric+(result->>'bonus')::numeric;
 result:=result||jsonb_build_object('taxable_income',g,'paye',payroll_private.monthly_paye(g),'paye_rule','MW-2026-monthly-v1');
 d:=(result->>'paye')::numeric+(result->>'pension')::numeric+(result->>'advance')::numeric+(result->>'other_deductions')::numeric;
 if g<=0 or d>g then raise exception 'Gross pay must be positive; deductions cannot exceed gross pay';end if;
 return result;
end $$;
-- Preserve the existing checked write RPC and immutable approved snapshots.
-- Refuse new draft runs before the supported PAYE schedule rather than backdating it.
create function payroll_private.check_paye_period() returns trigger language plpgsql set search_path='' as $$
begin
 if new.period<date '2026-01-01' then raise exception 'Automatic PAYE supports payroll from January 2026. Earlier periods need a historical tax schedule.';end if;
 return new;
end $$;
revoke all on function payroll_private.check_paye_period() from public,anon,authenticated;
create trigger payroll_paye_period before insert on public.payroll_runs for each row execute function payroll_private.check_paye_period();
notify pgrst,'reload schema';

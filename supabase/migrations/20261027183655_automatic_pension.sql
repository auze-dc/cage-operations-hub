-- Automatic minimum pension contributions under Pension Act 2023, section 12.
-- Allowance pension treatment follows the 2025 Pensionable Emoluments Directive.
-- Changes affect new salary saves and draft edits, not approved snapshots.
create or replace function payroll_private.amounts(input jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text;n numeric;result jsonb:='{}';g numeric;d numeric;entry jsonb;entries jsonb;normalised jsonb:='[]';label text;allowance_total numeric:=0;treatment text;pension_regular numeric:=0;pension_housing numeric:=0;pension_base numeric;
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
 return result;
end $$;

-- The checked RPC still owns all writes. No public grants or RLS changes.
notify pgrst,'reload schema';

-- Rollback-only pension arithmetic and target net salary checks.
begin;
do $$
declare a jsonb:='{"basic":500000,"overtime":0,"bonus":0,"advance":0,"other_deductions":0,"allowances":0,"allowance_items":[]}';v jsonb;
begin
 v:=payroll_private.amounts(a||'{"pension":99999,"employer_pension":0}');
 if (v->>'pension')::numeric<>25000 or (v->>'employer_pension')::numeric<>50000 or (v->>'pensionable_income')::numeric<>500000 then raise exception 'Automatic pension or forged pension handling failed';end if;
 v:=payroll_private.amounts(a||'{"allowance_items":[{"name":"Regular","amount":30000,"pension_treatment":"regular"},{"name":"Housing","amount":250000,"pension_treatment":"housing_excess"},{"name":"Business travel","amount":20000,"pension_treatment":"excluded"}],"overtime":10000,"bonus":10000}');
 if (v->>'pensionable_income')::numeric<>580000 or (v->>'pension')::numeric<>29000 or (v->>'employer_pension')::numeric<>58000 or (v->>'taxable_income')::numeric<>820000 then raise exception 'Pension treatment, housing threshold, or excluded overtime/bonus failed';end if;
 v:=payroll_private.amounts(a||'{"allowance_items":[{"name":"Housing 1","amount":150000,"pension_treatment":"housing_excess"},{"name":"Housing 2","amount":100000,"pension_treatment":"housing_excess"}]}');
 if (v->>'pensionable_income')::numeric<>550000 then raise exception 'Housing threshold must apply once to all housing entries';end if;
 v:=payroll_private.amounts(a||'{"allowance_items":[{"name":"Housing","amount":200000,"pension_treatment":"housing_excess"}]}');
 if (v->>'pensionable_income')::numeric<>500000 then raise exception 'Housing at 40 percent should not increase pension base';end if;
 v:=payroll_private.amounts(a||'{"basic":2450833.34,"pension":0,"employer_pension":0}');
 if (v->>'paye')::numeric<>728291.67 or (v->>'pension')::numeric<>122541.67 or (v->>'employer_pension')::numeric<>245083.33 or (v->>'basic')::numeric-(v->>'paye')::numeric-(v->>'pension')::numeric<>1600000 then raise exception 'K1.6m target take-home gross-up failed';end if;
 begin perform payroll_private.amounts(a||'{"allowance_items":[{"name":"Allowance","amount":100,"pension_treatment":"unknown"}]}');raise exception 'Invalid pension treatment accepted';exception when raise_exception then if sqlerrm='Invalid pension treatment accepted' then raise;end if;end;
end $$;
rollback;
select 'PASS: 5% employee / 10% employer pension, authoritative deductions, regular/excluded/housing treatment, aggregate housing threshold, overtime/bonus exclusion, and K1,600,000 take-home' as result;

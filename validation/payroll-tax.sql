-- Server arithmetic and validation. Fixtures and permissions workflow: payroll.sql.
begin;
do $$declare a jsonb;v jsonb;expected numeric;row record;begin
 for row in select * from (values
  (0::numeric,0::numeric),(169999.99,0),(170000,0),(170000.01,0),(170000.02,.01),
  (500000,99000),(1000000,249000),(1569999.99,420000),(1570000,420000),
  (1570001,420000.35),(2000000,570500),(10000000,3370500),(10000001,3370500.40),(11000000,3770500)
 ) x(income,tax) loop
  if payroll_private.monthly_paye(row.income)<>row.tax then raise exception 'PAYE mismatch at %',row.income;end if;
 end loop;
 a:='{"basic":500000,"overtime":0,"bonus":10000,"paye":0,"allowances":999999,"pension":25000,"advance":0,"other_deductions":0,"employer_pension":50000,"allowance_items":[{"name":" Housing ","amount":50000},{"name":"Transport","amount":20000}]}';
 v:=payroll_private.amounts(a);
 if (v->>'allowances')::numeric<>70000 or (v->>'paye')::numeric<>123000 or (v->>'taxable_income')::numeric<>580000 or v->'allowance_items'->0->>'name'<>'Housing' then raise exception 'Named allowance total, trimming, PAYE base or server-authoritative calculation failed';end if;
 if (payroll_private.amounts(a||'{"pension":0,"advance":10000}') ->>'paye')::numeric<>123000 then raise exception 'Employee deductions incorrectly reduced PAYE base';end if;
 v:=payroll_private.amounts((a-'allowance_items')||'{"allowances":50000}');
 if v->'allowance_items'->0->>'name'<>'Other allowance' or (v->>'allowances')::numeric<>50000 then raise exception 'Legacy allowance compatibility failed';end if;
 v:=payroll_private.amounts(a||'{"allowance_items":[]}');
 if (v->>'allowances')::numeric<>0 or (v->>'paye')::numeric<>102000 then raise exception 'Remove all allowances failed';end if;
 begin perform payroll_private.amounts(a||'{"allowance_items":[{"name":" ","amount":10}]}');raise exception 'Empty name accepted';exception when raise_exception then if sqlerrm='Empty name accepted' then raise;end if;end;
 begin perform payroll_private.amounts(a||'{"allowance_items":[{"name":"Housing","amount":-1}]}');raise exception 'Negative allowance accepted';exception when raise_exception then if sqlerrm='Negative allowance accepted' then raise;end if;end;
 begin perform payroll_private.amounts(a||'{"allowance_items":{"Housing":100}}');raise exception 'Malformed list accepted';exception when raise_exception then if sqlerrm='Malformed list accepted' then raise;end if;end;
 begin perform payroll_private.amounts(a||jsonb_build_object('allowance_items',(select jsonb_agg(jsonb_build_object('name','Allowance '||n,'amount',1)) from generate_series(1,51) n)));raise exception 'Unlimited allowances accepted';exception when raise_exception then if sqlerrm='Unlimited allowances accepted' then raise;end if;end;
end $$;
rollback;
select 'PASS: PAYE brackets and boundaries, marginal rates, rounding, cash tax base, named allowance validation, ignored forged totals/PAYE, legacy aggregate compatibility; rolled back' as result;

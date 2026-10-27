-- Cover composite foreign keys in their declared order.
create index payroll_items_run_org on public.payroll_items(run_id,organization_id);
create index payroll_payments_item_org on public.payroll_payments(item_id,organization_id);
drop index public.payroll_payments_item;

-- Additive: existing vacancies and historical applications are preserved.
alter table public.job_openings
  add column responsibilities text not null default '',
  add column desirable_skills text not null default '',
  add column benefits text not null default '',
  add column work_arrangement text not null default 'On-site' check (work_arrangement in ('On-site','Hybrid','Remote')),
  add column duration text not null default '',
  add column positions integer not null default 1 check (positions between 1 and 1000),
  add column compensation text not null default '',
  add column cover_note_required boolean not null default false,
  add column screening_questions text[] not null default '{}';
alter table public.job_applications
  add column salary_expectation numeric(14,2),
  add column salary_currency text,
  add column salary_period text,
  add column screening_answers jsonb not null default '[]'::jsonb,
  add constraint application_salary_valid check (
    (salary_expectation is null and salary_currency is null and salary_period is null)
    or (salary_expectation is not null and salary_expectation between 0 and 999999999999 and salary_currency is not null and salary_currency in ('MWK','USD','GBP','EUR','ZAR') and salary_period is not null and salary_period in ('month','year','day','hour'))
  ),
  add constraint screening_answers_array check (jsonb_typeof(screening_answers)='array' and jsonb_array_length(screening_answers)<=5);

-- Invoker validation does not widen access or change existing RLS / MFA policies.
create function public.validate_vacancy_content() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='UPDATE' then new.updated_at=clock_timestamp(); end if;
  if cardinality(new.screening_questions)>5 or exists(select 1 from unnest(new.screening_questions) q where q is null or length(btrim(q))=0 or length(q)>250) or cardinality(new.screening_questions)<>(select count(distinct q) from unnest(new.screening_questions) q) then
    raise exception 'Use up to 5 different screening questions of at most 250 characters';
  end if;
  if length(new.description)>12000 or length(new.requirements)>12000 or length(new.responsibilities)>12000 or length(new.benefits)>12000 or length(new.desirable_skills)>12000 then raise exception 'Vacancy content is too long'; end if;
  if new.status='Open' and (length(btrim(coalesce(new.title,'')))=0 or length(btrim(coalesce(new.department,'')))=0 or length(btrim(coalesce(new.location,'')))=0 or length(btrim(coalesce(new.description,'')))=0 or length(btrim(coalesce(new.requirements,'')))=0 or new.closing_date < (now() at time zone 'Africa/Blantyre')::date) then
    raise exception 'Complete role details, description, requirements and a current closing date before publishing';
  end if;
  return new;
end $$;
revoke all on function public.validate_vacancy_content() from public, anon, authenticated;
create trigger validate_vacancy_content before insert or update on public.job_openings for each row execute function public.validate_vacancy_content();

create function public.validate_application_salary() returns trigger language plpgsql set search_path='' as $$
begin
  if new.salary_expectation is null or new.salary_currency is null or new.salary_period is null then raise exception 'Salary expectation, currency and pay period are required'; end if;
  return new;
end $$;
revoke all on function public.validate_application_salary() from public, anon, authenticated;
create trigger validate_application_salary before insert on public.job_applications for each row execute function public.validate_application_salary();

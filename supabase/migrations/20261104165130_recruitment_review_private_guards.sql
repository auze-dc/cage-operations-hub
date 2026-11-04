-- Explicit default-deny policies; guarded owner-executed helpers remain the only access path.
create policy internal_helpers_only on recruitment_private.review_events for all to public using (false) with check (false);
create policy internal_helpers_only on recruitment_private.review_receipts for all to public using (false) with check (false);

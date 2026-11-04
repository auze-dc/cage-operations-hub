# Recruitment reviews

In Recruitment & HR, choose a vacancy and select **Review applicant** on a candidate card. Recruitment staff can add a private review note, record a complete scorecard, change the stage with a reason, or assign an active recruitment reviewer. **Assigned to me** narrows the candidate board to the signed-in reviewer's queue.

The four equally weighted criteria are role-specific skills, relevant experience, communication for the role and problem-solving. Each uses the same 1–5 evidence scale shown in the panel. Scorecards retain each reviewer's name, time, rationale and previous versions; the panel shows the latest scorecard per reviewer. Scores do not change the candidate stage or select candidates automatically.

History begins when this feature is enabled. Existing stages, screening notes and legacy scores are preserved, with earlier notes explicitly identified as having no recorded author/time. No historical reasons are fabricated. Existing interview/calendar stage updates continue working and are audited; when that workflow supplies no reason, the entry says so. Recording an Offer stage does not generate or send an offer letter.

Review records and retry receipts live in a private database schema. Public RPC wrappers use the existing authenticated recruitment roles, organisation scope, HR module access and MFA checks. Read-only recruitment access cannot save. Assignment does not grant or broaden permissions. Inactive or other-organisation reviewers cannot be newly assigned.

Notes, scorecards and audit entries are append-only through the application workflow. Actor identity and timestamps are assigned by the database. All application updates advance a review version; the save operation locks the application and rejects stale edits. Save request IDs prevent duplicate entries after an uncertain network response. History is paginated. Browser storage and the generic refresh cache do not retain private review drafts; failed saves keep the text in the open panel. Closing the panel discards an unsaved draft.

Deployment uses the additive SQL in `supabase/setup/recruitment_reviews.sql`, then the matching applied migration version in `supabase/migrations`. Existing application submission APIs and file storage are unchanged. No real applicant decisions, notes, scorecards, assignments or emails should be created for deployment testing. SQL and DOM regressions use isolated fixtures.

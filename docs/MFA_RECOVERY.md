# CAGE two-step verification and recovery

Administrator accounts must enroll an authenticator and complete AAL2 verification before the workspace opens. Any other account that has enrolled a verified factor must also verify it. CAGE never stores setup keys or one-time codes in application storage or logs.

## Normal enrollment

1. Sign in to hub.cagemw.com with your existing password.
2. Add the displayed QR code or setup key to an authenticator app on your own device.
3. Enter the current six-digit code. Keep the authenticator accessible for future sign-ins.
4. Verify another sign-in before retiring an old device. Never send a setup key or code to support.

Cancellation leaves the workspace closed and removes only the unverified factor created by that attempt. A network failure offers normal sign-in retry; it must not silently open a workspace.

## Lost device

The Supabase project owner must verify the staff member's identity using an established independent channel and record the recovery incident privately. Review account activity, revoke sessions, and reset the lost MFA factor using the supported Supabase Auth administration interface. The administrator must enroll a new authenticator on the next sign-in. Resetting a password alone does not replace MFA. Do not disable the organization-wide guard to recover one account.

No recovery factors or owner credentials are stored in this repository. A real device recovery exercise, including revocation verification, remains a go-live acceptance task.

## Enforcement

- The exact read-only hub_security_status RPC permits the signed-in caller to learn only their own enrollment requirement.
- A PostgREST pre-request guard protects table/view requests and SECURITY DEFINER RPCs. It refuses to overwrite an unrelated pre-request hook.
- Restrictive RLS policies protect public tables and storage.objects without granting new rows; existing ownership and role policies still apply.
- admin-users and notify-interview explicitly check caller-session assurance before using service privileges. Other staff Edge routes make authorization calls with the caller's database client; these are subject to the same Data API guard.
- Anonymous public applications, token-based client responses, service-role scheduled jobs and their original permissions remain separate. This change does not grant access to them.

## Release order

1. Pass isolated database, DOM, sign-in regression, production build and dependency checks.
2. Deploy the MFA-capable frontend.
3. Apply the tested setup SQL using the managed migration tool; record its generated migration version.
4. Deploy the two Edge changes, preserving their existing verify_jwt setting.
5. Verify role-based denial/allowance, hook configuration and policy coverage in production using rollback-only fixtures. Verify public routes and service-role permissions separately.
6. Have each administrator complete their own enrollment and recovery acceptance checks.

If a regression requires rollback, use the reviewed previous release and a narrowly scoped database rollback. Do not remove MFA enforcement while verified accounts are relying on it without an incident decision by the system owner.

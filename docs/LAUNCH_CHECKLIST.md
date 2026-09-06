# Launch checklist

## Infrastructure

- [ ] Private CAGE GitHub repository created
- [ ] Supabase migrations 001 and 003 completed
- [ ] Cloudflare Pages deployment successful
- [ ] `hub.cagemw.com` has active HTTPS
- [ ] Public sign-up disabled
- [ ] Resend domain verified
- [ ] Edge Functions deployed
- [ ] Opportunity scan test completed

## Accounts and permissions

- [ ] Alexander and Ndapile can perform administrator actions
- [ ] Comfort, Ian, Mayamiko and Bonifancio cannot perform admin approvals
- [ ] CAGE Team is not assignable and cannot request leave
- [ ] Administrator can invite, deactivate and change a user's role
- [ ] User cannot remove their own administrator access
- [ ] Password reset works
- [ ] An unapproved address cannot access the Hub

## Workflow acceptance

- [ ] New request can be created and qualified
- [ ] Admin can add a request purpose
- [ ] Request stage gates work
- [ ] Qualified request links to CRM
- [ ] CRM cards can be created, edited and dragged
- [ ] Accepted request creates the delivery workflow
- [ ] Work Board cards can be created, edited and dragged
- [ ] Work Chat appears in a second signed-in browser
- [ ] Mission readiness gates work
- [ ] Quote approval is enforced
- [ ] Test quote and invoice emails arrive and are logged
- [ ] Leave and report workflows work
- [ ] HR can publish a vacancy
- [ ] Applicant can submit a CV through `/careers.html`
- [ ] Ordinary member cannot read candidate applications
- [ ] HR can move a candidate and schedule an interview
- [ ] Employee can upload and reopen their own CV or certificate

## Protection and cutover

- [ ] Old browser-local data exported
- [ ] Production record counts reconciled
- [ ] Backup stored securely
- [ ] `audit_log` records a test update
- [ ] No secret appears in GitHub
- [ ] Supabase Pro/backups decision recorded
- [ ] Five-day staff pilot completed
- [ ] Alexander and Ndapile approve production use
- [ ] Team informed that Work Chat is the official operational record

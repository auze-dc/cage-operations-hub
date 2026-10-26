# Company Documents

Open **Compliance → Company Documents**. All active staff, including viewer-role staff, can upload, download, edit, replace and archive company documents. Shared accounts, inactive users and anonymous visitors have no access. Each organisation is isolated.

## Daily use

- Upload a document, select its category and optionally record its reference, issuer, issue/expiry dates and renewal owner.
- Link it to existing requirements in the upload/edit form. The requirement register displays the linked documents alongside existing references.
- Search by title, reference, issuer or notes; filter by category, expiry status or Archived.
- **Details → Edit / upload new version** preserves old files. Details contains version downloads and the most recent 100 activity entries; all entries are retained in the database.
- Archive uses an in-app confirmation. Restore through the Archived filter. Archived documents retain files, history and existing opportunity links.
- In a tender/grant's **Supporting files**, choose **Company documents** to link or unlink library documents. These are references to the latest version, not copies or automatic client deliveries.
- Overview shows expired documents and renewals due within 30 days. Dates without an expiry are explicitly labelled. Existing compliance requirements remain in Requirements & Renewals. This feature does not schedule new outbound emails.

## Storage and access

The private `company-documents` bucket accepts PDF, JPEG/PNG, Word, Excel and text files up to 20 MB. Downloads use 60-second signed URLs. Files are immutable once registered; failed unregistered uploads can be cleaned up by their uploader. An interrupted upload/save can leave an unregistered object; no automatic deletion is attempted after an ambiguous network failure.

Document metadata, immutable versions, opportunity links and activity are separate from `workspace_states`. Saving documents does not lock or rewrite the shared workspace JSON. RPC mutations validate active staff membership, organisation, owner and requirement links. Revision checks reject stale writes. Other module permissions are preserved.

## Deployment and verification

Apply both `company_documents` and `company_document_storage_guard` migrations, then deploy `dist/` through the existing main-branch Cloudflare pipeline. No Edge Function or secret change is required.

Checks:

- `npm run check`
- `NODE_PATH=/path/to/jsdom/node_modules node validation/company-documents.cjs`
- `validation/company-documents.sql`: rollback-only database assertions for member access, org isolation, conflicts, archive/restore, audit and anonymous protection.
- `validation/company-document-versions.sql`: optional rollback-only test of storage metadata registration and immutable versions. This tests metadata, not actual file transport; run only where direct storage metadata fixtures are allowed. The remote connector returned an expired-request error on this check during implementation, so it is not recorded as passed.

An authenticated browser upload/download smoke test remains necessary; browser session observation was unavailable during implementation. Production assets are checked independently after deployment.

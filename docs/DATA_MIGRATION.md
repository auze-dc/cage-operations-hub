# Migrate ChatGPT-hosted Version 9 data

The original Version 9 stores changes in the browser under Local Storage key `cage-operations-hub-prototype-v1`. Data exists only in the browser profile where it was entered.

## Export the old state

1. Open the original Hub in the same browser profile previously used.
2. Open browser Developer Tools.
3. Select **Application → Local storage → the CAGE Hub address**.
4. Find `cage-operations-hub-prototype-v1`.
5. Copy its complete JSON value into a plain-text file.
6. Wrap it as follows, without quotation marks around the pasted object:

```json
{
  "product": "CAGE Operations Hub",
  "schemaVersion": 1,
  "exportedAt": "2026-09-05T00:00:00Z",
  "data": PASTE_THE_OLD_JSON_OBJECT_HERE
}
```

## Import into production

1. Sign in as Alexander or Ndapile.
2. Open **Reports → Import workspace backup**.
3. Choose the JSON file and confirm.
4. Reconcile counts in Projects, Requests, CRM, Finance and Work Chat.
5. Export a fresh backup and store it securely.

Keep the original site unchanged until migration and the five-day pilot are accepted.

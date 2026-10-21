# CAGE opportunity matching

Discover includes direct CAGE service matches and potential innovation, enterprise and environmental grants. Unconfirmed eligibility is labelled rather than hidden. Generic consultancy, construction and marketing tenders do not qualify. Broader thematic funding calls are labelled Potential grant fit. Matching focuses on drones, geospatial/remote sensing, precision agriculture and relevant STEM/drone training.

Country evidence is extracted from applicant wording on official notice pages, separately from project location. Explicit applicant restrictions exclude a notice from discovery. Search snippets and ambiguous conditions remain unconfirmed; this is not an automated legal eligibility determination. Other conditions (registration, turnover, consortium and experience) still require staff review.

Needs verification is an optional filtered view of relevant leads with unconfirmed country evidence; these leads also appear in Discover. All and existing pipeline views preserve history and staff notes. Staff-confirmed applicant routes can admit manually reviewed leads, but an explicit detected exclusion remains visible as a restriction. Old scanner results are reclassified from stored evidence once; fresh notice retrieval can establish stronger evidence.

LinkedIn public posts are discovered through search-indexed results. Profiles, jobs and private feeds are not crawled. Posts remain leads for review against an official application notice. There is no promise of complete LinkedIn coverage and no LinkedIn login is required.

The existing twice-daily schedule remains. Authenticated scanner Cron calls may request runNow:true for a one-off scan; the existing manual scan lock/rate limit still applies. Tokens stay in Vault.

Validation: npm run check; node validation/scanner-cron-auth.mjs; CAGE_TEST_MODULES=<directory containing jsdom 26.1.0> node validation/opportunity-fit.mjs.

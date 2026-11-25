# Currency selection

Records support MWK, USD, GBP and EUR. Currency belongs to each record; choosing a code does not convert existing figures. Records without a currency retain the historical MWK meaning.

Currency selection covers requests, CRM opportunities, commercial records, approval requests, quotations, invoices, expenses (including offline receipt drafts), course defaults and application calls. Linked request/opportunity/commercial records copy currency with value. Quotation order documents, invoices, payments, receipts and PDFs retain the transaction currency. Payment entry uses the selected invoice currency. Currency cannot change once an invoice has payments.

Dashboard, pipeline, finance, report and project totals group currencies separately. Project margins match revenue and costs by currency. No exchange-rate service or implicit conversion is used.

Salary entry supports the four currencies with a required manually entered MWK-per-unit rate for foreign currencies. Salary fields and allowances convert to MWK before PAYE and pension calculation. Stored amounts, statutory calculations and payment records remain MWK; the reviewed entry code/rate are snapshotted and shown on payslips with a net equivalent. Reopening or creating a run never converts stored amounts twice. Changing entry currency clears the rate and requires a fresh rate. Existing statutory bands and pension rules are unchanged.

Validation: actual form handlers and four-currency saves, decimal line items, grouped dashboard/project totals, request propagation, edit retention, payroll conversion and reopen; eight generated quote/invoice PDFs checked with pdftotext; local PostgreSQL currency constraints/payment lock/FX validation and idempotence; existing pension SQL and sign-in/background/runtime guards. Live database migration checked for USD reference persistence, repeat-safe normalization, MWK course default, preserved private payroll privileges and course RLS.

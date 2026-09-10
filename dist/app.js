const STORAGE_KEY = "cage-operations-hub-production-cache-v1";
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Blantyre" });
const GENERAL_CHAT_THREAD_ID = "team:general-enquiries";

const CORE_REQUEST_PURPOSES = [
  "Drone mapping", "Inspection / thermal", "Agriculture service", "Aerial filming",
  "Equipment hire", "RPL training", "GIS / data processing", "Tender / RFQ",
  "Grant", "Partnership", "General enquiry"
];

const seedData = {
  team: [
    { id: "alexander", name: "Alexander DC Mtambo", email: "alexander@cagemw.com", role: "Head of Operations / Chief Pilot", access: "Administrator", initials: "AM" },
    { id: "ndapile", name: "Ndapile Mkuwu", email: "ndapile@cagemw.com", role: "Managing Director / Accountable Manager", access: "Administrator", initials: "NM" },
    { id: "comfort", name: "Comfort Claire Mwenje", email: "comfort@cagemw.com", role: "Operations, Client Relations & STEM", access: "Standard user", initials: "CM" },
    { id: "ian", name: "Ian Mtika", email: "ian@cagemw.com", role: "Flight Operations & Technical", access: "Standard user", initials: "IM" },
    { id: "mayamiko", name: "Mayamiko C. Ndala", email: "mayamiko@cagemw.com", role: "Sales & Technical Support", access: "Standard user", initials: "MN" },
    { id: "bonifancio", name: "Bonifancio Nguluwe", email: "bonfancio@cagemw.com", role: "GIS & Digital Strategy Intern", access: "Standard user", initials: "BN" },
    { id: "cage-team", name: "CAGE Team", email: "info@cagemw.com", role: "Shared company account", access: "Standard user", initials: "CT", assignable: false }
  ],
  projects: [
    {
      id: "p-geoportal",
      name: "Drone Data Geoportal",
      client: "UNDP",
      owner: "alexander",
      team: ["alexander", "ndapile", "ian", "comfort", "bonifancio"],
      deadline: "2027-11-30",
      category: "Growth Accelerator",
      outcome: "Deliver a scalable geospatial data platform that organises CAGE drone and public datasets for decision-makers.",
      request: "rq-0031",
      commercial: "cm-002"
    },
    {
      id: "p-area47",
      name: "Mapping — Lilongwe Area 47",
      client: "CAGE",
      owner: "ian",
      team: ["ian", "bonifancio"],
      deadline: "2026-09-10",
      category: "Mapping & Data",
      outcome: "Produce a quality-controlled Area 47 orthomosaic and complete metadata package ready for the Geoportal."
    },
    {
      id: "p-dodma",
      name: "Disaster Risk Management — Karonga",
      client: "DODMA",
      owner: "ndapile",
      team: ["ndapile", "alexander", "comfort", "mayamiko"],
      deadline: "2026-12-01",
      category: "Disaster Risk",
      outcome: "Complete household risk data, communication activities and programme reporting for TA Kyungu."
    },
    {
      id: "p-rpl",
      name: "RPL Refresher — September 2026",
      client: "CAGE Training",
      owner: "comfort",
      team: ["comfort", "ian", "mayamiko"],
      deadline: "2026-09-18",
      category: "Training",
      outcome: "Deliver a compliant refresher programme and complete trainee evidence and certification records.",
      request: "rq-0033",
      commercial: "cm-006"
    },
    {
      id: "p-nyika",
      name: "Mapping — Nyika Hydropower",
      client: "Nyika Hydropower Group",
      owner: "mayamiko",
      team: ["mayamiko", "ian"],
      deadline: "2026-09-30",
      category: "Mapping & Data",
      outcome: "Capture and deliver the agreed hydropower-site mapping products with documented field and processing QA."
    },
    {
      id: "p-rental",
      name: "Equipment Hire — Drone Link",
      client: "Drone Link",
      owner: "mayamiko",
      team: ["mayamiko", "ian"],
      deadline: "2026-09-23",
      category: "Equipment Hire",
      outcome: "Complete the ten-day equipment hire with signed handover, equipment condition records and payment documentation.",
      request: "rq-0032",
      commercial: "cm-005"
    },
    {
      id: "p-turkiye",
      name: "Processing — Türkiye — GLOBHE",
      client: "GLOBHE",
      owner: "bonifancio",
      team: ["bonifancio", "ian"],
      deadline: "2026-09-08",
      category: "Mapping & Data",
      outcome: "Process and quality-check the square dataset to the client’s agreed format and delivery standard."
    },
    {
      id: "p-stem",
      name: "Drone STEM Pilot",
      client: "CAGE STEM",
      owner: "comfort",
      team: ["comfort", "bonifancio", "mayamiko"],
      deadline: "2026-09-12",
      category: "Training",
      outcome: "Conclude the pilot with attendance, learning outcomes, parent feedback and recommendations for the next cohort."
    },
    {
      id: "p-internal",
      name: "CAGE Internal Operations",
      client: "CAGE",
      owner: "alexander",
      team: ["alexander", "ndapile", "comfort", "ian", "mayamiko", "bonifancio"],
      deadline: "2026-12-31",
      category: "Internal",
      outcome: "Keep internal priorities, administration and company-wide improvements visible and accountable."
    }
  ],
  tasks: [
    { id: "t-001", project: "p-geoportal", title: "Approve Geoportal concept and scope", owner: "alexander", due: "2026-06-12", priority: "High", status: "Done", output: "Approved concept, target users and first-release scope.", evidence: "Geoportal Concept Note v3.pdf", updated: "2026-08-28" },
    { id: "t-002", project: "p-geoportal", title: "Document first platform architecture", owner: "ian", due: "2026-07-03", priority: "High", status: "Done", output: "Reviewed platform architecture showing data ingestion, storage and presentation layers.", evidence: "Architecture Review.pdf", updated: "2026-07-03" },
    { id: "t-003", project: "p-geoportal", title: "Confirm processing hardware baseline", owner: "ian", due: "2026-07-10", priority: "Medium", status: "Done", output: "Minimum workstation and storage specification approved.", evidence: "Hardware Baseline.xlsx", updated: "2026-07-09" },
    { id: "t-004", project: "p-geoportal", title: "Develop regional data-structure document", owner: "bonifancio", due: "2026-07-20", priority: "High", status: "Doing", output: "Document the folder, layer, metadata and access structure for local and regional datasets.", evidence: "", updated: "2026-09-02" },
    { id: "t-005", project: "p-geoportal", title: "Complete North Rukuru deliverable package", owner: "ian", due: "2026-08-14", priority: "High", status: "Doing", output: "Quality-controlled orthomosaic, DSM, DTM and metadata package.", evidence: "", updated: "2026-08-31" },
    { id: "t-006", project: "p-geoportal", title: "Secure three institutional partnerships", owner: "alexander", due: "2026-07-31", priority: "High", status: "To Do", output: "Three signed MOUs with institutions that can supply, use or validate Geoportal data.", evidence: "", updated: "2026-08-25" },
    { id: "t-007", project: "p-geoportal", title: "Complete sales and distribution strategy", owner: "ndapile", due: "2026-07-31", priority: "High", status: "To Do", output: "Approved sales, distribution and marketing strategy with target users, pricing logic and channels.", evidence: "", updated: "2026-08-25" },

    { id: "t-010", project: "p-area47", title: "Complete Area 47 flight capture", owner: "ian", due: "2026-09-01", priority: "High", status: "Done", output: "Complete planned Area 47 aerial image coverage with flight logs.", evidence: "Area47 Flight Logs.zip", updated: "2026-09-03" },
    { id: "t-011", project: "p-area47", title: "Generate Area 47 orthomosaic", owner: "bonifancio", due: "2026-09-02", priority: "High", status: "Done", output: "Processed orthomosaic covering the completed Area 47 survey area.", evidence: "Area47 Orthomosaic Preview.pdf", updated: "2026-09-03" },
    { id: "t-012", project: "p-area47", title: "Run final QA on Area 47 data", owner: "bonifancio", due: "2026-09-02", priority: "High", status: "Doing", output: "Documented geometry, completeness and visual-quality checks with all defects resolved.", evidence: "", updated: "2026-09-04" },
    { id: "t-013", project: "p-area47", title: "Publish Area 47 metadata package", owner: "bonifancio", due: "2026-09-07", priority: "Medium", status: "To Do", output: "Complete metadata and licensing record ready for ingestion into the Geoportal.", evidence: "", updated: "2026-09-03" },

    { id: "t-020", project: "p-dodma", title: "Complete TA Kyungu sensitisation", owner: "ndapile", due: "2026-01-14", priority: "High", status: "Done", output: "Sensitisation session completed and attendance documented.", evidence: "TA Kyungu Attendance.pdf", updated: "2026-01-14" },
    { id: "t-021", project: "p-dodma", title: "Complete household survey dataset", owner: "comfort", due: "2026-02-05", priority: "High", status: "Done", output: "Clean and validated household risk dataset for the target communities.", evidence: "Karonga Survey QA Report.pdf", updated: "2026-02-06" },
    { id: "t-022", project: "p-dodma", title: "Review risk-communication results", owner: "comfort", due: "2026-09-10", priority: "Medium", status: "Doing", output: "Verified delivery results and lessons from multilingual risk communication.", evidence: "", updated: "2026-09-02" },
    { id: "t-023", project: "p-dodma", title: "Prepare final programme report", owner: "mayamiko", due: "2026-09-20", priority: "High", status: "To Do", output: "Draft final report consolidating delivery, outcomes, costs, lessons and recommendations.", evidence: "", updated: "2026-09-01" },

    { id: "t-030", project: "p-rpl", title: "Approve refresher course plan", owner: "comfort", due: "2026-09-01", priority: "High", status: "Done", output: "Approved delivery plan aligned with applicable refresher requirements.", evidence: "September RPL Plan.pdf", updated: "2026-09-01" },
    { id: "t-031", project: "p-rpl", title: "Deliver today’s RPL practical session", owner: "comfort", due: "2026-09-04", priority: "High", status: "Doing", output: "Complete practical session with signed attendance and instructor notes.", evidence: "", updated: "2026-09-04" },
    { id: "t-032", project: "p-rpl", title: "Confirm aircraft and battery readiness", owner: "ian", due: "2026-09-05", priority: "High", status: "To Do", output: "Signed equipment-readiness checklist for all training aircraft and batteries.", evidence: "", updated: "2026-09-03" },
    { id: "t-033", project: "p-rpl", title: "Send trainee schedule and requirements", owner: "mayamiko", due: "2026-09-04", priority: "Medium", status: "Done", output: "All trainees receive schedule, venue, equipment and documentation requirements.", evidence: "Trainee Notice.pdf", updated: "2026-09-04" },

    { id: "t-040", project: "p-nyika", title: "Confirm mapping brief with client", owner: "mayamiko", due: "2026-09-04", priority: "High", status: "Done", output: "Written confirmation of coverage, accuracy, outputs and delivery date.", evidence: "Nyika Client Brief.pdf", updated: "2026-09-04" },
    { id: "t-041", project: "p-nyika", title: "Prepare field mission plan", owner: "ian", due: "2026-09-08", priority: "High", status: "Doing", output: "Approved site plan covering access, flight blocks, equipment, crew and safety controls.", evidence: "", updated: "2026-09-03" },
    { id: "t-042", project: "p-nyika", title: "Secure flight authorisation", owner: "alexander", due: "2026-09-12", priority: "High", status: "To Do", output: "Required flight authorisation and site approvals filed before deployment.", evidence: "", updated: "2026-09-02" },

    { id: "t-050", project: "p-rental", title: "File signed drone-rental contract", owner: "mayamiko", due: "2026-09-03", priority: "High", status: "Blocked", blocker: "Signed agreement has not yet been attached to the project record.", output: "Signed contract filed and linked to the equipment-hire project.", evidence: "", updated: "2026-09-04" },
    { id: "t-051", project: "p-rental", title: "Complete equipment handover checklist", owner: "ian", due: "2026-09-05", priority: "High", status: "To Do", output: "Signed handover record covering aircraft, batteries, accessories and condition.", evidence: "", updated: "2026-09-03" },

    { id: "t-060", project: "p-turkiye", title: "Process Türkiye square dataset", owner: "bonifancio", due: "2026-09-01", priority: "High", status: "Doing", output: "Complete processed dataset in the agreed client coordinate system and format.", evidence: "", updated: "2026-09-04" },
    { id: "t-061", project: "p-turkiye", title: "Complete independent quality review", owner: "ian", due: "2026-09-06", priority: "High", status: "To Do", output: "Signed QA checklist confirming coverage, geometry, artefacts, naming and packaging.", evidence: "", updated: "2026-09-03" },

    { id: "t-070", project: "p-stem", title: "Complete pilot learning sessions", owner: "comfort", due: "2026-08-29", priority: "High", status: "Done", output: "All planned pilot sessions delivered with attendance records.", evidence: "STEM Attendance Register.xlsx", updated: "2026-08-29" },
    { id: "t-071", project: "p-stem", title: "Prepare pilot outcomes report", owner: "comfort", due: "2026-09-08", priority: "Medium", status: "Doing", output: "Concise report on attendance, learning, parent feedback and next-cohort recommendations.", evidence: "", updated: "2026-09-03" }
  ],
  contacts: [
    { id: "c-undp", company: "UNDP Malawi", contact: "Growth Accelerator team", relationship: "Partner", owner: "alexander", lastActivity: "2026-09-02", nextAction: "2026-09-09", note: "Geoportal grant delivery and milestones" },
    { id: "c-eed", company: "EED Advisory", contact: "ESCOM digital twin team", relationship: "Prospect", owner: "alexander", lastActivity: "2026-09-03", nextAction: "2026-09-07", note: "Drone capture methodology and commercial submission" },
    { id: "c-leigh", company: "Leigh Day", contact: "Malawi fieldwork team", relationship: "Prospect", owner: "comfort", lastActivity: "2026-09-01", nextAction: "2026-09-08", note: "Chikwawa farmland mapping requirements" },
    { id: "c-acrew", company: "ACrew4U", contact: "Bookings team", relationship: "Prospect", owner: "comfort", lastActivity: "2026-08-27", nextAction: "2026-09-11", note: "KCH aerial promotional footage" },
    { id: "c-sfc", company: "Small Farm Cities Malawi", contact: "Partnership team", relationship: "Partner", owner: "mayamiko", lastActivity: "2026-09-02", nextAction: "2026-09-15", note: "Precision agriculture partnership" },
    { id: "c-dronelink", company: "Drone Link", contact: "Equipment hire contact", relationship: "Client", owner: "mayamiko", lastActivity: "2026-09-04", nextAction: "2026-09-05", note: "Equipment handover and invoice follow-up" }
  ],
  deals: [
    { id: "d-escom", name: "ESCOM digital twin field capture", company: "EED Advisory", owner: "alexander", value: 122500000, stage: "Proposal", probability: 60, nextAction: "2026-09-07", nextStep: "Submit final methodology and CAGE commercial position", project: "" },
    { id: "d-leigh", name: "Chikwawa farmland evidence capture", company: "Leigh Day", owner: "comfort", value: 17500000, stage: "Qualified", probability: 40, nextAction: "2026-09-08", nextStep: "Confirm plot locations, dates and required survey accuracy", project: "" },
    { id: "d-acrew", name: "KCH aerial promotional footage", company: "ACrew4U", owner: "comfort", value: 4800000, stage: "Lead", probability: 20, nextAction: "2026-09-11", nextStep: "Confirm shooting dates and final shot list", project: "" },
    { id: "d-sfc", name: "Smallholder precision agriculture partnership", company: "Small Farm Cities Malawi", owner: "mayamiko", value: 35000000, stage: "Negotiation", probability: 80, nextAction: "2026-09-15", nextStep: "Agree pilot scope, farm cluster and cost-sharing model", project: "" },
    { id: "d-rental", name: "Ten-day drone equipment hire", company: "Drone Link", owner: "mayamiko", value: 15900000, stage: "Won", probability: 100, nextAction: "2026-09-05", nextStep: "Complete signed equipment handover", project: "p-rental" }
  ],
  events: [
    { id: "ev-rpl", title: "RPL practical session", date: "2026-09-04", start: "09:00", end: "13:00", type: "Training", owner: "comfort", project: "p-rpl", attendees: "September RPL cohort · CAGE training site" },
    { id: "ev-eed", title: "ESCOM / EED methodology review", date: "2026-09-07", start: "10:00", end: "11:00", type: "Meeting", owner: "alexander", project: "", attendees: "EED Advisory · Online" },
    { id: "ev-nyika", title: "Nyika field mission review", date: "2026-09-08", start: "14:00", end: "15:00", type: "Field", owner: "ian", project: "p-nyika", attendees: "Flight team · Operations room" },
    { id: "ev-area47", title: "Area 47 data handover", date: "2026-09-10", start: "11:00", end: "12:00", type: "Deadline", owner: "bonifancio", project: "p-area47", attendees: "Geoportal team" },
    { id: "ev-caa", title: "CAA authorisation follow-up", date: "2026-09-12", start: "09:30", end: "10:00", type: "Meeting", owner: "alexander", project: "p-nyika", attendees: "MCAA" },
    { id: "ev-sfc", title: "Small Farm Cities partnership session", date: "2026-09-15", start: "10:30", end: "12:00", type: "Meeting", owner: "mayamiko", project: "", attendees: "Small Farm Cities Malawi" }
  ],
  invoices: [
    { id: "inv-26041", number: "INV-26041", client: "UNDP Malawi", project: "p-geoportal", issued: "2026-08-22", due: "2026-09-06", amount: 10500000, status: "Sent", description: "Geoportal implementation milestone" },
    { id: "inv-26042", number: "INV-26042", client: "Drone Link", project: "p-rental", issued: "2026-08-24", due: "2026-09-03", amount: 15900000, status: "Sent", description: "Ten-day drone equipment hire" },
    { id: "inv-26039", number: "INV-26039", client: "CAGE Training", project: "p-rpl", issued: "2026-08-18", due: "2026-08-30", amount: 22000000, status: "Paid", paid: "2026-08-29", description: "September RPL refresher programme" },
    { id: "inv-26043", number: "INV-26043", client: "Nyika Hydropower Group", project: "p-nyika", issued: "2026-09-04", due: "2026-09-18", amount: 18750000, status: "Draft", description: "Mobilisation and mapping milestone" }
  ],
  expenses: [
    { id: "ex-001", description: "Area 47 field mobilisation", project: "p-area47", category: "Field operations", date: "2026-09-02", amount: 1850000, receipt: "Field Cashbook 0902" },
    { id: "ex-002", description: "M4T battery inspection and maintenance", project: "p-nyika", category: "Equipment", date: "2026-09-03", amount: 2400000, receipt: "Workshop Receipt 118" },
    { id: "ex-003", description: "Processing software licences", project: "p-geoportal", category: "Software", date: "2026-09-01", amount: 3100000, receipt: "Software Invoice Sep" },
    { id: "ex-004", description: "RPL training venue and materials", project: "p-rpl", category: "Training", date: "2026-09-04", amount: 1200000, receipt: "Training Expense Pack" },
    { id: "ex-005", description: "Karonga programme field travel", project: "p-dodma", category: "Travel", date: "2026-08-30", amount: 2750000, receipt: "Travel Claim 0830" }
  ],
  boardLists: [
    { id: "list-todo", title: "To do", status: "To Do" },
    { id: "list-doing", title: "In progress", status: "Doing" },
    { id: "list-waiting", title: "Waiting on client", status: null },
    { id: "list-blocked", title: "Blocked", status: "Blocked" },
    { id: "list-done", title: "Done", status: "Done" }
  ],
  quotes: [
    { id: "q-26018", number: "Q-26018", client: "EED Advisory", deal: "d-escom", issued: "2026-09-03", validUntil: "2026-09-24", amount: 122500000, status: "Draft", recipient: "", description: "Drone survey and geospatial capture for ESCOM digital twin fieldwork" },
    { id: "q-26017", number: "Q-26017", client: "Leigh Day", deal: "d-leigh", issued: "2026-09-01", validUntil: "2026-09-18", amount: 17500000, status: "Approved", recipient: "", description: "Chikwawa farmland evidence capture and mapped plot outputs" },
    { id: "q-26016", number: "Q-26016", client: "Drone Link", deal: "d-rental", issued: "2026-08-24", validUntil: "2026-09-05", amount: 15900000, status: "Sent", sentAt: "2026-08-24T10:15:00Z", recipient: "client@example.org", description: "Ten-day drone equipment hire" }
  ],
  leaveRequests: [
    { id: "lv-001", person: "ndapile", type: "Annual leave", start: "2026-09-14", end: "2026-09-18", handover: "Alexander covers management approvals; Comfort covers client responses.", status: "Approved", submitted: "2026-08-28" },
    { id: "lv-002", person: "ian", type: "Annual leave", start: "2026-09-21", end: "2026-09-23", handover: "Bonifancio monitors processing jobs; Mayamiko holds field equipment.", status: "Pending", submitted: "2026-09-03" },
    { id: "lv-003", person: "comfort", type: "Study leave", start: "2026-09-28", end: "2026-10-02", handover: "Mayamiko covers incoming sales enquiries and scheduled client calls.", status: "Approved", submitted: "2026-08-25" }
  ],
  knowledge: [
    { id: "kb-001", title: "CAGE Flight Operations SOP — Version 4", category: "SOP", owner: "alexander", updated: "2026-08-21", project: "", summary: "Standard planning, authorisation, safety, flight execution and incident reporting process for CAGE missions.", link: "Drive / Operations / Flight SOP v4.pdf", pinned: true },
    { id: "kb-002", title: "Matrice 4T field readiness checklist", category: "Template", owner: "ian", updated: "2026-09-03", project: "p-nyika", summary: "Aircraft, D-RTK 3, batteries, firmware, sensors and field kit checks before deployment.", link: "Drive / Templates / M4T Field Checklist.xlsx", pinned: true },
    { id: "kb-003", title: "Geoportal dataset and metadata standard", category: "Technical guide", owner: "bonifancio", updated: "2026-09-02", project: "p-geoportal", summary: "Folder structure, layer naming, coordinate systems, metadata and publication checks for portal-ready datasets.", link: "Drive / Geoportal / Data Standard.pdf", pinned: true },
    { id: "kb-004", title: "Client quotation template", category: "Template", owner: "comfort", updated: "2026-08-30", project: "", summary: "Approved CAGE structure for scope, assumptions, exclusions, payment terms and validity period.", link: "Drive / Commercial / Quotation Template.docx", pinned: false },
    { id: "kb-005", title: "Area 47 mapping QA lessons", category: "Lesson learned", owner: "bonifancio", updated: "2026-09-04", project: "p-area47", summary: "Processing bottlenecks, coverage checks and metadata improvements identified during the Area 47 capture.", link: "Drive / Area 47 / Lessons Learned.md", pinned: false },
    { id: "kb-006", title: "Emergency response and lost-link procedure", category: "SOP", owner: "alexander", updated: "2026-07-15", project: "", summary: "Immediate actions, escalation contacts and documentation required after abnormal flight events.", link: "Drive / Safety / Emergency Procedure.pdf", pinned: false }
  ],
  chatGroups: [],
  messages: [
    { id: "msg-general-001", thread: GENERAL_CHAT_THREAD_ID, sender: "", date: TODAY, time: "08:00", type: "System", text: "General Enquiries is the shared CAGE team space for routine enquiries, quick coordination and company-wide questions that are not linked to a specific work record." },
    { id: "msg-001", project: "p-geoportal", sender: "alexander", date: "2026-09-03", time: "08:42", text: "Let us lock the first-release dataset structure today. We need one standard that works for Area 47 and future global datasets." },
    { id: "msg-002", project: "p-geoportal", sender: "bonifancio", date: "2026-09-03", time: "08:47", text: "I have updated the layer naming and metadata fields. I will share the review copy before lunch.", attachment: "Geoportal Data Structure v2.docx" },
    { id: "msg-003", project: "p-geoportal", sender: "ian", date: "2026-09-03", time: "09:05", text: "Please include a clear raw-data folder. It will make handover from the field team much faster.", unread: true },
    { id: "msg-010", project: "p-area47", sender: "bonifancio", date: "2026-09-04", time: "09:16", text: "The final geometry check is running. I found two small edge gaps and am rebuilding those tiles now." },
    { id: "msg-011", project: "p-area47", sender: "ian", date: "2026-09-04", time: "09:22", text: "Good. Please attach the QA checklist to the task once those tiles pass.", unread: true },
    { id: "msg-020", project: "p-rental", sender: "mayamiko", date: "2026-09-04", time: "11:08", text: "The equipment is ready. We still need the signed rental contract before handover." },
    { id: "msg-021", project: "p-rental", sender: "alexander", date: "2026-09-04", time: "11:12", text: "Hold the handover until the contract and payment confirmation are both recorded here." },
    { id: "msg-030", project: "p-rpl", sender: "comfort", date: "2026-09-04", time: "13:35", text: "Morning practical is complete. Attendance is signed and the afternoon battery rotation is confirmed.", attachment: "RPL Attendance — 4 September.pdf", unread: true },
    { id: "msg-040", thread: "rq-0027", sender: "comfort", date: "2026-08-27", time: "10:18", type: "Client communication", text: "Brian's email has been captured. I have asked for the filming dates, final shot list and site contact." },
    { id: "msg-041", thread: "rq-0029", sender: "alexander", date: "2026-09-02", time: "15:10", type: "Decision", text: "Proceed with the ESCOM submission, but state the conductor-accuracy assumptions clearly before commercial approval.", pinned: true },
    { id: "msg-042", thread: "rq-0029", sender: "ian", date: "2026-09-03", time: "09:24", type: "Update", text: "The flight methodology now covers hover capture, RTK control, feeder segmentation and field QA.", attachment: "ESCOM Methodology v4.docx", unread: true },
    { id: "msg-043", thread: "rq-0034", sender: "mayamiko", date: "2026-09-04", time: "16:05", type: "Question", text: "Should the first Small Farm Cities pilot combine mapping and spraying, or start with crop intelligence only?", unread: true }
  ],
  missions: [
    { id: "ms-001", title: "Nyika Hydropower field mapping", project: "p-nyika", location: "Nyika Plateau access corridor", start: "2026-09-09", end: "2026-09-11", lead: "ian", asset: "as-m3e", risk: "Medium", status: "Planning", objective: "Capture complete RTK imagery and field control for the agreed hydropower mapping area.", readiness: { brief: true, crew: true, equipment: true, safety: true, permit: false } },
    { id: "ms-002", title: "Area 47 quality-control revisit", project: "p-area47", location: "Area 47, Lilongwe", start: "2026-09-02", end: "2026-09-02", lead: "bonifancio", asset: "as-m4t", risk: "Low", status: "Processing", objective: "Close two edge gaps and validate imagery before final orthomosaic handover.", readiness: { brief: true, crew: true, equipment: true, safety: true, permit: true } },
    { id: "ms-003", title: "Karonga programme verification", project: "p-dodma", location: "TA Kyungu, Karonga", start: "2026-09-16", end: "2026-09-18", lead: "ndapile", asset: "as-m4t", risk: "Medium", status: "Planning", objective: "Verify priority field locations and collect evidence for programme reporting.", readiness: { brief: true, crew: true, equipment: false, safety: false, permit: true } },
    { id: "ms-004", title: "RPL practical flight assessment", project: "p-rpl", location: "CAGE training site, Lilongwe", start: "2026-09-05", end: "2026-09-05", lead: "comfort", asset: "as-m4t", risk: "Low", status: "Ready", objective: "Complete practical competency checks with attendance and assessment evidence.", readiness: { brief: true, crew: true, equipment: true, safety: true, permit: true } }
  ],
  assets: [
    { id: "as-m4t", name: "DJI Matrice 4T", category: "Aircraft", tag: "CAGE-DR-004", custodian: "ian", status: "Available", project: "", condition: "Excellent", usage: 34, unit: "flight hours", nextService: "2026-10-10" },
    { id: "as-m3e", name: "DJI Mavic 3 Enterprise", category: "Aircraft", tag: "CAGE-DR-003", custodian: "ian", status: "Assigned", project: "p-nyika", condition: "Good", usage: 126, unit: "flight hours", nextService: "2026-09-20" },
    { id: "as-t50", name: "DJI Agras T50", category: "Aircraft", tag: "CAGE-AG-050", custodian: "mayamiko", status: "Available", project: "", condition: "Excellent", usage: 52, unit: "flight hours", nextService: "2026-10-01" },
    { id: "as-drtk3", name: "DJI D-RTK 3", category: "Survey equipment", tag: "CAGE-RTK-003", custodian: "ian", status: "Assigned", project: "p-nyika", condition: "Excellent", usage: 18, unit: "deployments", nextService: "2026-11-15" },
    { id: "as-m4t-bat-a", name: "Matrice 4T battery set A", category: "Battery", tag: "CAGE-BAT-041", custodian: "ian", status: "Maintenance", project: "", condition: "Monitor", usage: 86, unit: "cycles", nextService: "2026-09-06" },
    { id: "as-m4t-bat-b", name: "Matrice 4T battery set B", category: "Battery", tag: "CAGE-BAT-042", custodian: "ian", status: "Available", project: "", condition: "Excellent", usage: 42, unit: "cycles", nextService: "2026-10-12" },
    { id: "as-field-kit", name: "Field safety and PPE kit", category: "Field kit", tag: "CAGE-FK-006", custodian: "ndapile", status: "Available", project: "", condition: "Good", usage: 12, unit: "deployments", nextService: "2026-09-14" }
  ],
  compliance: [
    { id: "co-001", title: "MCAA operating authorisation", category: "Operating approval", owner: "alexander", renewal: "2026-11-30", status: "Active", document: "Drive / Compliance / MCAA Operating Authorisation.pdf", note: "Company-level operating approval and applicable conditions." },
    { id: "co-002", title: "Matrice 4T aircraft registration", category: "Aircraft registration", owner: "ian", renewal: "2027-02-15", status: "Active", document: "Drive / Compliance / M4T Registration.pdf", note: "Registration record linked to aircraft asset CAGE-DR-004." },
    { id: "co-003", title: "Aviation liability insurance", category: "Insurance", owner: "ndapile", renewal: "2026-09-18", status: "Active", document: "Drive / Compliance / Aviation Insurance 2026.pdf", note: "Renewal quotation should be approved before the current cover expires." },
    { id: "co-004", title: "Flight team licence register review", category: "Pilot licence", owner: "alexander", renewal: "2026-09-12", status: "Review required", document: "Drive / Compliance / Pilot Licence Register.xlsx", note: "Confirm each active pilot licence, rating and medical record." },
    { id: "co-005", title: "Nyika project flight authorisation", category: "Project permit", owner: "alexander", renewal: "2026-09-08", status: "Review required", document: "Drive / Nyika / Flight Authorisation Request.pdf", note: "Approval must be recorded before mobilisation." },
    { id: "co-006", title: "Flight Operations SOP annual review", category: "Safety review", owner: "ian", renewal: "2026-10-01", status: "Active", document: "Drive / Operations / Flight SOP v4.pdf", note: "Review lessons from 2026 mapping and training missions." }
  ],
  approvals: [
    { id: "ap-001", type: "Mission clearance", title: "Clear Nyika field mapping mobilisation", requester: "ian", submitted: "2026-09-03", due: "2026-09-08", amount: 0, status: "Pending", summary: "Approve crew mobilisation once the flight authorisation and risk assessment are complete.", linkedType: "mission", linkedId: "ms-001" },
    { id: "ap-002", type: "Purchase", title: "Purchase two additional Matrice 4T battery sets", requester: "ian", submitted: "2026-09-04", due: "2026-09-06", amount: 4800000, status: "Pending", summary: "Increase field endurance and remove the current battery-maintenance constraint." },
    { id: "ap-003", type: "Leave", title: "Ian annual leave — 21 to 23 September", requester: "ian", submitted: "2026-09-03", due: "2026-09-10", amount: 0, status: "Pending", summary: "Handover assigns processing monitoring to Bonifancio and equipment custody to Mayamiko.", linkedType: "leave", linkedId: "lv-002" },
    { id: "ap-004", type: "Quote", title: "Approve Leigh Day fieldwork quotation", requester: "comfort", submitted: "2026-09-01", due: "2026-09-04", amount: 17500000, status: "Approved", decided: "2026-09-04", summary: "Commercial scope for Chikwawa farmland evidence capture.", linkedType: "quote", linkedId: "q-26017" },
    { id: "ap-005", type: "Submission", title: "Release ESCOM digital twin methodology", requester: "alexander", submitted: "2026-09-04", due: "2026-09-07", amount: 122500000, status: "Pending", summary: "Final internal check of scope, accuracy assumptions, delivery approach and commercial position.", linkedType: "request", linkedId: "rq-0029" },
    { id: "ap-006", type: "Mission clearance", title: "Clear Karonga programme verification", requester: "ndapile", submitted: "2026-09-04", due: "2026-09-15", amount: 0, status: "Pending", summary: "Confirm equipment, safety review and field coordination before deployment.", linkedType: "mission", linkedId: "ms-003" },
    { id: "ap-007", type: "Mission clearance", title: "Clear RPL practical flight assessment", requester: "comfort", submitted: "2026-09-03", due: "2026-09-04", amount: 0, status: "Approved", decided: "2026-09-04", summary: "Training aircraft, site controls and assessment team confirmed.", linkedType: "mission", linkedId: "ms-004" }
  ],
  commercialRecords: [
    { id: "cm-001", type: "Tender", title: "ESCOM Digital Twin field capture", organisation: "EED Advisory", owner: "alexander", deadline: "2026-09-07", value: 122500000, stage: "Internal review", progress: 82, nextAction: "Approve and release the final methodology and commercial position.", request: "rq-0029" },
    { id: "cm-002", type: "Grant", title: "Growth Accelerator — Drone Data Geoportal", organisation: "UNDP Malawi", owner: "alexander", deadline: "2027-11-30", value: 0, stage: "Active", progress: 35, nextAction: "Complete the environmental and social documentation and next milestone pack.", request: "rq-0031", project: "p-geoportal" },
    { id: "cm-003", type: "Contract", title: "Chikwawa farmland evidence capture", organisation: "Leigh Day", owner: "comfort", deadline: "2026-09-30", value: 17500000, stage: "Negotiation", progress: 45, nextAction: "Confirm field dates, plot locations and required mapping accuracy.", request: "rq-0028" },
    { id: "cm-004", type: "Tender", title: "DJI FlightHub 2 licence subscription RFQ", organisation: "Prospective institutional client", owner: "mayamiko", deadline: "2026-09-12", value: 0, stage: "Preparing", progress: 60, nextAction: "Complete the compliance checklist and evidence of similar supply.", request: "rq-0030" },
    { id: "cm-005", type: "Contract", title: "Ten-day drone equipment hire agreement", organisation: "Drone Link", owner: "mayamiko", deadline: "2026-09-05", value: 15900000, stage: "Negotiation", progress: 70, nextAction: "Obtain the signed agreement before equipment handover.", request: "rq-0032", project: "p-rental" },
    { id: "cm-006", type: "Contract", title: "September RPL refresher programme", organisation: "CAGE Training", owner: "comfort", deadline: "2026-09-18", value: 22000000, stage: "Active", progress: 100, nextAction: "Complete practical assessments and compile trainee evidence.", request: "rq-0033", project: "p-rpl" }
  ],
  requests: [
    { id: "rq-0027", number: "REQ-2026-0027", title: "KCH aerial promotional footage", organisation: "ACrew4U", contact: "Brian — Bookings", contactDetail: "Email enquiry", type: "Aerial filming", source: "Email", owner: "comfort", priority: "Normal", location: "Kamuzu Central Hospital, Lilongwe", received: "2026-08-27", deadline: "2026-09-11", deliveryDeadline: "", value: 4800000, stage: "Needs information", summary: "Capture a small set of aerial promotional clips at the UNC Project research site.", attachments: "Client email brief", nextAction: "Confirm filming dates, shot list and site permissions.", checklist: { client: true, brief: false, dates: false, permissions: false, method: true, costing: false, approval: false, submission: false, acceptance: false } },
    { id: "rq-0028", number: "REQ-2026-0028", title: "Chikwawa farmland evidence capture", organisation: "Leigh Day", contact: "Malawi fieldwork team", contactDetail: "Email enquiry", type: "Drone mapping", source: "Email", owner: "comfort", priority: "High", location: "Shire and Mwanza Rivers, Chikwawa", received: "2026-09-01", deadline: "2026-09-08", deliveryDeadline: "2026-10-30", value: 17500000, stage: "Scoping", summary: "Map client farmland plots and provide defensible location and area evidence for a legal case.", attachments: "Client instructions / provisional October dates", nextAction: "Confirm plot locations, AOI files, field dates and required survey accuracy.", deal: "d-leigh", commercial: "cm-003", checklist: { client: true, aoi: false, outputs: true, access: false, method: true, costing: true, approval: true, submission: false, acceptance: false } },
    { id: "rq-0029", number: "REQ-2026-0029", title: "ESCOM Digital Twin field capture", organisation: "EED Advisory", contact: "Digital twin bid team", contactDetail: "Partner invitation", type: "Tender / RFQ", source: "Email", owner: "alexander", priority: "Urgent", location: "Lilongwe and Salima", received: "2026-08-12", deadline: "2026-09-07", deliveryDeadline: "", value: 122500000, stage: "Internal review", summary: "Drone survey and geospatial capture methodology for approximately 138 km of electricity distribution feeders.", attachments: "RFQ pack / feeder KMZ files / methodology draft", nextAction: "Approve final methodology, assumptions and commercial position.", deal: "d-escom", commercial: "cm-001", checklist: { documents: true, eligibility: true, go: true, matrix: true, technical: true, pricing: true, approval: false, submission: false, acceptance: false } },
    { id: "rq-0030", number: "REQ-2026-0030", title: "DJI FlightHub 2 licence subscription RFQ", organisation: "Prospective institutional client", contact: "Procurement team", contactDetail: "RFQ portal", type: "Tender / RFQ", source: "Tender portal", owner: "mayamiko", priority: "High", location: "Malawi", received: "2026-09-02", deadline: "2026-09-12", deliveryDeadline: "", value: 0, stage: "Scoping", summary: "Supply and configure DJI FlightHub 2 licensing with evidence of similar delivery.", attachments: "RFQ - DJI FlightHub Licence Subscription.pdf", nextAction: "Complete compliance matrix and similar-supply evidence.", commercial: "cm-004", checklist: { documents: true, eligibility: true, go: true, matrix: false, technical: false, pricing: false, approval: false, submission: false, acceptance: false } },
    { id: "rq-0031", number: "REQ-2026-0031", title: "Growth Accelerator — Drone Data Geoportal", organisation: "UNDP Malawi", contact: "Growth Accelerator team", contactDetail: "Programme portal", type: "Grant", source: "Grant portal", owner: "alexander", priority: "High", location: "Malawi", received: "2026-02-12", deadline: "2026-02-12", deliveryDeadline: "2027-11-30", value: 70000000, stage: "Converted", summary: "Build a scalable CAGE geospatial data platform and prove a viable market for decision-ready drone data.", attachments: "Award letter / grant agreement / approved work plan", nextAction: "Complete environmental and social documents and the next milestone pack.", project: "p-geoportal", commercial: "cm-002", checklist: { eligibility: true, fit: true, go: true, concept: true, outcomes: true, budget: true, safeguards: true, approval: true, submission: true, acceptance: true } },
    { id: "rq-0032", number: "REQ-2026-0032", title: "Ten-day drone equipment hire", organisation: "Drone Link", contact: "Equipment hire contact", contactDetail: "Existing client", type: "Equipment hire", source: "Existing client", owner: "mayamiko", priority: "Urgent", location: "Lilongwe", received: "2026-08-24", deadline: "2026-09-05", deliveryDeadline: "2026-09-23", value: 15900000, stage: "Converted", summary: "Hire an aircraft, batteries and accessories for ten days with documented custody and return condition.", attachments: "Accepted quotation Q-26016 / draft rental agreement", nextAction: "Obtain the signed hire agreement before releasing equipment.", deal: "d-rental", project: "p-rental", commercial: "cm-005", checklist: { need: true, client: true, availability: true, pricing: true, deposit: true, approval: true, submission: true, acceptance: false, inspection: false } },
    { id: "rq-0033", number: "REQ-2026-0033", title: "September RPL refresher programme", organisation: "CAGE Training", contact: "Training coordinator", contactDetail: "Internal programme", type: "RPL training", source: "Existing client", owner: "comfort", priority: "High", location: "CAGE training site, Lilongwe", received: "2026-08-18", deadline: "2026-08-30", deliveryDeadline: "2026-09-18", value: 22000000, stage: "Converted", summary: "Deliver compliant refresher theory and practical training with complete trainee evidence.", attachments: "Participant list / training plan / accepted invoice", nextAction: "Complete practical assessments and compile trainee evidence.", project: "p-rpl", commercial: "cm-006", checklist: { cohort: true, eligibility: true, schedule: true, resources: true, pricing: true, approval: true, submission: true, acceptance: true, register: true } },
    { id: "rq-0034", number: "REQ-2026-0034", title: "Smallholder precision agriculture partnership", organisation: "Small Farm Cities Malawi", contact: "Partnership team", contactDetail: "Referral", type: "Partnership", source: "Referral", owner: "mayamiko", priority: "Normal", location: "Malawi", received: "2026-09-02", deadline: "2026-09-15", deliveryDeadline: "", value: 35000000, stage: "Qualified", summary: "Explore precision spraying, crop mapping and farm-data services for smallholder farmer groups.", attachments: "Partnership concept note", nextAction: "Agree pilot geography, farmer cohort, responsibilities and cost-sharing model.", deal: "d-sfc", checklist: { client: true, objective: true, diligence: false, roles: false, resources: false, approval: false, submission: false, acceptance: false } }
  ],
  requestPurposes: [...CORE_REQUEST_PURPOSES],
  opportunityMatches: [
    { id: "live-developpp-2026-q3", title: "develoPPP Classic — sustainable drone and geospatial services", organisation: "BMZ via GIZ / DEG Impulse", type: "Grant", source: "develoPPP official call", platform: "develoPPP", estimatedValue: "€100,000–€2,000,000; up to 50% public funding", deadline: "2026-09-30", url: "https://www.developpp.de/en/application/classic/", match: 92, matchLevel: "High", reason: "CAGE can combine commercial drone, Geoportal, agriculture and technical-training growth with measurable development benefits in Malawi.", requirements: ["Confirm CAGE meets the financial and staffing thresholds and provide two audited annual statements.", "Prepare a project with at least 50% company contribution, a lasting business interest and benefits beyond CAGE itself."], status: "New", verifiedAt: "2026-09-08" },
    { id: "live-unicef-rolling-2026", title: "UNICEF Venture Fund rolling application — open-source technology for children", organisation: "UNICEF Venture Fund", type: "Grant", source: "UNICEF Venture Fund official portal", platform: "UNICEF", estimatedValue: "Up to US$100,000 equity-free", deadline: "Rolling", url: "https://www.unicefventurefund.org/apply-funding", match: 80, matchLevel: "High", reason: "CAGE's Geoportal, climate mapping and STEM work could qualify if the proposed product directly benefits children and is released under an approved open-source licence.", requirements: ["Submit a working prototype from a company registered in a UNICEF programme country.", "Commit the relevant software, hardware or content to an approved open-source licence and define a child-focused outcome."], status: "New", verifiedAt: "2026-09-08" },
    { id: "live-sgci-stisa-2034", title: "STISA-2034 multilateral research call — agriculture, digital technologies and environment", organisation: "IDRC / Science Granting Councils Initiative", type: "Partnership", source: "SGCI official funding call", platform: "SGCI / IDRC", estimatedValue: "CAD 50,000–300,000 per consortium member", deadline: "2026-09-25", url: "https://sgciafrica.org/funding/supporting-stisa-2034-sgci-collaborative-research-call/", match: 75, matchLevel: "Medium", reason: "CAGE is a strong geospatial implementation and field-data partner, but the application must be led through an eligible research institution in a multi-country consortium.", requirements: ["Join an eligible lead and at least two co-applicant research institutions from participating SGCI countries.", "Position CAGE's drone data, AI/GIS, agriculture or environment work as a technical delivery and research-uptake contribution."], status: "New", verifiedAt: "2026-09-08" },
    { id: "live-iucn-gis-tablets-2026", title: "IUCN-26-08 — supply of GIS-enabled rugged tablets", organisation: "IUCN ESARO Kenya", type: "Tender / RFQ", source: "IUCN procurement listing", platform: "IUCN / DevelopmentAid", estimatedValue: "Below CHF 25,000", deadline: "2026-09-18", url: "https://www.developmentaid.org/tenders/view/1708084/iucn-26-08-procurement-of-gis-enabled-tablets-509", match: 62, matchLevel: "Low", reason: "CAGE understands GIS field hardware and can bid as a supplier if it can source the exact rugged specification and deliver DDP to Nairobi on time.", requirements: ["Verify the complete specification and supplier-document requirements on the IUCN procurement portal.", "Confirm pricing, tax and logistics for DDP delivery of ten units to Nairobi by 30 September 2026."], status: "Review", verifiedAt: "2026-09-08" }
  ],
  opportunityMonitor: {
    enabled: true,
    autoIntake: false,
    lastScan: "2026-09-05T07:00:00+02:00",
    nextScan: "2026-09-09T07:00:00+02:00",
    sources: ["11 global aggregators", "5 UN & multilateral portals", "6 development banks", "6 government & bilateral portals", "7 innovation & impact platforms", "5 climate & conservation portals", "5 NGO & humanitarian portals", "Public LinkedIn & X posts"],
    coverage: ["Opportunity Desk", "Devex Funding", "DevelopmentAid", "Funds for NGOs", "Opportunities for Africans", "Youth Opportunities", "Terra Viva Grants Directory", "TripleFunds", "MangoFetch", "TendersGo", "TendersInfo", "UNGM", "UNICEF Supply Division", "UNOPS Procurement", "UNDP Procurement Notices", "NATO Procurement", "World Bank Procurement / eConsultant2", "African Development Bank", "Asian Development Bank", "Inter-American Development Bank", "European Bank for Reconstruction and Development", "Islamic Development Bank", "SAM.gov / USAID opportunities", "TED European tenders", "FCDO", "GIZ", "AusTender", "GeBIZ", "develoPPP", "UNICEF Venture Fund", "GSMA Innovation Fund", "Google.org / Google for Startups", "Grand Challenges", "USAID Development Innovation Ventures", "SGCI Africa", "IUCN", "WWF", "Conservation International", "Global Environment Facility", "Green Climate Fund", "ReliefWeb consultancies", "Mercy Corps", "Oxfam", "Save the Children", "Catholic Relief Services", "LinkedIn public posts", "X public posts"]
  },
  settings: {
    workspaceName: "Operations Hub",
    defaultOwner: "alexander",
    defaultRequestPurpose: "Drone mapping",
    requireTaskEvidence: true,
    autoReminders: true,
    complianceReminders: true,
    enterToSend: true,
    mentionSuggestions: true
  }
};

let state = loadState();
let activeView = "dashboard";
let taskFilter = "all";
let projectFilter = "all";
let taskDisplay = "board";
let financeFilter = "all";
let boardProjectFilter = "all";
let boardAddingListId = "";
let addingBoardList = false;
let crmAddingStage = "";
let editingDealId = "";
let editingTaskId = "";
let activeChatThread = GENERAL_CHAT_THREAD_ID;
let chatFilter = "all";
let knowledgeFilter = "all";
let assetFilter = "all";
let commercialFilter = "all";
let requestFilter = "all";
let activeRequestId = "";
let activeContactId = "";
let sendingDocument = null;
let missingEvidenceOnly = false;
let calendarCursor = new Date(`${TODAY.slice(0, 7)}-01T00:00:00Z`);
let draggedTaskId = null;
let draggedDealId = null;
let activeProjectId = "";
let activeProjectTab = "overview";
let toastTimer;

const viewMeta = {
  mywork: ["My work", "CAGE / My responsibilities"],
  notifications: ["Notifications", "CAGE / For you"],
  access: ["Module access", "CAGE / Administration"],
  training: ["Training Academy", "CAGE / Learning delivery"],
  dashboard: ["Dashboard", "CAGE / Operations"],
  requests: ["Request centre", "CAGE / Intake & qualification"],
  projects: ["Projects", "CAGE / Portfolio"],
  tasks: ["Work board", "CAGE / Execution"],
  crm: ["CRM & Sales", "CAGE / Growth"],
  calendar: ["Calendar", "CAGE / Schedule"],
  missions: ["Mission control", "CAGE / Field operations"],
  assets: ["Equipment", "CAGE / Fleet & inventory"],
  compliance: ["Compliance", "CAGE / Safety & governance"],
  chat: ["Work chat", "CAGE / Company communication"],
  finance: ["Finance", "CAGE / Money"],
  approvals: ["Approval inbox", "CAGE / Decisions"],
  commercial: ["Tenders & contracts", "CAGE / Growth control"],
  leave: ["Vacation tracker", "CAGE / People"],
  knowledge: ["Knowledge centre", "CAGE / Reference"],
  team: ["Team", "CAGE / Capacity"],
  evidence: ["Evidence", "CAGE / Documents"],
  reports: ["Reports", "CAGE / Management"],
  hr: ["Recruitment & HR", "CAGE / People lifecycle"],
  admin: ["User administration", "CAGE / Access control"],
  settings: ["Settings", "CAGE / Workspace administration"]
};

const REQUEST_STAGE_OPTIONS = [
  "New", "Needs information", "Qualified", "Scoping", "Internal review",
  "Approved to send", "Submitted", "Negotiation", "Won / Awarded", "Converted", "Lost / Declined"
];

const REQUEST_PIPELINES = [
  { title: "Inbox", subtitle: "Capture & clarify", stages: ["New", "Needs information"] },
  { title: "Qualification", subtitle: "Go / no-go", stages: ["Qualified"] },
  { title: "Scope & cost", subtitle: "Method & price", stages: ["Scoping"] },
  { title: "Approval", subtitle: "Internal decision", stages: ["Internal review", "Approved to send"] },
  { title: "Client / funder", subtitle: "Await response", stages: ["Submitted", "Negotiation"] },
  { title: "Outcome", subtitle: "Accept or close", stages: ["Won / Awarded", "Converted", "Lost / Declined"] }
];

const requestItem = (key, label, phase) => ({ key, label, phase });
const REQUEST_TEMPLATES = {
  "Drone mapping": [
    requestItem("client", "Client and decision contact verified", "qualify"),
    requestItem("aoi", "AOI, KMZ or site boundaries received", "qualify"),
    requestItem("outputs", "Outputs, accuracy and coordinate system agreed", "scope"),
    requestItem("access", "Site access, dates and permissions checked", "scope"),
    requestItem("method", "Flight, processing and QA method prepared", "scope"),
    requestItem("costing", "Crew, travel, processing and margin costed", "scope"),
    requestItem("approval", "Scope and commercial position approved", "review"),
    requestItem("submission", "Quote or proposal sent and logged", "submission"),
    requestItem("acceptance", "Signed contract, PO or accepted quote filed", "acceptance")
  ],
  "Inspection / thermal": [
    requestItem("client", "Asset owner and decision contact verified", "qualify"),
    requestItem("assets", "Assets, defects and coverage list received", "qualify"),
    requestItem("outputs", "Inspection outputs and reporting standard agreed", "scope"),
    requestItem("access", "Access, shutdowns and permissions checked", "scope"),
    requestItem("method", "Sensor, mission and QA method prepared", "scope"),
    requestItem("costing", "Crew, equipment and reporting costed", "scope"),
    requestItem("approval", "Scope and commercial position approved", "review"),
    requestItem("submission", "Quote or proposal sent and logged", "submission"),
    requestItem("acceptance", "Signed contract, PO or accepted quote filed", "acceptance")
  ],
  "Agriculture service": [
    requestItem("client", "Farm owner and decision contact verified", "qualify"),
    requestItem("farms", "Farm blocks, crops and hectares confirmed", "qualify"),
    requestItem("objective", "Agronomic objective and outputs agreed", "scope"),
    requestItem("access", "Field access, timing and permissions checked", "scope"),
    requestItem("method", "Mapping, analytics or spraying method prepared", "scope"),
    requestItem("costing", "Inputs, equipment, crew and travel costed", "scope"),
    requestItem("approval", "Scope and commercial position approved", "review"),
    requestItem("submission", "Quote or proposal sent and logged", "submission"),
    requestItem("acceptance", "Signed contract, PO or accepted quote filed", "acceptance")
  ],
  "Aerial filming": [
    requestItem("client", "Client and decision contact verified", "qualify"),
    requestItem("brief", "Creative brief and shot list received", "qualify"),
    requestItem("dates", "Filming dates and weather window confirmed", "scope"),
    requestItem("permissions", "Location, people and flight permissions checked", "scope"),
    requestItem("method", "Aircraft, crew and editing method prepared", "scope"),
    requestItem("costing", "Capture, travel, editing and licensing costed", "scope"),
    requestItem("approval", "Scope and commercial position approved", "review"),
    requestItem("submission", "Quote or proposal sent and logged", "submission"),
    requestItem("acceptance", "Signed contract, PO or accepted quote filed", "acceptance")
  ],
  "Equipment hire": [
    requestItem("need", "Equipment, accessories and use case confirmed", "qualify"),
    requestItem("client", "Hirer identity and competence checked", "qualify"),
    requestItem("availability", "Availability and hire dates reserved", "scope"),
    requestItem("pricing", "Rate, transport, damage and late fees costed", "scope"),
    requestItem("deposit", "Deposit and payment terms agreed", "scope"),
    requestItem("approval", "Hire terms and commercial position approved", "review"),
    requestItem("submission", "Quote and hire agreement sent", "submission"),
    requestItem("acceptance", "Signed agreement and payment evidence filed", "acceptance"),
    requestItem("inspection", "Pre-hire inspection and condition photos complete", "delivery")
  ],
  "RPL training": [
    requestItem("cohort", "Trainee or cohort requirement confirmed", "qualify"),
    requestItem("eligibility", "Entry eligibility and documents checked", "qualify"),
    requestItem("schedule", "Theory, practical and assessment dates planned", "scope"),
    requestItem("resources", "Instructor, venue and aircraft reserved", "scope"),
    requestItem("pricing", "Training fees and payment terms costed", "scope"),
    requestItem("approval", "Programme and commercial position approved", "review"),
    requestItem("submission", "Offer, joining pack or invoice sent", "submission"),
    requestItem("acceptance", "Registration and payment evidence filed", "acceptance"),
    requestItem("register", "Training and certification register created", "delivery")
  ],
  "GIS / data processing": [
    requestItem("client", "Client and decision contact verified", "qualify"),
    requestItem("data", "Source data, size and licence confirmed", "qualify"),
    requestItem("outputs", "Formats, projection and acceptance criteria agreed", "scope"),
    requestItem("security", "Transfer, storage and confidentiality checked", "scope"),
    requestItem("method", "Processing and QA method prepared", "scope"),
    requestItem("costing", "Processing time, software and margin costed", "scope"),
    requestItem("approval", "Scope and commercial position approved", "review"),
    requestItem("submission", "Quote or proposal sent and logged", "submission"),
    requestItem("acceptance", "Signed contract, PO or accepted quote filed", "acceptance")
  ],
  "Tender / RFQ": [
    requestItem("documents", "Complete solicitation pack and amendments filed", "qualify"),
    requestItem("eligibility", "Eligibility and mandatory requirements checked", "qualify"),
    requestItem("go", "Go / no-go decision recorded", "qualify"),
    requestItem("matrix", "Compliance matrix and owners completed", "scope"),
    requestItem("technical", "Technical response and evidence completed", "scope"),
    requestItem("pricing", "Price, tax, margin and validity checked", "scope"),
    requestItem("approval", "Final submission approved", "review"),
    requestItem("submission", "Submission receipt and exact version filed", "submission"),
    requestItem("acceptance", "Award, contract or PO filed", "acceptance")
  ],
  Grant: [
    requestItem("eligibility", "Eligibility and deadline verified", "qualify"),
    requestItem("fit", "Strategic fit and co-funding obligations checked", "qualify"),
    requestItem("go", "Go / no-go decision recorded", "qualify"),
    requestItem("concept", "Problem, beneficiaries and solution defined", "scope"),
    requestItem("outcomes", "Outcomes, indicators and workplan prepared", "scope"),
    requestItem("budget", "Budget, cashflow and sustainability checked", "scope"),
    requestItem("safeguards", "Risks, safeguards and due diligence completed", "scope"),
    requestItem("approval", "Final application approved", "review"),
    requestItem("submission", "Application receipt and exact version filed", "submission"),
    requestItem("acceptance", "Award letter or grant agreement filed", "acceptance")
  ],
  Partnership: [
    requestItem("client", "Partner and decision contact verified", "qualify"),
    requestItem("objective", "Shared objective and strategic fit agreed", "qualify"),
    requestItem("diligence", "Partner due diligence completed", "scope"),
    requestItem("roles", "Responsibilities, IP and data rights agreed", "scope"),
    requestItem("resources", "Budget, staff and success measures agreed", "scope"),
    requestItem("approval", "Partnership terms approved", "review"),
    requestItem("submission", "MOU or proposal sent and logged", "submission"),
    requestItem("acceptance", "Signed MOU or agreement filed", "acceptance")
  ],
  "General enquiry": [
    requestItem("client", "Requester and decision contact verified", "qualify"),
    requestItem("need", "Need, timing and desired outcome confirmed", "qualify"),
    requestItem("scope", "Response, responsibilities and exclusions prepared", "scope"),
    requestItem("costing", "Price or resource commitment checked", "scope"),
    requestItem("approval", "Response approved where required", "review"),
    requestItem("submission", "Response sent and logged", "submission"),
    requestItem("acceptance", "Acceptance or instruction to proceed filed", "acceptance")
  ]
};

function requestById(id) {
  return state.requests.find(request => request.id === id);
}

function requestTemplate(requestOrType) {
  const type = typeof requestOrType === "string" ? requestOrType : requestOrType?.type;
  return REQUEST_TEMPLATES[type] || REQUEST_TEMPLATES["General enquiry"];
}

function requestChecklistStats(request, phases = []) {
  const items = requestTemplate(request).filter(item => !phases.length || phases.includes(item.phase));
  const done = items.filter(item => Boolean(request.checklist?.[item.key])).length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

function requestChecklistComplete(request, phases) {
  const stats = requestChecklistStats(request, phases);
  return stats.total > 0 && stats.done === stats.total;
}

function requestQualificationComplete(request) {
  return requestChecklistComplete(request, ["qualify"]);
}

function requestPreReviewComplete(request) {
  return requestChecklistComplete(request, ["qualify", "scope"]);
}

function requestAcceptanceComplete(request) {
  return requestChecklistComplete(request, ["acceptance"]);
}

function requestHasApprovedReview(request) {
  return Boolean(request.checklist?.approval) || state.approvals.some(item => item.linkedType === "request" && item.linkedId === request.id && item.status === "Approved");
}

function requestNeedsAction(request) {
  if (["New", "Needs information", "Internal review", "Won / Awarded"].includes(request.stage)) return true;
  if (request.stage === "Converted" && !requestAcceptanceComplete(request)) return true;
  return !["Converted", "Lost / Declined"].includes(request.stage) && daysUntil(request.deadline) <= 7;
}

function requestBucket(request) {
  return REQUEST_PIPELINES.find(column => column.stages.includes(request.stage))?.title || "Inbox";
}

function requestStatusClass(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function requestTypeCategory(type) {
  if (type === "Equipment hire") return "Equipment Hire";
  if (type === "RPL training") return "Training";
  if (type === "Tender / RFQ") return "Contract Delivery";
  if (type === "Grant") return "Grant Programme";
  if (type === "Partnership") return "Partnership";
  if (["Drone mapping", "Inspection / thermal", "Agriculture service", "Aerial filming", "GIS / data processing"].includes(type)) return "Field & Data Services";
  return "Client Service";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return clone(seedData);
    const parsed = JSON.parse(saved);
    const projects = (Array.isArray(parsed.projects) ? parsed.projects : clone(seedData.projects)).map(project => {
      const seeded = seedData.projects.find(item => item.id === project.id);
      return { ...project, request: project.request || seeded?.request || "", commercial: project.commercial || seeded?.commercial || "" };
    });
    const commercialRecords = (Array.isArray(parsed.commercialRecords) ? parsed.commercialRecords : clone(seedData.commercialRecords)).map(record => {
      const seeded = seedData.commercialRecords.find(item => item.id === record.id);
      return { ...record, request: record.request || seeded?.request || "", project: record.project || seeded?.project || "" };
    });
    if (!commercialRecords.some(record => record.id === "cm-006")) commercialRecords.push(clone(seedData.commercialRecords.find(record => record.id === "cm-006")));
    const requests = Array.isArray(parsed.requests) ? parsed.requests : clone(seedData.requests);
    const approvals = (Array.isArray(parsed.approvals) ? parsed.approvals : clone(seedData.approvals)).map(approval => {
      if (approval.linkedType !== "commercial") return approval;
      const linkedRequest = commercialRecords.find(record => record.id === approval.linkedId)?.request;
      return linkedRequest ? { ...approval, linkedType: "request", linkedId: linkedRequest } : approval;
    });
    if (!projects.some(project => project.id === "p-internal")) projects.push(clone(seedData.projects.find(project => project.id === "p-internal")));
    return {
      ...clone(seedData),
      ...parsed,
      team: (() => {
        const savedTeam = Array.isArray(parsed.team) ? parsed.team : [];
        return seedData.team.map(account => ({
          ...(savedTeam.find(member => member.id === account.id) || {}),
          ...account
        }));
      })(),
      projects,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : clone(seedData.tasks),
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : clone(seedData.contacts),
      deals: Array.isArray(parsed.deals) ? parsed.deals : clone(seedData.deals),
      events: Array.isArray(parsed.events) ? parsed.events : clone(seedData.events),
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : clone(seedData.invoices),
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : clone(seedData.expenses),
      boardLists: Array.isArray(parsed.boardLists) ? parsed.boardLists : clone(seedData.boardLists),
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes : clone(seedData.quotes),
      leaveRequests: Array.isArray(parsed.leaveRequests) ? parsed.leaveRequests : clone(seedData.leaveRequests),
      knowledge: Array.isArray(parsed.knowledge) ? parsed.knowledge : clone(seedData.knowledge),
      chatGroups: Array.isArray(parsed.chatGroups) ? parsed.chatGroups : [],
      messages: (() => {
        const existing = Array.isArray(parsed.messages) ? parsed.messages : clone(seedData.messages);
        const additions = seedData.messages.filter(message => ["msg-general-001", "msg-040", "msg-041", "msg-042", "msg-043"].includes(message.id) && !existing.some(item => item.id === message.id));
        return [...existing, ...clone(additions)].map(message => ({ type: "Update", ...message }));
      })(),
      missions: Array.isArray(parsed.missions) ? parsed.missions : clone(seedData.missions),
      assets: Array.isArray(parsed.assets) ? parsed.assets : clone(seedData.assets),
      compliance: Array.isArray(parsed.compliance) ? parsed.compliance : clone(seedData.compliance),
      approvals,
      commercialRecords,
      requests,
      requestPurposes: Array.isArray(parsed.requestPurposes) && parsed.requestPurposes.length
        ? [...new Set([...CORE_REQUEST_PURPOSES, ...parsed.requestPurposes.map(value => String(value).trim()).filter(Boolean)])]
        : clone(seedData.requestPurposes),
      opportunityMatches: (() => {
        const existing = Array.isArray(parsed.opportunityMatches)
          ? parsed.opportunityMatches.filter(item => {
              if (/^sample:/i.test(String(item?.title || ""))) return false;
              if (item?.request || item?.deadline === "Rolling" || !item?.deadline) return true;
              const deadline = new Date(`${item.deadline}T23:59:59Z`).getTime();
              return Number.isFinite(deadline) && deadline > Date.now() + 48 * 60 * 60 * 1000;
            })
          : [];
        const hasLiveResults = existing.some(item => item.url || item.source_url);
        return hasLiveResults ? existing : clone(seedData.opportunityMatches);
      })(),
      opportunityMonitor: parsed.opportunityMonitor && typeof parsed.opportunityMonitor === "object"
        ? { ...clone(seedData.opportunityMonitor), ...parsed.opportunityMonitor, sources: clone(seedData.opportunityMonitor.sources), coverage: clone(seedData.opportunityMonitor.coverage) }
        : clone(seedData.opportunityMonitor),
      settings: parsed.settings && typeof parsed.settings === "object" ? { ...clone(seedData.settings), ...parsed.settings } : clone(seedData.settings)
    };
  } catch {
    return clone(seedData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.CAGE_PERSONAL?.refreshView();
  window.CAGE_BACKEND?.scheduleSave(state);
}

function replaceStateFromCloud(nextState) {
  if (!nextState || typeof nextState !== "object") return;
  const removedLegacySamples = Array.isArray(nextState.opportunityMatches) && nextState.opportunityMatches.some(item => /^sample:/i.test(String(item?.title || "")));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  state = loadState();
  for (const [key,value] of Object.entries(nextState)) state[key] = value;
  renderAll();
  window.CAGE_PERSONAL?.refreshView();
  if (removedLegacySamples) window.setTimeout(saveState, 0);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function teamMember(id) {
  return state.team.find(member => member.id === id) || { name: "Unassigned", initials: "—", role: "" };
}

function assignableTeam() {
  return state.team.filter(member => member.assignable !== false);
}

function projectById(id) {
  return state.projects.find(project => project.id === id);
}

function dealById(id) {
  return state.deals.find(deal => deal.id === id);
}

function assetById(id) {
  return state.assets.find(asset => asset.id === id);
}

function missionById(id) {
  return state.missions.find(mission => mission.id === id);
}

function contactByCompany(company) {
  return state.contacts.find(contact => contact.company.toLowerCase() === String(company).toLowerCase());
}

function asDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function daysUntil(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.round((asDate(value) - asDate(TODAY)) / 86400000);
}

function readinessCount(mission) {
  return Object.values(mission.readiness || {}).filter(Boolean).length;
}

function missionIsReady(mission) {
  return readinessCount(mission) === 5;
}

function missionHasClearance(mission) {
  const decisions = state.approvals.filter(item => item.linkedType === "mission" && item.linkedId === mission.id);
  if (!decisions.length) return ["Ready", "In field", "Processing", "Complete"].includes(mission.status);
  return decisions.some(item => item.status === "Approved");
}

function missionCanDeploy(mission) {
  return missionIsReady(mission) && missionHasClearance(mission);
}

function assetNeedsAttention(asset) {
  return asset.status === "Maintenance" || asset.condition === "Repair required" || daysUntil(asset.nextService) <= 14;
}

function complianceDisplayStatus(record) {
  if (record.status === "Expired" || daysUntil(record.renewal) < 0) return "Expired";
  if (record.status === "Review required") return "Review required";
  if (record.status === "Renewal submitted") return "Renewal submitted";
  if (daysUntil(record.renewal) <= 30) return "Due soon";
  return "Active";
}

function commercialNeedsAttention(record) {
  if (["Closed", "Awarded"].includes(record.stage)) return false;
  return daysUntil(record.deadline) <= 14 || record.stage === "Internal review";
}

function isOverdue(task) {
  return task.status !== "Done" && asDate(task.due) < asDate(TODAY);
}

function dueWithin(task, days) {
  if (task.status === "Done") return false;
  const diff = Math.round((asDate(task.due) - asDate(TODAY)) / 86400000);
  return diff >= 0 && diff <= days;
}

function formatDate(value, options = {}) {
  if (!value) return "Not set";
  const date = asDate(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: options.long ? "long" : "short",
    year: options.year ? "numeric" : undefined,
    timeZone: "UTC"
  }).format(date);
}

function formatMoney(value, compact = false) {
  const amount = Number(value) || 0;
  if (compact && Math.abs(amount) >= 1000000) {
    const millions = amount / 1000000;
    return `MWK ${millions.toFixed(millions >= 100 ? 0 : 1).replace(".0", "")}m`;
  }
  if (compact && Math.abs(amount) >= 1000) return `MWK ${(amount / 1000).toFixed(0)}k`;
  return `MWK ${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(amount)}`;
}

function effectiveInvoiceStatus(invoice) {
  if (invoice.status === "Paid" || invoice.status === "Draft") return invoice.status;
  return invoice.due < TODAY ? "Overdue" : invoice.status;
}

function statusClass(value) {
  return String(value).toLowerCase().replaceAll(" ", "-");
}

function taskListId(task) {
  if (task.list && state.boardLists.some(list => list.id === task.list)) return task.list;
  const byStatus = state.boardLists.find(list => list.status === task.status);
  return byStatus?.id || state.boardLists[0]?.id;
}

function boardListById(id) {
  return state.boardLists.find(list => list.id === id);
}

function workdayCount(start, end) {
  if (!start || !end || end < start) return 0;
  let count = 0;
  const cursor = asDate(start);
  const last = asDate(end);
  while (cursor <= last) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function isDateWithin(date, start, end) {
  return date >= start && date <= end;
}

function dueLabel(task) {
  if (task.due === TODAY) return "Today";
  const diff = Math.round((asDate(task.due) - asDate(TODAY)) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return formatDate(task.due);
}

function activeTasks() {
  return state.tasks.filter(task => task.status !== "Done");
}

function projectTasks(projectId) {
  return state.tasks.filter(task => task.project === projectId);
}

function projectProgress(projectId) {
  const tasks = projectTasks(projectId);
  if (!tasks.length) return 0;
  const score = tasks.reduce((sum, task) => {
    if (task.status === "Done") return sum + 100;
    if (task.status === "Doing") return sum + 50;
    if (task.status === "Blocked") return sum + 25;
    return sum;
  }, 0);
  return Math.round(score / tasks.length);
}

function projectHealth(project) {
  const tasks = projectTasks(project.id);
  if (tasks.length && tasks.every(task => task.status === "Done")) return "complete";
  if (tasks.some(task => task.status === "Blocked" || isOverdue(task))) return "attention";
  return "on-track";
}

function healthLabel(health) {
  return health === "on-track" ? "On track" : health === "complete" ? "Complete" : "Needs attention";
}

function initials(name) {
  return name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function currentUserCanSelfApprove() {
 const p=window.CAGE_BACKEND?.currentProfile?.();
 return p?.active!==false && p?.role==='admin' && ['alexander@cagemw.com','ndapile@cagemw.com'].includes(String(p?.email||'').toLowerCase());
}
function currentUserCanApprove() {
  if (!window.CAGE_BACKEND?.isProduction) return true;
  return window.CAGE_BACKEND.canApprove?.() === true;
}

function currentUserIsAdmin() {
  if (!window.CAGE_BACKEND?.isProduction) return true;
  return window.CAGE_BACKEND.currentProfile?.()?.role === "admin";
}

function setView(view) {
  if (!viewMeta[view]) return;
  if (window.CAGE_BACKEND?.moduleLevel && window.CAGE_BACKEND.moduleLevel(view) === "none") { showToast("You do not have access to this module. Ask your administrator."); return; }
  if (["admin", "settings"].includes(view) && !currentUserIsAdmin()) {
    showToast("Administrator access is required.");
    return;
  }
  if (view === "access" && !currentUserIsAdmin()) return;
  activeView = view;
  document.querySelectorAll("[data-view-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  document.querySelectorAll(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  document.getElementById("view-title").textContent = viewMeta[view][0];
  document.getElementById("view-eyebrow").textContent = viewMeta[view][1];
  closeSidebar();
  window.CAGE_PERSONAL?.view(view);
  if (view === "training") {
    window.CAGE_TRAINING_UI?.render();
    window.CAGE_TRAINING_UI?.load();
  }
  if (view === "requests") renderRequests();
  if (view === "projects") renderProjects();
  if (view === "tasks") renderTasks();
  if (view === "crm") renderCRM();
  if (view === "calendar") renderCalendar();
  if (view === "missions") renderMissions();
  if (view === "assets") renderAssets();
  if (view === "compliance") renderCompliance();
  if (view === "chat") selectChatThread(activeChatThread);
  if (view === "finance") renderFinance();
  if (view === "approvals") renderApprovals();
  if (view === "commercial") renderCommercial();
  if (view === "leave") renderLeave();
  if (view === "knowledge") renderKnowledge();
  if (view === "team") renderTeam();
  if (view === "evidence") renderEvidence();
  if (view === "reports") renderReports();
  if (view === "settings") renderSettings();
  if (view === "hr" || view === "admin") window.CAGE_HR_UI?.load(view === "admin");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderMetrics() {
  const active = activeTasks();
  const openInvoices = state.invoices.filter(invoice => !["Paid", "Draft"].includes(effectiveInvoiceStatus(invoice)));
  const pendingApprovals = state.approvals.filter(item => item.status === "Pending");
  const deliveryRisks = state.projects.filter(project => projectHealth(project) === "attention");
  const operationalAlerts = state.compliance.filter(record => ["Due soon", "Review required", "Expired"].includes(complianceDisplayStatus(record))).length + state.assets.filter(assetNeedsAttention).length;
  const metrics = [
    { view: "approvals", label: "Decisions waiting", value: pendingApprovals.length, note: pendingApprovals.length ? "Open the approval inbox" : "Nothing waiting", icon: "✓", tone: "#b76e00", tint: "#fff7e6" },
    { view: "projects", label: "Delivery at risk", value: deliveryRisks.length, note: `${active.filter(task => task.status === "Blocked").length} blocked · ${active.filter(isOverdue).length} overdue tasks`, icon: "!", tone: "#c83c3c", tint: "#fff0ef" },
    { view: "finance", label: "Outstanding invoices", value: formatMoney(openInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amount - Number(invoice.paidAmount || 0)), 0), true), note: `${openInvoices.filter(invoice => effectiveInvoiceStatus(invoice) === "Overdue").length} overdue`, icon: "¤", tone: "#6b4bc3", tint: "#f3f0ff" },
    { view: operationalAlerts ? "compliance" : "assets", label: "Operational alerts", value: operationalAlerts, note: operationalAlerts ? "Compliance or equipment action" : "Operations ready", icon: "◈", tone: operationalAlerts ? "#007fae" : "#168a65", tint: operationalAlerts ? "#eaf8fd" : "#eaf8f2" }
  ];
  document.getElementById("metric-grid").innerHTML = metrics.map(metric => `
    <button class="executive-metric" data-go-view="${metric.view}" style="--tone:${metric.tone};--tint:${metric.tint}">
      <span class="metric-label">${metric.label}</span>
      <span class="metric-icon">${metric.icon}</span>
      <div class="metric-value"><strong>${metric.value}</strong></div>
      <span class="metric-trend">${escapeHtml(metric.note)}</span>
    </button>
  `).join("");
}

function attentionScore(task) {
  return (task.priority === "High" ? 5 : 0) + (isOverdue(task) ? 8 : 0) + (task.status === "Blocked" ? 7 : 0) + (task.due === TODAY ? 6 : 0);
}

function renderAttention() {
  const decisions = state.approvals.filter(item => item.status === "Pending").map(item => ({ title: item.title, detail: `Approval requested by ${teamMember(item.requester).name}`, label: "Decision", view: "approvals", tone: "decision" }));
  const blockers = activeTasks().filter(task => task.status === "Blocked" || isOverdue(task)).sort((a,b) => attentionScore(b)-attentionScore(a)).map(task => ({ title: task.title, detail: `${teamMember(task.owner).name} · ${dueLabel(task)}`, label: task.status === "Blocked" ? "Blocked" : "Overdue", task: task.id, tone: "risk" }));
  const receivables = state.invoices.filter(invoice => effectiveInvoiceStatus(invoice) === "Overdue").map(invoice => ({ title: `${invoice.number} · ${invoice.client}`, detail: `${formatMoney(Math.max(0, invoice.amount - Number(invoice.paidAmount || 0)))} outstanding`, label: "Payment", view: "finance", tone: "money" }));
  const items = [...decisions, ...blockers, ...receivables].slice(0,6);
  document.getElementById("attention-list").innerHTML = items.length ? items.map(item => `<button class="attention-item executive-action ${item.tone}" ${item.task ? `data-task-detail="${item.task}"` : `data-go-view="${item.view}"`}><span class="attention-copy"><span class="action-kind">${escapeHtml(item.label)}</span><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></span><span class="action-arrow">›</span></button>`).join("") : `<div class="empty-state compact"><div>✓</div><h3>No urgent decisions</h3><p>The management queue is clear.</p></div>`;
}

function renderFocus() {
  const focusTasks = activeTasks()
    .filter(task => task.due === TODAY || dueWithin(task, 2))
    .sort((a, b) => a.due.localeCompare(b.due))
    .map(task => ({ time: "Due", title: task.title, detail: `${teamMember(task.owner).name} · ${dueLabel(task)}`, sort: `${task.due}T23:59` }));
  const focusEvents = state.events
    .filter(event => event.date === TODAY)
    .map(event => ({ time: event.start, title: event.title, detail: `${event.type} · ${teamMember(event.owner).name}`, sort: `${event.date}T${event.start}` }));
  const focusItems = [...focusEvents, ...focusTasks].sort((a, b) => a.sort.localeCompare(b.sort)).slice(0, 4);
  document.getElementById("focus-list").innerHTML = focusItems.length ? focusItems.map(item => `
    <div class="focus-row">
      <span class="focus-time">${escapeHtml(item.time)}</span>
      <span class="focus-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></span>
    </div>
  `).join("") : `<div class="empty-state"><p>No work due in the next two days.</p></div>`;
  const current = asDate(TODAY);
  document.getElementById("dashboard-focus-date").innerHTML = `<strong>${String(current.getUTCDate()).padStart(2,"0")}</strong><div><span>${current.toLocaleDateString("en-GB",{month:"long",timeZone:"UTC"}).toUpperCase()}</span><b>${current.toLocaleDateString("en-GB",{weekday:"long",timeZone:"UTC"}).toUpperCase()}</b></div>`;
}

function projectRow(project) {
  const owner = teamMember(project.owner);
  const progress = projectProgress(project.id);
  const health = projectHealth(project);
  const sourceRequest = requestById(project.request);
  return `
    <tr>
      <td><div class="project-cell"><span class="project-glyph">${escapeHtml(project.category.slice(0, 2).toUpperCase())}</span><span><strong>${escapeHtml(project.name)}</strong><span>${escapeHtml(project.client)}</span></span></div></td>
      <td><span class="owner-chip"><span class="owner-avatar">${owner.initials}</span>${escapeHtml(owner.name.split(" ")[0])}</span></td>
      <td><span class="status-pill ${health}">${healthLabel(health)}</span></td>
      <td>${formatDate(project.deadline)}</td>
      <td class="progress-cell"><span class="progress-line"><span class="progress-track"><span style="width:${progress}%"></span></span><b>${progress}%</b></span></td>
      <td><button class="row-action" data-project-detail="${project.id}" aria-label="Open ${escapeHtml(project.name)}">›</button></td>
    </tr>
  `;
}

function renderDashboardProjects() {
  const ranked = [...state.projects].sort((a, b) => {
    const rank = { attention: 0, "on-track": 1, complete: 2 };
    return rank[projectHealth(a)] - rank[projectHealth(b)] || a.deadline.localeCompare(b.deadline);
  }).slice(0, 5);
  document.getElementById("dashboard-projects").innerHTML = ranked.map(projectRow).join("");
}

function renderControlStrip() {
  const nextMission = [...state.missions]
    .filter(mission => !["Complete", "Cancelled"].includes(mission.status) && mission.end >= TODAY)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const pendingApprovals = state.approvals.filter(item => item.status === "Pending").length;
  const complianceActions = state.compliance.filter(record => ["Due soon", "Review required", "Expired"].includes(complianceDisplayStatus(record))).length;
  const assetActions = state.assets.filter(assetNeedsAttention).length;
  const requestActions = state.requests.filter(requestNeedsAction).length;
  const controls = [
    { view: "requests", icon: "↳", label: "Requests needing action", value: String(requestActions), detail: requestActions ? "Qualify, approve or convert work" : "Request pipeline is clear", tone: requestActions ? "red" : "green" },
    { view: "missions", icon: "⌖", label: "Next mission", value: nextMission ? formatDate(nextMission.start) : "None planned", detail: nextMission?.title || "Create the next field deployment", tone: "blue" },
    { view: "approvals", icon: "✓", label: "Decisions waiting", value: String(pendingApprovals), detail: pendingApprovals ? "Clear the approval queue" : "No approvals waiting", tone: pendingApprovals ? "amber" : "green" },
    { view: "compliance", icon: "⌾", label: "Compliance actions", value: String(complianceActions), detail: complianceActions ? "Renewals or reviews need attention" : "All records current", tone: complianceActions ? "red" : "green" },
    { view: "assets", icon: "◈", label: "Equipment attention", value: String(assetActions), detail: assetActions ? "Service or condition checks due" : "Fleet ready", tone: assetActions ? "amber" : "green" }
  ];
  document.getElementById("control-strip").innerHTML = controls.map(control => `<button class="control-card ${control.tone}" data-go-view="${control.view}"><span class="control-icon">${control.icon}</span><span class="control-copy"><small>${escapeHtml(control.label)}</small><strong>${escapeHtml(control.value)}</strong><span>${escapeHtml(control.detail)}</span></span><b>›</b></button>`).join("");
}

function renderDashboard() {
  renderMetrics();
  renderAttention();
  renderFocus();
  document.getElementById("requests-nav-count").textContent = state.requests.filter(requestNeedsAction).length;
  document.getElementById("projects-nav-count").textContent = state.projects.length;
  document.getElementById("tasks-nav-count").textContent = activeTasks().length;
  document.getElementById("crm-nav-count").textContent = state.deals.filter(deal => !["Won", "Lost"].includes(deal.stage)).length;
  document.getElementById("calendar-nav-count").textContent = state.events.filter(event => event.date >= (window.CAGE_OPS?.period().from || TODAY) && event.date <= (window.CAGE_OPS?.period().to || TODAY)).length + state.missions.filter(mission => !["Complete", "Cancelled"].includes(mission.status) && mission.start >= TODAY && mission.start <= "2026-09-11").length;
  document.getElementById("missions-nav-count").textContent = state.missions.filter(mission => !["Complete", "Cancelled"].includes(mission.status)).length;
  document.getElementById("assets-nav-count").textContent = state.assets.filter(assetNeedsAttention).length;
  document.getElementById("compliance-nav-count").textContent = state.compliance.filter(record => ["Due soon", "Review required", "Expired"].includes(complianceDisplayStatus(record))).length;
  const currentMember = window.CAGE_BACKEND?.currentMemberId?.() || "alexander";
  document.getElementById("chat-nav-count").textContent = window.CAGE_PERSONAL?.chatUnreadTotal?.() || state.messages.filter(message => message.unread && message.sender !== currentMember && threadById(threadIdForMessage(message))).length;
  document.getElementById("finance-nav-count").textContent = state.invoices.filter(invoice => effectiveInvoiceStatus(invoice) === "Overdue").length;
  document.getElementById("approvals-nav-count").textContent = state.approvals.filter(item => item.status === "Pending").length;
  document.getElementById("commercial-nav-count").textContent = state.commercialRecords.filter(commercialNeedsAttention).length;
  document.getElementById("leave-nav-count").textContent = state.leaveRequests.filter(request => request.status === "Pending").length;
  document.getElementById("knowledge-nav-count").textContent = state.knowledge.length;
  document.getElementById("evidence-nav-count").textContent = state.tasks.filter(task => task.status === "Done" && !task.evidence).length;
  window.CAGE_PERSONAL?.updateBadge();
}

function renderRequests() {
  const searchInput = document.getElementById("request-search");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const active = state.requests.filter(request => !["Converted", "Lost / Declined"].includes(request.stage));
  const needsInformation = state.requests.filter(request => ["New", "Needs information"].includes(request.stage));
  const awaitingReview = state.requests.filter(request => request.stage === "Internal review");
  const converted = state.requests.filter(request => request.stage === "Converted");
  const deadlineActions = active.filter(request => daysUntil(request.deadline) <= 7);
  renderMetricCards("request-metric-grid", [
    { label: "Open requests", value: String(active.length), unit: "requests", note: `${needsInformation.length} still need clarification`, icon: "↳", tone: "#008fc8", tint: "#e6f7fe" },
    { label: "Needs action", value: String(state.requests.filter(requestNeedsAction).length), unit: "requests", note: "Owner, deadline or gate action", icon: "!", tone: "#d64e4b", tint: "#feeceb" },
    { label: "Internal review", value: String(awaitingReview.length), unit: "requests", note: "Nothing is sent before approval", icon: "✓", tone: "#e99a24", tint: "#fff4df" },
    { label: "Converted value", value: formatMoney(converted.reduce((sum, request) => sum + Number(request.value || 0), 0), true), unit: "", note: `${converted.length} requests became projects`, icon: "¤", tone: "#168a65", tint: "#e5f5ef" },
    { label: "Due within 7 days", value: String(deadlineActions.length), unit: "requests", note: "Including overdue responses", icon: "□", tone: "#7357c8", tint: "#f0edfb" }
  ]);

  const matches = state.requests.filter(request => {
    const matchesFilter = requestFilter === "all"
      || (requestFilter === "action" && requestNeedsAction(request))
      || (requestFilter === "service" && !["Tender / RFQ", "Grant"].includes(request.type))
      || request.type === requestFilter
      || request.stage === requestFilter;
    const haystack = `${request.number} ${request.title} ${request.organisation} ${request.contact} ${request.type} ${request.summary} ${request.nextAction}`.toLowerCase();
    return matchesFilter && (!query || haystack.includes(query));
  }).sort((a, b) => Number(requestNeedsAction(b)) - Number(requestNeedsAction(a)) || a.deadline.localeCompare(b.deadline));

  document.getElementById("request-board").innerHTML = REQUEST_PIPELINES.map(column => {
    const records = matches.filter(request => requestBucket(request) === column.title);
    return `<section class="request-column" aria-label="${escapeHtml(column.title)} requests">
      <div class="request-column-head"><span><strong>${escapeHtml(column.title)}</strong><small>${escapeHtml(column.subtitle)}</small></span><b>${records.length}</b></div>
      <div class="request-column-cards">${records.length ? records.map(request => requestCard(request)).join("") : `<div class="request-empty">No matching requests</div>`}</div>
      <button class="request-quick-add" data-new-request-stage="${escapeHtml(column.stages[0])}">＋ Add request</button>
    </section>`;
  }).join("");
}

function requestCard(request) {
  const owner = teamMember(request.owner);
  const stats = requestChecklistStats(request);
  const days = daysUntil(request.deadline);
  const controlGap = request.stage === "Converted" && !requestAcceptanceComplete(request);
  const dueCopy = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`;
  return `<article class="request-card ${requestNeedsAction(request) ? "attention" : ""} ${controlGap ? "control-gap" : ""}">
    <div class="request-card-top"><span class="request-type">${escapeHtml(request.type)}</span><span class="request-number">${escapeHtml(request.number)}</span></div>
    <button class="request-card-title" data-open-request="${request.id}">${escapeHtml(request.title)}</button>
    <p>${escapeHtml(request.organisation)}</p>
    <div class="request-card-meta"><span class="owner-avatar" title="${escapeHtml(owner.name)}">${owner.initials}</span><span class="deadline-chip ${days < 0 ? "overdue" : days <= 7 ? "soon" : ""}">${escapeHtml(dueCopy)}</span>${request.value ? `<strong>${formatMoney(request.value, true)}</strong>` : ""}</div>
    <div class="request-progress-head"><span>${stats.done}/${stats.total} controls</span><b>${stats.percent}%</b></div>
    <div class="progress-track"><span style="width:${stats.percent}%"></span></div>
    ${controlGap ? `<div class="request-control-gap">! Control gap: acceptance evidence missing</div>` : ""}
    <select class="request-stage-select ${requestStatusClass(request.stage)}" data-request-stage="${request.id}" aria-label="Stage for ${escapeHtml(request.title)}">${REQUEST_STAGE_OPTIONS.map(stage => `<option ${stage === request.stage ? "selected" : ""}>${escapeHtml(stage)}</option>`).join("")}</select>
    <button class="request-open-button" data-open-request="${request.id}">Open workflow <span>›</span></button>
  </article>`;
}

function renderRequestDetail(requestId = activeRequestId) {
  const request = requestById(requestId);
  if (!request) return;
  activeRequestId = request.id;
  const owner = teamMember(request.owner);
  const stats = requestChecklistStats(request);
  const linkedApproval = [...state.approvals].reverse().find(item => item.linkedType === "request" && item.linkedId === request.id);
  const linkedCommercial = state.commercialRecords.find(item => item.id === request.commercial);
  const actionButtons = requestActionButtons(request);
  document.getElementById("request-detail-content").innerHTML = `
    <div class="dialog-heading request-detail-heading"><div><p class="section-kicker">${escapeHtml(request.number)} · ${escapeHtml(request.type)}</p><h2>${escapeHtml(request.title)}</h2><p>${escapeHtml(request.organisation)}</p></div><button class="icon-button" data-close-request-detail aria-label="Close">×</button></div>
    <div class="request-detail-status"><span class="status-pill ${requestStatusClass(request.stage)}">${escapeHtml(request.stage)}</span><span>${stats.done}/${stats.total} workflow controls complete</span><div class="progress-track"><span style="width:${stats.percent}%"></span></div></div>
    <div class="request-detail-grid">
      <section>
        <div class="request-fact-grid">
          <div><span>Contact</span><strong>${escapeHtml(request.contact)}</strong><small>${escapeHtml(request.contactDetail || "No contact detail")}</small></div>
          <label><span>Owner</span><select data-request-owner="${request.id}">${assignableTeam().map(member => `<option value="${member.id}" ${member.id === request.owner ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}</select></label>
          <div><span>Response deadline</span><strong>${formatDate(request.deadline, { year: true })}</strong><small>${daysUntil(request.deadline) < 0 ? `${Math.abs(daysUntil(request.deadline))} days overdue` : `${daysUntil(request.deadline)} days remaining`}</small></div>
          <div><span>Delivery target</span><strong>${formatDate(request.deliveryDeadline, { year: true })}</strong><small>${escapeHtml(request.location || "Location not set")}</small></div>
          <div><span>Source</span><strong>${escapeHtml(request.source)}</strong><small>Received ${formatDate(request.received, { year: true })}</small></div>
          <div><span>Potential value</span><strong>${request.value ? formatMoney(request.value) : "Not recorded"}</strong><small>${escapeHtml(request.priority)} priority</small></div>
        </div>
        <article class="request-brief"><span>Request summary</span><p>${escapeHtml(request.summary)}</p><span>Evidence and source files</span><p>${escapeHtml(request.attachments || "No links or documents recorded")}</p></article>
        <label class="request-next-action"><span>Next specific action</span><input data-request-next-action="${request.id}" value="${escapeHtml(request.nextAction)}" maxlength="160"></label>
      </section>
      <aside class="request-checklist-panel">
        <div class="surface-heading"><div><p class="section-kicker">${escapeHtml(request.type)} template</p><h3>Stage gates</h3></div><strong>${stats.percent}%</strong></div>
        <div class="request-checklist">${requestTemplate(request).map(item => `<button class="request-check ${request.checklist?.[item.key] ? "complete" : ""}" data-request-check="${request.id}" data-check-key="${item.key}"><span>${request.checklist?.[item.key] ? "✓" : ""}</span><p><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.phase)}</small></p></button>`).join("")}</div>
      </aside>
    </div>
    ${linkedApproval ? `<div class="request-review-note ${linkedApproval.status.toLowerCase()}"><strong>Latest internal review: ${escapeHtml(linkedApproval.status)}</strong><span>${escapeHtml(linkedApproval.decisionNote || linkedApproval.summary)}</span></div>` : ""}
    <div class="request-detail-actions"><button data-open-work-chat="request" data-work-chat-id="${request.id}">◌ Open work chat</button>${actionButtons}${request.deal ? `<button data-request-open-deal="${request.id}">Open CRM opportunity</button>` : ""}${linkedCommercial ? `<button data-request-open-commercial="${request.id}">Open ${escapeHtml(linkedCommercial.type.toLowerCase())}</button>` : ""}${request.project ? `<button class="primary" data-request-open-project="${request.id}">Open delivery project</button>` : ""}</div>
  `;
}

function requestActionButtons(request) {
  const buttons = [];
  if (["New", "Needs information"].includes(request.stage)) buttons.push(`<button data-request-action="qualify" data-request-id="${request.id}" ${requestQualificationComplete(request) ? "" : "disabled"}>Confirm qualified</button>`);
  if (request.stage === "Qualified") buttons.push(`<button data-request-action="scope" data-request-id="${request.id}">Start scoping</button>`);
  if (request.stage === "Scoping") {
    if (!["Tender / RFQ", "Grant"].includes(request.type)) buttons.push(`<button data-request-action="quote" data-request-id="${request.id}">Prepare quote</button>`);
    buttons.push(`<button class="primary" data-request-action="review" data-request-id="${request.id}" ${requestPreReviewComplete(request) ? "" : "disabled"}>${currentUserCanSelfApprove() ? 'Approve for sending' : 'Request internal approval'}</button>`);
  }
  if (request.stage === "Internal review") buttons.push(`<button disabled>Awaiting approval</button>`);
  if (request.stage === "Approved to send") buttons.push(`<button class="primary" data-request-action="submit" data-request-id="${request.id}">Record submission</button>`);
  if (request.stage === "Submitted") buttons.push(`<button data-request-action="negotiate" data-request-id="${request.id}">Record negotiation</button>`, `<button class="primary" data-request-action="win" data-request-id="${request.id}">Record award / acceptance</button>`);
  if (request.stage === "Negotiation") buttons.push(`<button class="primary" data-request-action="win" data-request-id="${request.id}">Record award / acceptance</button>`);
  if (request.stage === "Won / Awarded") buttons.push(`<button class="primary" data-request-action="convert" data-request-id="${request.id}" ${requestAcceptanceComplete(request) ? "" : "disabled"}>Create contract & project</button>`);
  if (!["Converted", "Lost / Declined"].includes(request.stage)) buttons.push(`<button data-request-action="schedule" data-request-id="${request.id}">Schedule follow-up</button>`, `<button class="danger" data-request-action="lose" data-request-id="${request.id}">Close as lost</button>`);
  return buttons.join("");
}

function openRequest(requestId) {
  if (!requestById(requestId)) return;
  renderRequestDetail(requestId);
  document.getElementById("request-detail-dialog").showModal();
}

function renderProjects() {
  const query = document.getElementById("project-search").value.trim().toLowerCase();
  const projects = state.projects.filter(project => {
    const health = projectHealth(project);
    const matchesFilter = projectFilter === "all" || health === projectFilter;
    const matchesSearch = !query || `${project.name} ${project.client} ${project.category}`.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });
  document.getElementById("project-grid").innerHTML = projects.length ? projects.map(project => {
    const health = projectHealth(project);
    const progress = projectProgress(project.id);
    const owner = teamMember(project.owner);
    const members = project.team.map(id => teamMember(id));
    return `
      <article class="project-card" data-project-detail="${project.id}">
        <div class="project-card-top"><span class="project-glyph">${escapeHtml(project.category.slice(0,2).toUpperCase())}</span><span class="status-pill ${health}">${healthLabel(health)}</span></div>
        <h3>${escapeHtml(project.name)}</h3>
        <p class="project-client">${escapeHtml(project.client)} · Led by ${escapeHtml(owner.name)}</p>
        <div class="project-card-bottom">
          <div class="project-card-meta"><span>Due ${formatDate(project.deadline, { year: true })}</span><strong>${progress}% complete</strong></div>
          <div class="progress-track"><span style="width:${progress}%"></span></div>
          <div class="project-card-footer">
            <span class="member-stack">${members.slice(0,4).map(member => `<span class="owner-avatar" title="${escapeHtml(member.name)}">${member.initials}</span>`).join("")}</span>
            <button class="text-button" data-project-detail="${project.id}">Open project</button>
          </div>
        </div>
      </article>
    `;
  }).join("") : `<div class="empty-state"><div>▦</div><h3>No matching projects</h3><p>Clear the search or choose another health filter.</p></div>`;
}

function renderOwnerOptions() {
  const ownerFilter = document.getElementById("owner-filter");
  const selected = ownerFilter.value || "all";
  ownerFilter.innerHTML = `<option value="all">Everyone</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  ownerFilter.value = assignableTeam().some(member => member.id === selected) ? selected : "all";
  document.getElementById("task-owner-input").innerHTML = `<option value="">Select owner</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("project-owner-input").innerHTML = `<option value="">Select project lead</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("deal-owner-input").innerHTML = `<option value="">Select owner</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("event-owner-input").innerHTML = `<option value="">Select owner</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("leave-person-input").innerHTML = `<option value="">Select team member</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("knowledge-owner-input").innerHTML = `<option value="">Select owner</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("mission-lead-input").innerHTML = `<option value="">Select mission lead</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("asset-custodian-input").innerHTML = `<option value="">Select custodian</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("compliance-owner-input").innerHTML = `<option value="">Select owner</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("approval-requester-input").innerHTML = `<option value="">Select requester</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("commercial-owner-input").innerHTML = `<option value="">Select owner</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("request-owner-input").innerHTML = `<option value="">Select owner</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
  document.getElementById("contact-owner-input").innerHTML = `<option value="">Select owner</option>${assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}`;
}

function renderProjectOptions() {
  const options = state.projects.map(project => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("");
  document.getElementById("task-project-input").innerHTML = `<option value="">Select project</option>${options}`;
  document.getElementById("event-project-input").innerHTML = `<option value="">No linked project</option>${options}`;
  document.getElementById("invoice-project-input").innerHTML = `<option value="">Select project</option>${options}`;
  document.getElementById("expense-project-input").innerHTML = `<option value="">Select project</option>${options}`;
  document.getElementById("knowledge-project-input").innerHTML = `<option value="">General CAGE reference</option>${options}`;
  document.getElementById("mission-project-input").innerHTML = `<option value="">Select project</option>${options}`;
  document.getElementById("asset-project-input").innerHTML = `<option value="">Not assigned to a project</option>${options}`;
  const boardFilter = document.getElementById("board-project-filter");
  boardFilter.innerHTML = `<option value="all">All projects</option>${options}`;
  boardFilter.value = state.projects.some(project => project.id === boardProjectFilter) ? boardProjectFilter : "all";
  document.getElementById("quote-deal-input").innerHTML = `<option value="">No linked opportunity</option>${state.deals.map(deal => `<option value="${deal.id}">${escapeHtml(deal.name)} · ${escapeHtml(deal.company)}</option>`).join("")}`;
  document.getElementById("mission-asset-input").innerHTML = `<option value="">Assign later</option>${state.assets.filter(asset => asset.category === "Aircraft").map(asset => `<option value="${asset.id}">${escapeHtml(asset.name)} · ${escapeHtml(asset.status)}</option>`).join("")}`;
}

function renderTasks() {
  const query = document.getElementById("task-search").value.trim().toLowerCase();
  const ownerFilter = document.getElementById("owner-filter").value;
  const tasks = state.tasks.filter(task => {
    let matchesFilter = true;
    if (taskFilter === "mine") matchesFilter = task.status !== "Done" && task.owner === "alexander";
    if (taskFilter === "overdue") matchesFilter = isOverdue(task);
    if (taskFilter === "blocked") matchesFilter = task.status === "Blocked";
    if (taskFilter === "done") matchesFilter = task.status === "Done";
    const project = projectById(task.project);
    const matchesSearch = !query || `${task.title} ${task.output} ${project?.name || ""}`.toLowerCase().includes(query);
    const matchesOwner = ownerFilter === "all" || task.owner === ownerFilter;
    const matchesProject = boardProjectFilter === "all" || task.project === boardProjectFilter;
    return matchesFilter && matchesSearch && matchesOwner && matchesProject;
  }).sort((a, b) => {
    if (a.status === "Blocked" && b.status !== "Blocked") return -1;
    if (b.status === "Blocked" && a.status !== "Blocked") return 1;
    return a.due.localeCompare(b.due);
  });

  const taskList = document.getElementById("task-list");
  const empty = document.getElementById("task-empty");
  empty.hidden = tasks.length > 0;
  taskList.innerHTML = tasks.map(task => {
    const owner = teamMember(task.owner);
    const project = projectById(task.project);
    const overdue = isOverdue(task);
    return `
      <div class="task-row">
        <div class="task-main"><div class="task-main-top"><span class="priority-mark ${task.priority.toLowerCase()}"></span><strong>${escapeHtml(task.title)}</strong></div><span>${escapeHtml(project?.name || "Internal")} · ${escapeHtml(task.priority)} priority</span></div>
        <span class="owner-chip"><span class="owner-avatar">${owner.initials}</span>${escapeHtml(owner.name.split(" ")[0])}</span>
        <span class="due-date ${overdue ? "overdue" : ""}">${escapeHtml(dueLabel(task))}</span>
        <select class="task-status-select" data-task-status="${task.id}" aria-label="Status for ${escapeHtml(task.title)}">
          ${["To Do", "Doing", "Blocked", "Done"].map(status => `<option ${status === task.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <span class="evidence-state ${task.evidence ? "" : "missing"}">${task.evidence ? "✓ Attached" : "○ Missing"}</span>
        <button class="row-action" data-task-detail="${task.id}" aria-label="View ${escapeHtml(task.title)}">›</button>
      </div>
    `;
  }).join("");

  document.getElementById("task-kanban").innerHTML = `${state.boardLists.map(list => {
    const cards = tasks.filter(task => taskListId(task) === list.id);
    return `
      <section class="kanban-column" data-list-id="${list.id}" ${list.status ? `data-status="${list.status}"` : ""}>
        <div class="kanban-heading"><input class="kanban-list-title" data-list-title="${list.id}" value="${escapeHtml(list.title)}" aria-label="Edit list heading"><b>${cards.length}</b></div>
        <div class="kanban-cards">
          ${cards.map(task => {
            const owner = teamMember(task.owner);
            const project = projectById(task.project);
            return `
              <article class="kanban-card" draggable="true" data-task-card="${task.id}">
                <div class="kanban-card-top"><span class="kanban-project">${escapeHtml(project?.name || "Internal")}</span><span class="priority-tag ${task.priority.toLowerCase()}">${escapeHtml(task.priority)}</span></div>
                <textarea class="inline-card-title" data-inline-task-title="${task.id}" rows="${Math.min(3, Math.max(1, Math.ceil(task.title.length / 30)))}" aria-label="Edit card title">${escapeHtml(task.title)}</textarea>
                <div class="kanban-card-meta"><span class="owner-chip"><span class="owner-avatar">${owner.initials}</span>${escapeHtml(owner.name.split(" ")[0])}</span><span class="due-date ${isOverdue(task) ? "overdue" : ""}">${escapeHtml(dueLabel(task))}</span></div>
                <div class="kanban-card-footer">
                  <span class="evidence-state ${task.evidence ? "" : "missing"}">${task.evidence ? "✓ Evidence" : "○ No evidence"}</span>
                  <button class="board-open" data-task-detail="${task.id}" aria-label="Open details for ${escapeHtml(task.title)}">•••</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
        ${boardAddingListId === list.id ? `<form class="quick-card-form" data-quick-card-form="${list.id}"><textarea class="quick-card-input" name="title" maxlength="120" placeholder="Type a card title…" required autofocus></textarea><div class="quick-card-actions"><button class="quick-card-save" type="submit">Add card</button><button class="quick-card-cancel" type="button" data-cancel-quick-card>Cancel</button></div></form>` : `<button class="quick-card-button" data-add-card-list="${list.id}">＋ Add a card</button>`}
      </section>
    `;
  }).join("")}<section class="kanban-add-list">${addingBoardList ? `<form class="quick-card-form" id="quick-list-form"><input class="quick-list-input" name="title" maxlength="50" placeholder="List heading…" required autofocus><div class="quick-card-actions"><button class="quick-card-save" type="submit">Add list</button><button class="quick-card-cancel" type="button" data-cancel-list>Cancel</button></div></form>` : `<button class="add-list-button" data-add-list>＋ Add another heading</button>`}</section>`;
  document.getElementById("task-kanban-wrap").hidden = taskDisplay !== "board";
  document.getElementById("task-list-surface").hidden = taskDisplay !== "list";
  requestAnimationFrame(() => document.querySelector("[autofocus]")?.focus());
}

function addQuickCard(listId, title) {
  const cleanTitle = String(title || "").trim();
  const list = boardListById(listId);
  if (!cleanTitle || !list) return;
  const due = asDate(TODAY);
  due.setUTCDate(due.getUTCDate() + 7);
  state.tasks.push({
    id: `t-${Date.now()}`,
    project: boardProjectFilter !== "all" ? boardProjectFilter : "p-internal",
    title: cleanTitle,
    owner: "alexander",
    due: due.toISOString().slice(0, 10),
    priority: "Medium",
    status: list.status || "To Do",
    list: list.id,
    output: `Complete ${cleanTitle.toLowerCase()} and record the agreed outcome.`,
    evidence: "",
    updated: TODAY
  });
  boardAddingListId = "";
  saveState();
  renderAll();
  showToast("Card added. Click its title to edit or ••• for details.");
}

function addBoardList(title) {
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) return;
  state.boardLists.push({ id: `list-${Date.now()}`, title: cleanTitle, status: null });
  addingBoardList = false;
  saveState();
  renderAll();
  showToast(`${cleanTitle} heading added.`);
}

function updateTaskTitle(taskId, title) {
  const task = state.tasks.find(item => item.id === taskId);
  const cleanTitle = String(title || "").trim();
  if (!task) return;
  if (!cleanTitle) {
    renderTasks();
    showToast("A card needs a title.");
    return;
  }
  if (task.title === cleanTitle) return;
  task.title = cleanTitle;
  task.updated = TODAY;
  saveState();
  renderDashboard();
  renderReports();
  showToast("Card title updated.");
}

function updateBoardListTitle(listId, title) {
  const list = boardListById(listId);
  const cleanTitle = String(title || "").trim();
  if (!list) return;
  if (!cleanTitle) {
    renderTasks();
    showToast("A board heading cannot be empty.");
    return;
  }
  if (list.title === cleanTitle) return;
  list.title = cleanTitle;
  saveState();
  showToast("Heading renamed.");
}

async function moveTaskToList(taskId, listId) {
  let task = state.tasks.find(item => item.id === taskId);
  const list = boardListById(listId);
  if (!task || !list || taskListId(task) === listId) return;
  if (list.status === "Blocked" && !task.blocker) {
    const reason = await window.CAGE_OPS.ask("What is preventing this card from progressing?");
    if (!reason?.trim()) {
      showToast("A blocker reason is required.");
      renderTasks();
      return;
    }
    task=state.tasks.find(t=>t.id===taskId);if(!task)return;
    task.blocker = reason.trim();
  }
  if (list.status === "Done" && !task.evidence) {
    const evidence = await window.CAGE_OPS.ask("Add a completion note, file name or evidence link before moving this card to Done.",{task:task.id});
    if (!evidence?.trim()) {
      showToast("Completion evidence is required.");
      renderTasks();
      return;
    }
    task=state.tasks.find(t=>t.id===taskId);if(!task)return;
    task=state.tasks.find(t=>t.id===taskId);if(!task)return;
  task.evidence = evidence.trim();
  }
  task.list = list.id;
  task.status = list.status || "To Do";
  if (list.status !== "Blocked") delete task.blocker;
  task.updated = TODAY;
  saveState();
  renderAll();
  showToast(`${task.title} moved to ${list.title}.`);
}

function renderMetricCards(targetId, metrics) {
  document.getElementById(targetId).innerHTML = metrics.map(metric => `
    <article class="metric-card" style="--tone:${metric.tone};--tint:${metric.tint}">
      <span class="metric-label">${escapeHtml(metric.label)}</span>
      <span class="metric-icon">${metric.icon}</span>
      <div class="metric-value"><strong>${escapeHtml(metric.value)}</strong>${metric.unit ? `<span>${escapeHtml(metric.unit)}</span>` : ""}</div>
      <span class="metric-trend">${escapeHtml(metric.note)}</span>
    </article>
  `).join("");
}

function renderCRM() {
  const stages = ["Prospect", "Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
  const activeDeals = state.deals.filter(deal => !["Won", "Lost"].includes(deal.stage));
  const pipelineValue = activeDeals.reduce((sum, deal) => sum + deal.value, 0);
  const weightedValue = activeDeals.reduce((sum, deal) => sum + (deal.value * deal.probability / 100), 0);
  const dueFollowUps = activeDeals.filter(deal => deal.nextAction <= TODAY).length;
  renderMetricCards("crm-metric-grid", [
    { label: "Open opportunities", value: String(activeDeals.length), unit: "deals", note: `${dueFollowUps} follow-ups due`, icon: "◇", tone: "#7357c8", tint: "#f0edfb" },
    { label: "Pipeline value", value: formatMoney(pipelineValue, true), unit: "", note: "Total open potential", icon: "↗", tone: "#008fc8", tint: "#e6f7fe" },
    { label: "Weighted forecast", value: formatMoney(weightedValue, true), unit: "", note: "Value adjusted by probability", icon: "≈", tone: "#e99a24", tint: "#fff4df" },
    { label: "Won value", value: formatMoney(state.deals.filter(deal => deal.stage === "Won").reduce((sum, deal) => sum + deal.value, 0), true), unit: "", note: "Ready for delivery and billing", icon: "✓", tone: "#168a65", tint: "#e5f5ef" }
  ]);

  document.getElementById("crm-pipeline").innerHTML = stages.map(stage => {
    const deals = state.deals.filter(deal => deal.stage === stage).sort((a, b) => b.value - a.value);
    return `
      <section class="pipeline-column crm-stage-column" data-stage="${stage}" data-deal-stage-column="${stage}">
        <div class="pipeline-column-heading"><strong>${stage}</strong><span>${deals.length} · ${formatMoney(deals.reduce((sum, deal) => sum + deal.value, 0), true)}</span></div>
        <div class="pipeline-cards">
          ${deals.length ? deals.map(deal => `
            <article class="deal-card" draggable="true" data-deal-card="${deal.id}">
              <input class="inline-deal-company" data-inline-deal-company="${deal.id}" value="${escapeHtml(deal.company)}" aria-label="Edit organisation for ${escapeHtml(deal.name)}">
              <textarea class="inline-deal-title" data-inline-deal-title="${deal.id}" rows="${Math.min(3, Math.max(1, Math.ceil(deal.name.length / 27)))}" aria-label="Edit opportunity name">${escapeHtml(deal.name)}</textarea>
              <strong class="deal-value">${formatMoney(deal.value, true)}</strong>
              <div class="deal-meta"><span>${deal.probability}% probability</span><span>${formatDate(deal.nextAction)}</span></div>
              <textarea class="inline-deal-next" data-inline-deal-next="${deal.id}" rows="2" aria-label="Edit next action for ${escapeHtml(deal.name)}">${escapeHtml(deal.nextStep)}</textarea>
              <select class="deal-stage-select" data-deal-stage="${deal.id}" aria-label="Stage for ${escapeHtml(deal.name)}">${stages.map(option => `<option ${option === deal.stage ? "selected" : ""}>${option}</option>`).join("")}</select>
              <div class="deal-actions">
                <button data-edit-deal="${deal.id}">Edit opportunity</button>
                <button data-open-work-chat="deal" data-work-chat-id="${deal.id}">Work chat</button>
                <button data-schedule-deal="${deal.id}">Schedule follow-up</button>
                <button data-new-quote-deal="${deal.id}">Create quote</button>
                ${deal.stage === "Won" && !deal.project ? `<button data-create-project-deal="${deal.id}">Create project</button>` : ""}
                ${deal.project ? `<button data-project-detail="${deal.project}">Open project</button>` : ""}
              </div>
            </article>
          `).join("") : `<div class="kanban-empty">No opportunities</div>`}
        </div>
        ${crmAddingStage === stage ? `<form class="quick-deal-form" data-quick-deal-form="${stage}"><textarea name="name" maxlength="120" placeholder="Type opportunity name…" required autofocus></textarea><input name="company" maxlength="80" placeholder="Organisation (optional)"><div class="quick-card-actions"><button class="quick-card-save" type="submit">Add opportunity</button><button class="quick-card-cancel" type="button" data-cancel-quick-deal>Cancel</button></div></form>` : `<button class="quick-card-button" data-add-deal-stage="${stage}">＋ Add opportunity</button>`}
      </section>
    `;
  }).join("");

  document.getElementById("crm-client-list").innerHTML = [...state.contacts]
    .sort((a, b) => a.nextAction.localeCompare(b.nextAction))
    .map(contact => {
      const owner = teamMember(contact.owner);
      return `<tr class="clickable-contact-row" data-contact-detail="${contact.id}" tabindex="0" aria-label="Open ${escapeHtml(contact.company)} relationship"><td><button class="contact-name-button" data-contact-detail="${contact.id}"><span class="project-glyph">${initials(contact.company)}</span><span><strong>${escapeHtml(contact.company)}</strong><span>${escapeHtml(contact.contact)}</span></span></button></td><td><span class="status-pill ${contact.relationship === "Client" ? "done" : contact.relationship === "Partner" ? "on-track" : "to-do"}">${escapeHtml(contact.relationship)}</span></td><td><span class="owner-chip"><span class="owner-avatar">${owner.initials}</span>${escapeHtml(owner.name.split(" ")[0])}</span></td><td>${formatDate(contact.lastActivity)}</td><td><strong>${formatDate(contact.nextAction)}</strong><br><span class="project-client">${escapeHtml(contact.note)}</span></td></tr>`;
    }).join("");
}

function openContactDetail(contactId) {
  const contact = state.contacts.find(item => item.id === contactId);
  if (!contact) return;
  activeContactId = contact.id;
  const form = document.getElementById("contact-detail-form");
  form.elements.company.value = contact.company;
  form.elements.contact.value = contact.contact;
  form.elements.relationship.value = contact.relationship;
  form.elements.owner.value = contact.owner;
  form.elements.lastActivity.value = contact.lastActivity;
  form.elements.nextAction.value = contact.nextAction;
  form.elements.note.value = contact.note;
  document.getElementById("contact-detail-title").textContent = contact.company;
  const deals = state.deals.filter(deal => deal.company === contact.company);
  const projectIds = new Set(deals.map(deal => deal.project).filter(Boolean));
  state.projects.filter(project => project.client === contact.company).forEach(project => projectIds.add(project.id));
  const projects = [...projectIds].map(projectById).filter(Boolean);
  document.getElementById("contact-linked-work").innerHTML = `
    <div class="contact-linked-group"><strong>Opportunities</strong>${deals.length ? deals.map(deal => `<button type="button" data-contact-open-deal="${deal.id}"><span>${escapeHtml(deal.name)}</span><small>${escapeHtml(deal.stage)} · ${formatMoney(deal.value, true)}</small></button>`).join("") : `<p>No CRM opportunities linked yet.</p>`}</div>
    <div class="contact-linked-group"><strong>Projects</strong>${projects.length ? projects.map(project => `<button type="button" data-project-detail="${project.id}"><span>${escapeHtml(project.name)}</span><small>${projectProgress(project.id)}% complete · due ${formatDate(project.deadline, { year: true })}</small></button>`).join("") : `<p>No delivery projects linked yet.</p>`}</div>`;
  document.getElementById("contact-detail-dialog").showModal();
}

function saveContactDetail(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("contact-detail-dialog").close();
    return;
  }
  const contact = state.contacts.find(item => item.id === activeContactId);
  if (!contact) return;
  const data = new FormData(event.currentTarget);
  const previousCompany = contact.company;
  const nextCompany = String(data.get("company") || "").trim();
  if (!nextCompany) return;
  Object.assign(contact, {
    company: nextCompany,
    contact: String(data.get("contact") || "").trim(),
    relationship: String(data.get("relationship") || "Prospect"),
    owner: String(data.get("owner") || "alexander"),
    lastActivity: String(data.get("lastActivity") || TODAY),
    nextAction: String(data.get("nextAction") || TODAY),
    note: String(data.get("note") || "").trim()
  });
  if (previousCompany !== nextCompany) {
    state.deals.filter(deal => deal.company === previousCompany).forEach(deal => { deal.company = nextCompany; });
    state.projects.filter(project => project.client === previousCompany).forEach(project => { project.client = nextCompany; });
  }
  saveState();
  document.getElementById("contact-detail-dialog").close();
  renderAll();
  showToast("Relationship updated.");
}

function addQuickDeal(stage, name, company) {
  const cleanName = String(name || "").trim();
  const cleanCompany = String(company || "").trim() || "Organisation to confirm";
  if (!cleanName) return;
  const probabilityByStage = { Prospect: 10, Lead: 20, Qualified: 40, Proposal: 60, Negotiation: 80, Won: 100, Lost: 0 };
  const deal = {
    id: `d-${Date.now()}`,
    name: cleanName,
    company: cleanCompany,
    owner: "alexander",
    value: 0,
    stage,
    probability: probabilityByStage[stage] ?? 10,
    nextAction: dateAfter(7),
    nextStep: "Qualify the opportunity and agree the next action.",
    project: ""
  };
  state.deals.push(deal);
  if (deal.company !== "Organisation to confirm" && !contactByCompany(deal.company)) state.contacts.push({ id: `c-${Date.now()}`, company: deal.company, contact: "New relationship", relationship: stage === "Won" ? "Client" : "Prospect", owner: deal.owner, lastActivity: TODAY, nextAction: deal.nextAction, note: deal.nextStep });
  addSystemWorkMessage(`deal:${deal.id}`, `Proactive opportunity created in ${stage}. ${teamMember(deal.owner).name} owns the next action.`);
  crmAddingStage = "";
  saveState();
  renderAll();
  showToast("Opportunity added. Write directly on the card or drag it to another stage.");
}

function updateDealField(dealId, field, value) {
  const deal = dealById(dealId);
  const cleanValue = String(value || "").trim();
  if (!deal || !["name", "company", "nextStep"].includes(field)) return;
  if (!cleanValue) {
    renderCRM();
    showToast("Opportunity names, organisations and next actions cannot be empty.");
    return;
  }
  if (deal[field] === cleanValue) return;
  const previousCompany = deal.company;
  const linkedContact = contactByCompany(previousCompany);
  deal[field] = cleanValue;
  if (field === "company" && linkedContact) linkedContact.company = cleanValue;
  const contact = contactByCompany(deal.company);
  if (contact && field === "nextStep") contact.note = cleanValue;
  saveState();
  renderDashboard();
  renderReports();
  showToast(field === "nextStep" ? "Next action updated." : "Opportunity card updated.");
}

function calendarItemsForDate(date) {
  const events = state.events.filter(event => event.date === date).map(event => ({
    kind: event.type.toLowerCase(),
    title: event.title,
    time: event.start,
    sort: event.start,
    detail: `${event.start}–${event.end} · ${teamMember(event.owner).name}`
  }));
  const deadlines = activeTasks().filter(task => task.due === date).map(task => ({
    kind: "deadline",
    title: task.title,
    time: "Due",
    sort: "23:59",
    detail: `Task deadline · ${teamMember(task.owner).name}`
  }));
  const leave = state.leaveRequests.filter(request => request.status === "Approved" && isDateWithin(date, request.start, request.end)).map(request => ({
    kind: "leave",
    title: `${teamMember(request.person).name} · ${request.type}`,
    time: "Away",
    sort: "00:00",
    detail: `${request.type} · ${formatDate(request.start)}–${formatDate(request.end)}`
  }));
  const missions = state.missions.filter(mission => !["Cancelled", "Complete"].includes(mission.status) && isDateWithin(date, mission.start, mission.end)).map(mission => ({
    kind: "field",
    title: mission.title,
    time: "Field",
    sort: "07:30",
    detail: `${mission.status} · ${mission.location} · ${teamMember(mission.lead).name}`
  }));
  return [...leave, ...missions, ...events, ...deadlines].sort((a, b) => a.sort.localeCompare(b.sort));
}

function renderCalendar() {
  const year = calendarCursor.getUTCFullYear();
  const month = calendarCursor.getUTCMonth();
  document.getElementById("calendar-title").textContent = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(calendarCursor);
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, month, 1 - mondayOffset));
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart.getTime() + index * 86400000);
    const iso = date.toISOString().slice(0, 10);
    const items = calendarItemsForDate(iso);
    cells.push(`
      <div class="calendar-day ${date.getUTCMonth() !== month ? "outside" : ""} ${iso === TODAY ? "today" : ""}">
        <span class="calendar-day-number">${date.getUTCDate()}</span>
        <div class="day-items">${items.slice(0, 3).map(item => `<span class="calendar-item ${item.kind}" title="${escapeHtml(item.detail)}">${item.time !== "Due" ? `${escapeHtml(item.time)} ` : ""}${escapeHtml(item.title)}</span>`).join("")}${items.length > 3 ? `<span class="calendar-item">+${items.length - 3} more</span>` : ""}</div>
      </div>
    `);
  }
  document.getElementById("calendar-grid").innerHTML = `${weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join("")}${cells.join("")}`;

  const agenda = [];
  state.events.filter(event => event.date >= TODAY).forEach(event => agenda.push({
    date: event.date,
    time: event.start,
    title: event.title,
    detail: `${event.start}–${event.end} · ${event.type} · ${teamMember(event.owner).name}`
  }));
  activeTasks().filter(task => task.due >= TODAY).forEach(task => agenda.push({
    date: task.due,
    time: "23:59",
    title: task.title,
    detail: `Task deadline · ${teamMember(task.owner).name}`
  }));
  state.leaveRequests.filter(request => request.status === "Approved" && request.end >= TODAY).forEach(request => agenda.push({
    date: request.start < TODAY ? TODAY : request.start,
    time: "00:00",
    title: `${teamMember(request.person).name} on ${request.type.toLowerCase()}`,
    detail: `${formatDate(request.start)}–${formatDate(request.end)} · Handover recorded`
  }));
  state.missions.filter(mission => !["Cancelled", "Complete"].includes(mission.status) && mission.end >= TODAY).forEach(mission => agenda.push({
    date: mission.start < TODAY ? TODAY : mission.start,
    time: "07:30",
    title: mission.title,
    detail: `${mission.status} · ${mission.location} · ${teamMember(mission.lead).name}`
  }));
  agenda.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  document.getElementById("calendar-agenda").innerHTML = agenda.slice(0, 9).map(item => {
    const date = asDate(item.date);
    return `<div class="agenda-row"><div class="agenda-date">${new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date)}<strong>${date.getUTCDate()}</strong></div><div class="agenda-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div></div>`;
  }).join("") || `<div class="empty-state"><p>No upcoming events or deadlines.</p></div>`;
}

function renderMissions() {
  const active = state.missions.filter(mission => !["Complete", "Cancelled"].includes(mission.status));
  const ready = active.filter(missionCanDeploy);
  const nextSevenDays = active.filter(mission => daysUntil(mission.start) >= 0 && daysUntil(mission.start) <= 7);
  const missingGates = active.reduce((sum, mission) => sum + (5 - readinessCount(mission)), 0);
  renderMetricCards("mission-metric-grid", [
    { label: "Active missions", value: String(active.length), unit: "missions", note: `${nextSevenDays.length} start in the next 7 days`, icon: "⌖", tone: "#008fc8", tint: "#e6f7fe" },
    { label: "Ready to deploy", value: String(ready.length), unit: "missions", note: "Readiness complete and cleared", icon: "✓", tone: "#168a65", tint: "#e5f5ef" },
    { label: "Open readiness gates", value: String(missingGates), unit: "checks", note: "Resolve before mobilisation", icon: "!", tone: "#e99a24", tint: "#fff4df" },
    { label: "In field or processing", value: String(active.filter(mission => ["In field", "Processing"].includes(mission.status)).length), unit: "missions", note: "Delivery work underway", icon: "↗", tone: "#7357c8", tint: "#f0edfb" }
  ]);

  const gateLabels = { brief: "Brief", crew: "Crew", equipment: "Equipment", safety: "Safety", permit: "Permit" };
  const order = { "In field": 0, Ready: 1, Planning: 2, Processing: 3, Complete: 4, Cancelled: 5 };
  document.getElementById("mission-board").innerHTML = [...state.missions].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.start.localeCompare(b.start)).map(mission => {
    const project = projectById(mission.project);
    const lead = teamMember(mission.lead);
    const asset = assetById(mission.asset);
    const completed = readinessCount(mission);
    const assetOptions = `<option value="">Assign equipment</option>${state.assets.filter(item => item.category === "Aircraft").map(item => `<option value="${item.id}" ${item.id === mission.asset ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.status)}</option>`).join("")}`;
    return `<article class="surface mission-card">
      <div class="mission-card-head"><div><span class="mission-project">${escapeHtml(project?.name || "Unlinked mission")}</span><h3>${escapeHtml(mission.title)}</h3><p>${escapeHtml(project?.client || "CAGE")} · ${escapeHtml(mission.location)}</p></div><select class="mission-status-select ${statusClass(mission.status)}" data-mission-status="${mission.id}" aria-label="Status for ${escapeHtml(mission.title)}">${["Planning", "Ready", "In field", "Processing", "Complete", "Cancelled"].map(status => `<option ${status === mission.status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
      <div class="mission-facts"><span><small>Dates</small><strong>${formatDate(mission.start)}–${formatDate(mission.end)}</strong></span><span><small>Lead</small><strong>${escapeHtml(lead.name)}</strong></span><span><small>Equipment</small><select class="mission-asset-select" data-mission-asset="${mission.id}" aria-label="Equipment for ${escapeHtml(mission.title)}">${assetOptions}</select></span><span><small>Risk</small><strong class="risk-${mission.risk.toLowerCase()}">${escapeHtml(mission.risk)}</strong></span></div>
      <p class="mission-objective">${escapeHtml(mission.objective)}</p>
      <div class="readiness-head"><span>Deployment readiness</span><strong>${completed}/5</strong></div>
      <div class="readiness-track"><span style="width:${completed / 5 * 100}%"></span></div>
      <div class="readiness-gates">${Object.entries(gateLabels).map(([key, label]) => `<button class="readiness-gate ${mission.readiness?.[key] ? "complete" : ""}" data-mission-gate="${mission.id}" data-gate-key="${key}" aria-pressed="${Boolean(mission.readiness?.[key])}"><span>${mission.readiness?.[key] ? "✓" : "○"}</span>${label}</button>`).join("")}</div>
      <div class="mission-actions"><button data-project-detail="${mission.project}">Open project</button><button data-open-project-chat="${mission.project}">Work chat</button><button data-mission-calendar="${mission.id}">Open calendar</button></div>
    </article>`;
  }).join("") || `<div class="empty-state"><div>⌖</div><h3>No missions planned</h3><p>Create a field mission and complete its readiness gates.</p></div>`;

  const next = [...active].filter(mission => mission.end >= TODAY).sort((a, b) => a.start.localeCompare(b.start))[0];
  const readinessLabel = next ? !missionIsReady(next) ? `${5 - readinessCount(next)} checks open` : !missionHasClearance(next) ? "Clearance pending" : "Ready" : "";
  document.getElementById("mission-readiness-summary").innerHTML = next ? `<div class="next-mission-summary"><span class="status-pill ${missionCanDeploy(next) ? "done" : "attention"}">${readinessLabel}</span><h4>${escapeHtml(next.title)}</h4><p>${formatDate(next.start, { year: true })} · ${escapeHtml(next.location)}</p><div class="summary-list"><span><b>Lead</b>${escapeHtml(teamMember(next.lead).name)}</span><span><b>Aircraft</b>${escapeHtml(assetById(next.asset)?.name || "Not assigned")}</span><span><b>Risk</b>${escapeHtml(next.risk)}</span><span><b>Approval</b>${missionHasClearance(next) ? "Cleared" : "Pending"}</span></div><button class="full-width-button" data-project-detail="${next.project}">Open linked project</button></div>` : `<div class="empty-state"><p>No upcoming deployment.</p></div>`;
}

function renderAssets() {
  const query = document.getElementById("asset-search").value.trim().toLowerCase();
  const filtered = state.assets.filter(asset => {
    const matchesFilter = assetFilter === "all" || (assetFilter === "Maintenance" ? assetNeedsAttention(asset) : asset.category === assetFilter);
    const matchesSearch = !query || `${asset.name} ${asset.tag} ${asset.category} ${projectById(asset.project)?.name || ""}`.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }).sort((a, b) => Number(assetNeedsAttention(b)) - Number(assetNeedsAttention(a)) || a.name.localeCompare(b.name));
  renderMetricCards("asset-metric-grid", [
    { label: "Aircraft available", value: String(state.assets.filter(asset => asset.category === "Aircraft" && asset.status === "Available").length), unit: "aircraft", note: "Ready for allocation", icon: "◈", tone: "#168a65", tint: "#e5f5ef" },
    { label: "Assigned", value: String(state.assets.filter(asset => asset.status === "Assigned").length), unit: "items", note: "Linked to active projects", icon: "↗", tone: "#008fc8", tint: "#e6f7fe" },
    { label: "Needs attention", value: String(state.assets.filter(assetNeedsAttention).length), unit: "items", note: "Service, check or repair", icon: "!", tone: "#d64e4b", tint: "#feeceb" },
    { label: "Battery cycles", value: String(state.assets.filter(asset => asset.category === "Battery").reduce((sum, asset) => sum + Number(asset.usage || 0), 0)), unit: "cycles", note: "Across registered battery sets", icon: "≈", tone: "#7357c8", tint: "#f0edfb" }
  ]);
  const projectOptions = `<option value="">No project</option>${state.projects.map(project => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("")}`;
  document.getElementById("asset-grid").innerHTML = filtered.length ? filtered.map(asset => {
    const due = daysUntil(asset.nextService);
    const serviceLabel = !asset.nextService ? "Not scheduled" : due < 0 ? `${Math.abs(due)} days overdue` : due === 0 ? "Due today" : `In ${due} days`;
    return `<article class="asset-card ${assetNeedsAttention(asset) ? "attention" : ""}">
      <div class="asset-card-top"><span class="asset-glyph">${asset.category === "Aircraft" ? "DR" : asset.category === "Battery" ? "BT" : asset.category === "Survey equipment" ? "SV" : "EQ"}</span><div><span>${escapeHtml(asset.category)}</span><strong>${escapeHtml(asset.name)}</strong></div><span class="condition-pill ${statusClass(asset.condition)}">${escapeHtml(asset.condition)}</span></div>
      <div class="asset-tag">${escapeHtml(asset.tag)} · ${escapeHtml(asset.serial || "No serial")} · ${escapeHtml(asset.location || "No location")}${asset.returnDate ? ` · Return: ${escapeHtml(asset.returnDate)}` : ""}</div><div class="hr-row-actions"><button data-edit-equipment="${asset.id}">Edit details</button><button data-equipment-action="${asset.status === "Assigned" ? "return" : "checkout"}" data-equipment-id="${asset.id}">${asset.status === "Assigned" ? "Return equipment" : "Check out"}</button><button data-equipment-history="${asset.id}">History</button></div>
      <div class="asset-stats"><span><small>Use</small><strong>${escapeHtml(asset.usage)} ${escapeHtml(asset.unit || "uses")}</strong></span><span><small>Next check</small><strong class="${due <= 14 ? "warning-text" : ""}">${escapeHtml(serviceLabel)}</strong></span></div>
      <div class="asset-controls"><label><span>Status</span><select data-asset-status="${asset.id}">${["Available", "Assigned", "Maintenance"].map(status => `<option ${status === asset.status ? "selected" : ""}>${status}</option>`).join("")}</select></label><label><span>Project</span><select data-asset-project="${asset.id}">${projectOptions}</select></label></div>
      <div class="asset-footer"><span class="owner-chip"><span class="owner-avatar">${teamMember(asset.custodian).initials}</span>${escapeHtml(teamMember(asset.custodian).name)}</span>${asset.status === "Maintenance" ? `<button data-asset-ready="${asset.id}">Mark service complete</button>` : ""}</div>
    </article>`;
  }).join("") : `<div class="empty-state"><div>◈</div><h3>No matching equipment</h3><p>Clear the filters or add an equipment record.</p></div>`;
  filtered.forEach(asset => {
    const control = document.querySelector(`[data-asset-project="${asset.id}"]`);
    if (control) control.value = asset.project || "";
  });
}

function renderCompliance() {
  const records = [...state.compliance].sort((a, b) => a.renewal.localeCompare(b.renewal));
  const statuses = records.map(complianceDisplayStatus);
  document.getElementById("compliance-reminders").checked = state.settings.complianceReminders !== false;
  renderMetricCards("compliance-metric-grid", [
    { label: "Current", value: String(statuses.filter(status => status === "Active").length), unit: "records", note: "No action currently required", icon: "✓", tone: "#168a65", tint: "#e5f5ef" },
    { label: "Due within 30 days", value: String(statuses.filter(status => status === "Due soon").length), unit: "records", note: "Start renewal before expiry", icon: "□", tone: "#e99a24", tint: "#fff4df" },
    { label: "Review required", value: String(statuses.filter(status => status === "Review required").length), unit: "records", note: "Owner action is pending", icon: "!", tone: "#7357c8", tint: "#f0edfb" },
    { label: "Expired", value: String(statuses.filter(status => status === "Expired").length), unit: "records", note: "Do not deploy against expired records", icon: "×", tone: "#d64e4b", tint: "#feeceb" }
  ]);
  document.getElementById("compliance-list").innerHTML = records.map(record => {
    const display = complianceDisplayStatus(record);
    return `<tr><td><strong>${escapeHtml(record.title)}</strong><br><span class="project-client">${escapeHtml(record.category)} · ${escapeHtml(record.note || "No additional conditions")}</span></td><td><span class="owner-chip"><span class="owner-avatar">${teamMember(record.owner).initials}</span>${escapeHtml(teamMember(record.owner).name)}</span></td><td><span class="due-date ${display === "Expired" ? "overdue" : ""}">${formatDate(record.renewal, { year: true })}</span></td><td><button class="reference-button" data-open-compliance="${record.id}">⌁ ${escapeHtml(record.document)}</button></td><td><select class="compliance-status-select ${statusClass(display)}" data-compliance-status="${record.id}">${["Active", "Review required", "Renewal submitted", "Expired"].map(status => `<option ${status === record.status ? "selected" : ""}>${status}</option>`).join("")}</select></td></tr>`;
  }).join("");
  const alerts = records.filter(record => complianceDisplayStatus(record) !== "Active" || daysUntil(record.renewal) <= 45);
  document.getElementById("compliance-alert-list").innerHTML = alerts.length ? alerts.map(record => { const display = complianceDisplayStatus(record); const days = daysUntil(record.renewal); return `<div class="compliance-alert"><span class="alert-icon ${statusClass(display)}">${display === "Expired" ? "×" : "!"}</span><div><strong>${escapeHtml(record.title)}</strong><span>${days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today" : `${days} days remaining`} · ${escapeHtml(teamMember(record.owner).name)}</span></div>${record.status !== "Renewal submitted" ? `<button data-submit-renewal="${record.id}">Mark submitted</button>` : ""}</div>`; }).join("") : `<div class="empty-state"><p>No renewals require action.</p></div>`;
}

function renderApprovals() {
  const pending = state.approvals.filter(item => item.status === "Pending");
  const overdue = pending.filter(item => item.due < TODAY);
  const amount = pending.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  renderMetricCards("approval-metric-grid", [
    { label: "Awaiting decision", value: String(pending.length), unit: "requests", note: `${pending.filter(item => item.due <= TODAY).length} due now`, icon: "✓", tone: "#e99a24", tint: "#fff4df" },
    { label: "Overdue decisions", value: String(overdue.length), unit: "requests", note: "Escalate before work is delayed", icon: "!", tone: "#d64e4b", tint: "#feeceb" },
    { label: "Value awaiting approval", value: formatMoney(amount, true), unit: "", note: "Purchase and commercial requests", icon: "¤", tone: "#008fc8", tint: "#e6f7fe" },
    { label: "Approved", value: String(state.approvals.filter(item => item.status === "Approved").length), unit: "requests", note: "Decision history retained", icon: "✓", tone: "#168a65", tint: "#e5f5ef" }
  ]);
  const order = { Pending: 0, Returned: 1, Approved: 2 };
  document.getElementById("approval-list").innerHTML = [...state.approvals].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.due.localeCompare(b.due)).map(item => `<article class="surface approval-card ${statusClass(item.status)}"><div class="approval-type">${escapeHtml(item.type)}</div><div class="approval-main"><div class="approval-title-row"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div><span class="status-pill ${item.status === "Approved" ? "done" : item.status === "Returned" ? "blocked" : "attention"}">${escapeHtml(item.status)}</span></div><div class="approval-meta"><span><b>Requested by</b>${escapeHtml(teamMember(item.requester).name)}</span><span><b>Submitted</b>${formatDate(item.submitted)}</span><span><b>Decision by</b>${formatDate(item.due)}</span>${item.amount ? `<span><b>Value</b>${formatMoney(item.amount)}</span>` : ""}</div>${item.decisionNote ? `<div class="decision-note">${escapeHtml(item.decisionNote)}</div>` : ""}</div>${item.status === "Pending" ? `<div class="approval-actions"><button class="return-button" data-decide-approval="${item.id}" data-decision="Returned">Return</button><button class="approve-button" data-decide-approval="${item.id}" data-decision="Approved">Approve</button></div>` : ""}</article>`).join("");
  const rules = [
    ["Requests", "Qualification, scope and costing must be complete before internal review."],
    ["Field missions", "Five readiness gates and an approved clearance are required before deployment."],
    ["Purchases", "Management approval is required before supplier commitment."],
    ["Quotes & submissions", "Internal review comes before client release."],
    ["Contracts & awards", "Formal acceptance is required before a delivery project is created."],
    ["Leave", "Every approval must include a named handover plan."]
  ];
  document.getElementById("approval-rule-list").innerHTML = rules.map(([title, detail]) => `<div class="rule-row"><span>✓</span><div><strong>${title}</strong><p>${detail}</p></div></div>`).join("");
}

function formatMonitorTime(value) {
  if (!value) return "Not run yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Blantyre", timeZoneName: "short" }).format(date);
}

function renderOpportunityMonitor() {
  const monitor = state.opportunityMonitor;
  const matches = [...state.opportunityMatches].sort((a, b) => b.match - a.match);
  document.getElementById("opportunity-alerts").checked = monitor.enabled !== false;
  document.getElementById("opportunity-auto-intake").checked = monitor.autoIntake === true;
  document.getElementById("opportunity-monitor-status").innerHTML = `
    <span class="monitor-live-dot ${monitor.enabled === false ? "paused" : ""}"></span>
    <div><strong>${monitor.enabled === false ? "Weekday checking paused" : "Weekday check scheduled"}</strong><small>Last: ${escapeHtml(formatMonitorTime(monitor.lastScan))}<br>Next: ${escapeHtml(formatMonitorTime(monitor.nextScan))}</small></div>
    <b>${matches.filter(item => item.status === "New").length} new</b>`;
  document.getElementById("opportunity-source-list").innerHTML = `${monitor.sources.map(source => `<span>${escapeHtml(source)}</span>`).join("")}
    <details class="monitor-source-details"><summary>View all ${monitor.coverage.length} named source platforms</summary><div>${monitor.coverage.map(source => `<span>${escapeHtml(source)}</span>`).join("")}</div></details>`;
  const deadlineLabel = match => match.deadline === "Rolling" ? "Rolling" : formatDate(match.deadline, { year: true });
  document.getElementById("opportunity-match-list").innerHTML = matches.length ? `
    <div class="opportunity-table-wrap"><table class="opportunity-table"><thead><tr><th>Opportunity Title</th><th>Organization / Client</th><th>Source / Platform</th><th>Estimated Value / Budget</th><th>Deadline</th><th>Direct URL</th><th>Qualification Match Score</th></tr></thead><tbody>${matches.map(match => `
      <tr class="${match.status === "Added" ? "added" : ""}">
        <td><strong>${escapeHtml(match.title)}</strong><small>${escapeHtml(match.reason)}</small><button class="opportunity-intake-action" ${match.request ? `data-open-match-request="${match.id}"` : `data-add-match-request="${match.id}"`}>${match.request ? "Open linked request" : "Send to Request centre"}</button></td>
        <td>${escapeHtml(match.organisation)}</td>
        <td>${escapeHtml(match.platform || match.source)}</td>
        <td>${escapeHtml(match.estimatedValue || "Not published")}</td>
        <td><strong>${escapeHtml(deadlineLabel(match))}</strong></td>
        <td>${match.url ? `<a href="${escapeHtml(match.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : `<span class="muted">Source link unavailable</span>`}</td>
        <td><span class="match-level ${String(match.matchLevel || (match.match >= 80 ? "High" : match.match >= 65 ? "Medium" : "Low")).toLowerCase()}">${escapeHtml(match.matchLevel || (match.match >= 80 ? "High" : match.match >= 65 ? "Medium" : "Low"))}</span><small>${Number(match.match || 0)}% fit</small></td>
      </tr>`).join("")}</tbody></table></div>
    <section class="opportunity-top-summary"><div class="opportunity-match-head"><div><strong>Top 3 match notes</strong><span>Why CAGE fits and what must be ready</span></div></div>${matches.slice(0, 3).map((match, index) => `<article><h4>${index + 1}. ${escapeHtml(match.title)}</h4><ul><li>${escapeHtml(match.reason)}</li><li>${escapeHtml((match.requirements || ["Verify the official notice, eligibility and submission documents before proceeding."])[0])}${match.requirements?.[1] ? ` ${escapeHtml(match.requirements[1])}` : ""}</li></ul></article>`).join("")}</section>`
    : `<div class="empty-state"><div>⌕</div><h3>No verified open matches</h3><p>Run a live scan or review the configured sources.</p></div>`;
}

function createRequestFromMatch(matchId, silent = false) {
  const match = state.opportunityMatches.find(item => item.id === matchId);
  if (!match) return null;
  if (match.request) return requestById(match.request);
  const request = {
    id: `rq-${Date.now()}-${match.id}`,
    number: nextRequestNumber(),
    title: match.title.replace(/^Sample:\s*/i, ""),
    organisation: match.organisation,
    contact: "Opportunity monitoring team",
    contactDetail: match.source,
    type: match.type,
    source: "AI opportunity monitor",
    owner: "alexander",
    priority: match.match >= 90 ? "High" : "Normal",
    location: "Malawi / Africa",
    received: TODAY,
    deadline: match.deadline === "Rolling" ? dateAfter(30) : match.deadline,
    deliveryDeadline: "",
    value: 0,
    stage: "New",
    summary: match.reason,
    attachments: match.url || `${match.source} · source link to be verified before qualification`,
    nextAction: "Verify the source, full guidelines, eligibility and deadline before the go / no-go decision.",
    checklist: Object.fromEntries(requestTemplate(match.type).map(item => [item.key, false]))
  };
  state.requests.push(request);
  addSystemWorkMessage(request.id, `${request.number} opened from ${request.source}. ${teamMember(request.owner).name} is responsible for the next action.`);
  match.request = request.id;
  match.status = "Added";
  saveState();
  if (!silent) {
    renderAll();
    setView("requests");
    openRequest(request.id);
    showToast(`${request.number} created from the AI opportunity monitor.`);
  }
  return request;
}

function nextWeekdayScan(from = new Date()) {
  const candidate = new Date(from);
  candidate.setUTCHours(5, 0, 0, 0);
  if (candidate <= from) candidate.setUTCDate(candidate.getUTCDate() + 1);
  while ([0, 6].includes(candidate.getUTCDay())) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate.toISOString();
}

async function runOpportunityScan() {
  const now = new Date();
  const button = document.getElementById("run-opportunity-scan");
  const previousLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Searching live sources…";
  let scannedCount = 0;
  state.opportunityMatches = state.opportunityMatches.filter(item => {
    if (item.request || item.deadline === "Rolling" || !item.deadline) return true;
    const deadline = new Date(`${item.deadline}T23:59:59Z`).getTime();
    return Number.isFinite(deadline) && deadline > now.getTime() + 48 * 60 * 60 * 1000;
  });
  try {
    const result = await window.CAGE_BACKEND?.scanOpportunities?.();
    if (Array.isArray(result?.opportunities) && result.opportunities.length) {
      const existingByUrl = new Map(state.opportunityMatches.map(item => [item.url, item]));
      result.opportunities.forEach(item => {
        const normalized = {
          id: item.id || `scan-${Date.now()}-${scannedCount}`,
          title: item.title,
          organisation: item.organisation || "Organisation to verify",
          type: item.type || "Grant",
          source: item.source || item.platform || "Live source",
          platform: item.platform || item.source || "Live web",
          estimatedValue: item.estimatedValue || "Not published",
          deadline: item.deadline || "Rolling",
          url: item.url,
          match: Number(item.match || 0),
          matchLevel: item.matchLevel || (Number(item.match || 0) >= 80 ? "High" : Number(item.match || 0) >= 65 ? "Medium" : "Low"),
          reason: item.reason || "Matched CAGE capability and geography criteria.",
          requirements: item.requirements || [],
          status: "New",
          verifiedAt: TODAY
        };
        const previous = existingByUrl.get(normalized.url);
        if (previous) Object.assign(previous, normalized, { request: previous.request, status: previous.status });
        else state.opportunityMatches.push(normalized);
        scannedCount += 1;
      });
    }
  } catch (error) {
    showToast(error.message || "The live scan could not be completed.");
  }
  state.opportunityMonitor.lastScan = now.toISOString();
  state.opportunityMonitor.nextScan = nextWeekdayScan(now);
  state.opportunityMatches.forEach(match => { if (!match.request && match.match >= 80) match.status = "New"; });
  let created = 0;
  if (state.opportunityMonitor.autoIntake) {
    state.opportunityMatches.filter(match => !match.request && match.match >= 80).forEach(match => { createRequestFromMatch(match.id, true); created += 1; });
  }
  saveState();
  renderAll();
  button.disabled = false;
  button.textContent = previousLabel;
  showToast(created ? `${created} strong matches added to Request centre.` : scannedCount ? `${scannedCount} verified live matches refreshed.` : "Scan finished. No new verified matches were added.");
}

function renderCommercial() {
  renderOpportunityMonitor();
  const query = document.getElementById("commercial-search").value.trim().toLowerCase();
  const records = state.commercialRecords.filter(record => {
    const matchesFilter = commercialFilter === "all" || (commercialFilter === "attention" ? commercialNeedsAttention(record) : record.type === commercialFilter);
    const matchesSearch = !query || `${record.title} ${record.organisation} ${record.type} ${record.nextAction}`.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }).sort((a, b) => Number(commercialNeedsAttention(b)) - Number(commercialNeedsAttention(a)) || a.deadline.localeCompare(b.deadline));
  const active = state.commercialRecords.filter(record => !["Closed", "Awarded"].includes(record.stage));
  renderMetricCards("commercial-metric-grid", [
    { label: "Active records", value: String(active.length), unit: "records", note: "Tenders, grants and contracts", icon: "▣", tone: "#008fc8", tint: "#e6f7fe" },
    { label: "Due within 14 days", value: String(active.filter(record => daysUntil(record.deadline) >= 0 && daysUntil(record.deadline) <= 14).length), unit: "records", note: "Submission or renewal deadline", icon: "!", tone: "#d64e4b", tint: "#feeceb" },
    { label: "Recorded value", value: formatMoney(active.reduce((sum, record) => sum + Number(record.value || 0), 0), true), unit: "", note: "Across active opportunities", icon: "¤", tone: "#7357c8", tint: "#f0edfb" },
    { label: "In review or submitted", value: String(active.filter(record => ["Internal review", "Submitted"].includes(record.stage)).length), unit: "records", note: "Close to external decision", icon: "↗", tone: "#168a65", tint: "#e5f5ef" }
  ]);
  document.getElementById("commercial-grid").innerHTML = records.length ? records.map(record => {
    const due = daysUntil(record.deadline);
    const pendingReview = state.approvals.some(item => item.status === "Pending" && ((item.linkedType === "commercial" && item.linkedId === record.id) || (record.request && item.linkedType === "request" && item.linkedId === record.request)));
    return `<article class="commercial-card ${commercialNeedsAttention(record) ? "attention" : ""}"><div class="commercial-card-head"><span class="commercial-type ${record.type.toLowerCase()}">${escapeHtml(record.type)}</span><span class="deadline-chip ${due < 0 ? "overdue" : due <= 14 ? "soon" : ""}">${due < 0 ? `${Math.abs(due)}d overdue` : `${due}d left`}</span></div><h3>${escapeHtml(record.title)}</h3><p class="commercial-org">${escapeHtml(record.organisation)}</p><div class="commercial-progress-head"><span>Completion</span><strong>${record.progress}%</strong></div><div class="progress-track commercial-progress"><span style="width:${record.progress}%"></span></div><div class="commercial-facts"><span><small>Owner</small><strong>${escapeHtml(teamMember(record.owner).name)}</strong></span><span><small>Deadline</small><strong>${formatDate(record.deadline, { year: true })}</strong></span><span><small>Value</small><strong>${record.value ? formatMoney(record.value, true) : "Not recorded"}</strong></span></div><div class="commercial-next"><span>Next action</span><p>${escapeHtml(record.nextAction)}</p></div><div class="commercial-controls"><select data-commercial-stage="${record.id}">${["Monitoring", "Preparing", "Internal review", "Submitted", "Negotiation", "Active", "Awarded", "Closed"].map(stage => `<option ${stage === record.stage ? "selected" : ""}>${stage}</option>`).join("")}</select><label><span>Progress</span><input data-commercial-progress="${record.id}" type="number" min="0" max="100" value="${record.progress}"></label><button data-open-work-chat="commercial" data-work-chat-id="${record.id}">Work chat</button>${record.request ? `<button data-commercial-request="${record.request}">Open request</button>` : ""}${pendingReview ? `<span class="review-requested">Review requested</span>` : `<button data-commercial-review="${record.id}">Request review</button>`}</div></article>`;
  }).join("") : `<div class="empty-state"><div>▣</div><h3>No matching records</h3><p>Clear the filters or add a tender, grant or contract.</p></div>`;
}

function renderFinance() {
  const openInvoices = state.invoices.filter(invoice => !["Paid", "Draft"].includes(effectiveInvoiceStatus(invoice)));
  const overdueInvoices = state.invoices.filter(invoice => effectiveInvoiceStatus(invoice) === "Overdue");
  const paidInvoices = state.invoices.filter(invoice => effectiveInvoiceStatus(invoice) === "Paid");
  const expensesThisMonth = state.expenses.filter(expense => expense.date.startsWith(TODAY.slice(0,7)));
  renderMetricCards("finance-metric-grid", [
    { label: "Outstanding", value: formatMoney(openInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amount - Number(invoice.paidAmount || 0)), 0), true), unit: "", note: `${openInvoices.length} invoices awaiting payment`, icon: "¤", tone: "#008fc8", tint: "#e6f7fe" },
    { label: "Overdue", value: formatMoney(overdueInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amount - Number(invoice.paidAmount || 0)), 0), true), unit: "", note: `${overdueInvoices.length} invoices need follow-up`, icon: "!", tone: "#d64e4b", tint: "#feeceb" },
    { label: "Paid invoices", value: formatMoney(paidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0), true), unit: "", note: "Fully paid invoice value", icon: "✓", tone: "#168a65", tint: "#e5f5ef" },
    { label: new Date().toLocaleDateString("en-GB",{month:"long"}) + " costs", value: formatMoney(expensesThisMonth.reduce((sum, expense) => sum + expense.amount, 0), true), unit: "", note: `${expensesThisMonth.length} expenses recorded`, icon: "−", tone: "#e99a24", tint: "#fff4df" }
  ]);
  document.getElementById("auto-reminders").checked = state.settings.autoReminders !== false;

  document.getElementById("finance-quote-list").innerHTML = [...state.quotes].sort((a, b) => b.issued.localeCompare(a.issued)).map(quote => `
    <tr>
      <td><strong>${escapeHtml(quote.number)}</strong><br><span class="project-client">${escapeHtml(quote.description)}</span></td>
      <td>${escapeHtml(quote.client)}<br><span class="project-client">${escapeHtml(dealById(quote.deal)?.name || "Direct quote")}</span></td>
      <td>${formatDate(quote.validUntil)}</td>
      <td class="money-cell">${formatMoney(quote.amount)}</td>
      <td><span class="status-pill ${quote.status === "Sent" ? "doing" : quote.status === "Approved" ? "done" : "to-do"}">${escapeHtml(quote.status)}</span></td>
      <td><button class="document-action" data-send-document="quote" data-document-id="${quote.id}" ${quote.status === "Draft" ? "disabled title=\"Approval is required before sending\"" : ""}>${quote.status === "Draft" ? "Approval pending" : quote.sentAt ? "Resend" : "Send"}</button>${quote.sentAt ? `<div class="document-sent">Sent ${formatDate(quote.sentAt.slice(0, 10))}</div>` : ""}</td>
    </tr>
  `).join("") || `<tr><td colspan="6"><div class="empty-state"><p>No quotes yet.</p></div></td></tr>`;

  const invoices = state.invoices.filter(invoice => {
    const status = effectiveInvoiceStatus(invoice);
    if (financeFilter === "open") return !["Paid", "Draft"].includes(status);
    if (financeFilter === "overdue") return status === "Overdue";
    if (financeFilter === "paid") return status === "Paid";
    return true;
  }).sort((a, b) => a.due.localeCompare(b.due));
  document.getElementById("finance-invoice-list").innerHTML = invoices.map(invoice => {
    const effective = effectiveInvoiceStatus(invoice);
    return `<tr><td><strong>${escapeHtml(invoice.number)}</strong><br><span class="project-client">${escapeHtml(invoice.description)}</span></td><td>${escapeHtml(invoice.client)}<br><span class="project-client">${escapeHtml(projectById(invoice.project)?.name || "Unlinked")}</span></td><td><span class="due-date ${effective === "Overdue" ? "overdue" : ""}">${formatDate(invoice.due)}</span></td><td class="money-cell">${formatMoney(invoice.amount)}</td><td><select class="invoice-status-select ${statusClass(effective)}" data-invoice-status="${invoice.id}" aria-label="Status for ${escapeHtml(invoice.number)}">${["Draft", "Sent", "Overdue", "Paid"].map(option => `<option ${option === effective ? "selected" : ""}>${option}</option>`).join("")}</select></td><td><button class="document-action" data-send-document="invoice" data-document-id="${invoice.id}">${invoice.sentAt ? "Resend" : "Send"}</button>${invoice.sentAt ? `<div class="document-sent">Sent ${formatDate(invoice.sentAt.slice(0, 10))}</div>` : ""}</td></tr>`;
  }).join("") || `<tr><td colspan="6"><div class="empty-state"><p>No invoices match this filter.</p></div></td></tr>`;

  const projectFigures = state.projects.map(project => {
    const revenue = state.invoices.filter(invoice => invoice.project === project.id).reduce((sum, invoice) => sum + invoice.amount, 0);
    const costs = state.expenses.filter(expense => expense.project === project.id).reduce((sum, expense) => sum + expense.amount, 0);
    return { project, revenue, costs, net: revenue - costs };
  }).filter(item => item.revenue || item.costs).sort((a, b) => b.revenue - a.revenue);
  document.getElementById("project-profitability").innerHTML = `<div class="profit-list">${projectFigures.map(item => {
    const total = Math.max(1, item.revenue + item.costs);
    return `<div class="profit-row"><div class="profit-row-head"><strong>${escapeHtml(item.project.name)}</strong><span class="${item.net < 0 ? "negative" : ""}">${formatMoney(item.net, true)}</span></div><div class="profit-row-meta"><span>Revenue ${formatMoney(item.revenue, true)}</span><span>Costs ${formatMoney(item.costs, true)}</span></div><div class="profit-bar"><span style="width:${item.revenue / total * 100}%"></span><span style="width:${item.costs / total * 100}%"></span></div></div>`;
  }).join("")}</div>`;

  document.getElementById("expense-list").innerHTML = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map(expense => `<div class="expense-row"><span class="expense-icon">−</span><span class="expense-main"><strong>${escapeHtml(expense.description)}</strong><span>${expense.receiptPath ? `<button type="button" data-open-receipt="${expense.id}">Open receipt</button>` : escapeHtml(expense.receipt || "No receipt attached")}</span></span><span>${escapeHtml(projectById(expense.project)?.name || "Unlinked")}</span><span>${escapeHtml(expense.category)} · ${formatDate(expense.date)}</span><strong class="money-cell">${formatMoney(expense.amount)}</strong></div>`).join("");
}

function threadIdForMessage(message) {
  if (message.thread) return message.thread;
  const project = projectById(message.project);
  return project?.request || (project ? `project:${project.id}` : "");
}

function workThreads() {
  const currentMember = window.CAGE_BACKEND?.currentMemberId?.() || "alexander";
  const privateThreads = (state.chatGroups || []).filter(group => Array.isArray(group.members) && group.members.includes(currentMember)).map(group => {
    const direct = group.type === "direct";
    const other = direct ? teamMember(group.members.find(id => id !== currentMember)) : null;
    return {
      id: group.id,
      title: direct ? other.name : group.name,
      organisation: direct ? "Private conversation" : `${group.members.length} members`,
      owner: group.createdBy,
      type: direct ? "Direct message" : "Staff group",
      stage: direct ? "Private" : "Group",
      category: direct ? "direct" : "group",
      memberIds: group.members,
      customChat: true,
      direct
    };
  });
  const threads = [...privateThreads, {
    id: GENERAL_CHAT_THREAD_ID,
    title: "General Enquiries",
    organisation: "All CAGE team",
    owner: "cage-team",
    type: "Team group",
    stage: "Always open",
    category: "team",
    teamWide: true,
    pinned: true
  }, ...state.requests.map(request => {
    const project = projectById(request.project) || state.projects.find(item => item.request === request.id);
    const commercial = state.commercialRecords.find(item => item.id === request.commercial || item.request === request.id);
    const deal = dealById(request.deal) || state.deals.find(item => item.id === request.deal);
    const category = project ? "delivery" : (["Tender / RFQ", "Grant"].includes(request.type) || commercial ? "commercial" : "intake");
    return { id: request.id, title: request.title, organisation: request.organisation, owner: request.owner, type: request.type, stage: request.stage, category, request, project, commercial, deal };
  })];
  state.deals.filter(deal => !state.requests.some(request => request.deal === deal.id)).forEach(deal => {
    const project = projectById(deal.project);
    threads.push({ id: `deal:${deal.id}`, title: deal.name, organisation: deal.company, owner: deal.owner, type: "Proactive opportunity", stage: project ? `${projectProgress(project.id)}% delivered` : deal.stage, category: project ? "delivery" : "intake", deal, project });
  });
  state.projects.filter(project => !project.request && !state.requests.some(request => request.project === project.id) && !state.deals.some(deal => deal.project === project.id)).forEach(project => threads.push({ id: `project:${project.id}`, title: project.name, organisation: project.client, owner: project.owner, type: project.category, stage: `${projectProgress(project.id)}% delivered`, category: "delivery", project }));
  state.commercialRecords.filter(record => !record.request && !state.requests.some(request => request.commercial === record.id)).forEach(record => threads.push({ id: `commercial:${record.id}`, title: record.title, organisation: record.organisation, owner: record.owner, type: record.type, stage: record.stage, category: "commercial", commercial: record }));
  return threads;
}

function threadById(id) {
  return workThreads().find(thread => thread.id === id);
}

function messagesForThread(threadId) {
  return state.messages.filter(message => threadIdForMessage(message) === threadId).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

function threadMemberIds(thread) {
  if (Array.isArray(thread?.memberIds)) return [...new Set(thread.memberIds)];
  if (thread?.teamWide) return assignableTeam().map(member => member.id);
  if (thread?.project?.team?.length) return [...new Set(thread.project.team)];
  return thread?.owner ? [thread.owner] : [];
}

function threadLifecycle(thread) {
  const request = thread.request;
  const requestOrder = ["New", "Needs information", "Qualified", "Scoping", "Internal review", "Approved to send", "Submitted", "Negotiation", "Won / Awarded", "Converted"];
  const requestIndex = request ? requestOrder.indexOf(request.stage) : -1;
  const steps = [
    { label: "Intake", done: Boolean(request), active: requestIndex <= 1 && !thread.project, view: "requests" },
    { label: "Qualified", done: requestIndex >= 2, active: requestIndex === 2, view: "requests" },
    { label: ["Tender / RFQ", "Grant"].includes(thread.type) ? "Application" : "Offer", done: requestIndex >= 5, active: requestIndex >= 3 && requestIndex <= 5, view: thread.commercial ? "commercial" : "requests" },
    { label: "Award / contract", done: requestIndex >= 8 || Boolean(thread.project), active: requestIndex >= 6 && requestIndex <= 8, view: thread.commercial ? "commercial" : "requests" },
    { label: "Delivery", done: Boolean(thread.project) && projectProgress(thread.project.id) === 100, active: Boolean(thread.project) && projectProgress(thread.project.id) < 100, view: "projects" },
    { label: "Closed", done: Boolean(thread.project) && projectProgress(thread.project.id) === 100, active: false, view: thread.project ? "projects" : "requests" }
  ];
  return steps;
}

function renderChat() {
  const allThreads = workThreads();
  if (!threadById(activeChatThread)) activeChatThread = allThreads[0]?.id || "";
  const query = document.getElementById("chat-search").value.trim().toLowerCase();
  const threads = allThreads.filter(thread => {
    const messages = messagesForThread(thread.id);
    const matchesFilter = chatFilter === "all" || thread.category === chatFilter || (chatFilter === "work" && !["direct", "group", "team"].includes(thread.category));
    const matchesSearch = !query || `${thread.title} ${thread.organisation} ${thread.type} ${messages.map(message => message.text).join(" ")}`.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const lastA = messagesForThread(a.id).at(-1);
    const lastB = messagesForThread(b.id).at(-1);
    return `${lastB?.date || ""}${lastB?.time || ""}`.localeCompare(`${lastA?.date || ""}${lastA?.time || ""}`);
  });
  document.getElementById("chat-channel-list").innerHTML = threads.length ? threads.map(thread => {
    const messages = messagesForThread(thread.id);
    const last = messages.at(-1);
    const currentMember = window.CAGE_BACKEND?.currentMemberId?.() || "alexander";
    const unread = window.CAGE_PERSONAL?.chatUnread?.(thread.id) || messages.filter(message => message.unread && message.sender !== currentMember).length;
    const glyph = thread.direct ? "DM" : thread.customChat ? "GP" : thread.teamWide ? "GE" : thread.type === "Grant" ? "GR" : thread.type === "Tender / RFQ" ? "TD" : thread.project ? "PR" : "RQ";
    return `<button class="chat-channel ${thread.id === activeChatThread ? "active" : ""}" data-chat-thread="${thread.id}"><span class="chat-channel-icon ${thread.category}">${glyph}</span><span class="chat-channel-copy"><strong>${escapeHtml(thread.title)}</strong><em>${escapeHtml(thread.stage)} · ${escapeHtml(thread.organisation)}</em><span>${escapeHtml(last?.text || "Start the work conversation")}</span></span>${unread ? `<span class="unread-count">${unread}</span>` : ""}</button>`;
  }).join("") : `<div class="chat-list-empty">No conversations match this view.</div>`;

  const thread = threadById(activeChatThread);
  if (!thread) return;
  const memberIds = threadMemberIds(thread);
  const members = [...new Set(memberIds)].map(id => teamMember(id));
  const glyph = thread.direct ? "DM" : thread.customChat ? "GP" : thread.teamWide ? "GE" : thread.type === "Grant" ? "GR" : thread.type === "Tender / RFQ" ? "TD" : thread.project ? "PR" : "RQ";
  const headerDetail = thread.teamWide
    ? `${thread.type} · ${members.length} team accounts`
    : thread.customChat ? `${thread.type} · ${thread.organisation}`
    : `${thread.type} · ${thread.organisation} · Owner: ${teamMember(thread.owner).name}`;
  const openRecordButton = thread.teamWide || thread.customChat ? "" : `<button data-thread-open-view="${thread.request ? "requests" : thread.project ? "projects" : "commercial"}">Open record</button>`;
  const extraMembers = members.length > 5 ? `<span class="chat-member-more" title="${members.slice(5).map(member => escapeHtml(member.name)).join(", ")}">+${members.length - 5}</span>` : "";
  document.getElementById("chat-header").innerHTML = `<div class="chat-header-main"><span class="chat-channel-icon ${thread.category}">${glyph}</span><span><strong>${escapeHtml(thread.title)}</strong><span>${escapeHtml(headerDetail)}</span></span></div><div class="chat-header-actions">${openRecordButton}<div class="chat-header-members">${members.slice(0, 5).map(member => `<span class="owner-avatar" title="${escapeHtml(member.name)}">${member.initials}</span>`).join("")}${extraMembers}</div></div>`;
  const messages = messagesForThread(thread.id);
  const decisions = messages.filter(message => message.type === "Decision" || message.pinned).length;
  const files = messages.filter(message => message.attachment).length;
  if (thread.customChat) {
    document.getElementById("chat-context").innerHTML = `<div class="private-chat-purpose"><span class="team-chat-purpose-icon">${thread.direct ? "↔" : "◎"}</span><span><strong>${thread.direct ? "Private staff conversation" : "Private staff group"}</strong><small>Only ${members.length === 2 ? "the two people in this conversation" : "the selected group members"} can open or search these messages.</small></span></div><div class="chat-context-meta"><span><small>Members</small><strong>${members.map(member => escapeHtml(member.name.split(" ")[0])).join(", ")}</strong></span><span><small>Captured</small><strong>${decisions} decisions · ${files} files</strong></span></div>`;
  } else if (thread.teamWide) {
    document.getElementById("chat-context").innerHTML = `<div class="team-chat-purpose"><span class="team-chat-purpose-icon">◎</span><span><strong>Shared company conversation</strong><small>Use this group for routine enquiries, quick coordination and questions that do not belong to a specific project, contract, grant or tender.</small></span></div><div class="chat-context-meta team-chat-meta"><span><small>Access</small><strong>All active team members</strong></span><span><small>When work becomes specific</small><strong>Continue it in the relevant request or project chat</strong></span><span><small>Captured</small><strong>${decisions} decisions · ${files} files</strong></span></div>`;
  } else {
    const lifecycle = threadLifecycle(thread);
    document.getElementById("chat-context").innerHTML = `<div class="chat-lifecycle">${lifecycle.map((step, index) => `<button class="${step.done ? "done" : ""} ${step.active ? "active" : ""}" data-thread-open-view="${step.view}"><span>${step.done ? "✓" : index + 1}</span><small>${escapeHtml(step.label)}</small></button>`).join("")}</div><div class="chat-context-meta"><span><small>Current stage</small><strong>${escapeHtml(thread.stage)}</strong></span><span><small>Next action</small><strong>${escapeHtml(thread.request?.nextAction || thread.commercial?.nextAction || thread.project?.outcome || "Agree the next action in chat")}</strong></span><span><small>Captured</small><strong>${decisions} decisions · ${files} files</strong></span></div>`;
  }
  document.getElementById("chat-input").placeholder = thread.direct ? `Message ${thread.title}…` : thread.customChat ? `Message ${thread.title}…` : thread.teamWide ? "Write a routine enquiry or team question…" : "Write an update, decision or question…";
  const mentionButton = document.getElementById("chat-mention");
  mentionButton.disabled = state.settings.mentionSuggestions === false;
  mentionButton.title = mentionButton.disabled ? "Staff mention suggestions are disabled in Settings" : "Mention a colleague";
  let lastDate = "";
  document.getElementById("chat-messages").innerHTML = messages.length ? messages.map(message => {
    const sender = teamMember(message.sender);
    const day = message.date !== lastDate ? `<div class="message-day">${formatDate(message.date, { year: true })}</div>` : "";
    lastDate = message.date;
    if (message.type === "System") return `${day}<div class="message-system"><span>↻</span>${escapeHtml(message.text)}<small>${escapeHtml(message.time)}</small></div>`;
    const type = message.type || "Update";
    const currentMember = window.CAGE_BACKEND?.currentMemberId?.() || "alexander";
    return `${day}<div class="message-row ${message.sender === currentMember ? "mine" : ""} ${type === "Decision" ? "decision" : ""}">${message.sender !== currentMember ? `<span class="owner-avatar">${sender.initials}</span>` : ""}<div class="message-bubble"><div class="message-bubble-head"><span class="message-author">${escapeHtml(sender.name)}</span><span class="message-type ${type.toLowerCase().replaceAll(" ", "-")}">${escapeHtml(type)}</span></div><p>${escapeHtml(message.text)}</p>${message.audio ? `<button type="button" class="message-attachment" data-play-voice="${message.id}">▶ Voice message · ${Math.ceil(message.audioDuration || 0)}s</button><div data-voice-player="${message.id}"></div>` : message.attachment ? `<button class="message-attachment" data-preview-chat-file="${message.id}">⌁ ${escapeHtml(message.attachment)}</button>` : ""}<span class="message-meta">${escapeHtml(message.time)} ${message.pinned ? "· Pinned decision" : ""} ${message.sender === currentMember ? "✓✓" : ""}</span></div></div>`;
  }).join("") : thread.customChat
    ? `<div class="empty-state"><div>${thread.direct ? "↔" : "◎"}</div><h3>${thread.direct ? "Start your private conversation" : "Start the group conversation"}</h3><p>Messages and files here are available only to the selected members.</p></div>`
    : thread.teamWide
      ? `<div class="empty-state"><div>◎</div><h3>Start the team conversation</h3><p>Ask a routine question or share an enquiry that does not yet belong to a specific work record.</p></div>`
      : `<div class="empty-state"><div>◌</div><h3>Start the official work record</h3><p>Use this conversation for updates, files, decisions, approvals and handovers from intake to closure.</p></div>`;
  if (activeView === "chat") requestAnimationFrame(() => { const panel = document.getElementById("chat-messages"); panel.scrollTop = panel.scrollHeight; });
}

function selectChatThread(threadId) {
  if (!threadById(threadId)) return;
  activeChatThread = threadId;
  state.messages.filter(message => threadIdForMessage(message) === threadId).forEach(message => { message.unread = false; });
  saveState();
  renderChat();
  renderDashboard();
  requestAnimationFrame(() => document.getElementById("chat-input").focus());
}

function openWorkChat(entityType, entityId) {
  let threadId = entityId;
  if (entityType === "project") threadId = projectById(entityId)?.request || `project:${entityId}`;
  if (entityType === "commercial") threadId = state.commercialRecords.find(record => record.id === entityId)?.request || `commercial:${entityId}`;
  if (entityType === "deal") threadId = state.requests.find(request => request.deal === entityId)?.id || `deal:${entityId}`;
  if (!threadById(threadId)) return;
  activeChatThread = threadId;
  setView("chat");
}

function addSystemWorkMessage(threadId, text) {
  if (!threadId || !text) return;
  const now = new Date();
  state.messages.push({ id: `msg-${Date.now()}-${state.messages.length}`, thread: threadId, sender: "", date: TODAY, time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }), type: "System", text });
}

function sendChatMessage(text, attachment = "", attachmentPath = "", extra = {}) {
  const cleanText = String(text || "").trim();
  if ((!cleanText && !attachment) || !threadById(activeChatThread)) return;
  const now = new Date();
  const type = document.getElementById("chat-message-type").value || "Update";
  state.messages.push({
    id: `msg-${Date.now()}`,
    thread: activeChatThread,
    sender: window.CAGE_BACKEND?.currentMemberId?.() || "alexander",
    date: TODAY,
    time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
    type,
    pinned: type === "Decision",
    text: cleanText || "Shared a reference",
    attachment,
    attachmentPath,
    createdAt: now.toISOString(),
    mentions: assignableTeam().filter(person => cleanText.includes("@" + person.name)).map(person => person.id),
    mentionAll: /(^|\s)@all(?=\s|[.,!?:;]|$)/i.test(cleanText),
    ...extra
  });
  saveState();
  document.getElementById("chat-input").value = "";
  document.getElementById("chat-message-type").value = "Update";
  hideChatMentionPicker();
  renderChat();
  requestAnimationFrame(() => document.getElementById("chat-input")?.focus({ preventScroll: true }));
}

function chatMentionMatch() {
  const input = document.getElementById("chat-input");
  const cursor = input.selectionStart ?? input.value.length;
  const beforeCursor = input.value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([^@\s]*)$/);
  return match ? { query: match[1].toLowerCase(), start: cursor - match[1].length - 1, end: cursor } : null;
}

function hideChatMentionPicker() {
  const picker = document.getElementById("chat-mention-picker");
  picker.hidden = true;
  document.getElementById("chat-mention").setAttribute("aria-expanded", "false");
}

function showChatMentionPicker(query = "") {
  const picker = document.getElementById("chat-mention-picker");
  const cleanQuery = String(query || "").trim().toLowerCase();
  const allowed = new Set(threadMemberIds(threadById(activeChatThread)));
  const members = assignableTeam().filter(member => allowed.has(member.id) && `${member.name} ${member.email || ""} ${member.role || ""}`.toLowerCase().includes(cleanQuery));
  picker.innerHTML = members.length ? members.map(member => `<button type="button" class="chat-mention-option" role="option" data-chat-mention-id="${member.id}"><span class="owner-avatar">${escapeHtml(member.initials)}</span><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.role || member.email || "CAGE team")}</small></span></button>`).join("") : `<div class="empty-state compact"><p>No staff member matches “${escapeHtml(cleanQuery)}”.</p></div>`;
  if(!cleanQuery || 'all'.startsWith(cleanQuery))picker.insertAdjacentHTML('afterbegin','<button type="button" class="chat-mention-option" role="option" data-chat-mention-id="__all"><span class="owner-avatar">@</span><span><strong>@all</strong><small>Everyone in this conversation</small></span></button>');
  picker.hidden = false;
  document.getElementById("chat-mention").setAttribute("aria-expanded", "true");
}

function insertChatMention(memberId) {
  const member = memberId === "__all" ? {name:"all"} : teamMember(memberId);
  if (!member?.name) return;
  const input = document.getElementById("chat-input");
  const match = chatMentionMatch();
  const mention = `@${member.name} `;
  if (match) {
    input.value = `${input.value.slice(0, match.start)}${mention}${input.value.slice(match.end)}`;
    input.setSelectionRange(match.start + mention.length, match.start + mention.length);
  } else {
    const spacer = input.value && !input.value.endsWith(" ") ? " " : "";
    input.value = `${input.value}${spacer}${mention}`;
    input.setSelectionRange(input.value.length, input.value.length);
  }
  hideChatMentionPicker();
  input.focus();
}

function openNewChatDialog(mode) {
  if (window.CAGE_BACKEND?.moduleLevel?.("chat") !== "edit") return showToast("You need chat edit access to start a conversation.");
  let dialog = document.getElementById("new-chat-dialog");
  if (!dialog) {
    document.body.insertAdjacentHTML("beforeend", `<dialog id="new-chat-dialog" class="app-dialog chat-create-dialog"><form id="new-chat-form"><div class="dialog-heading"><div><p class="section-kicker">Staff inbox</p><h2 id="new-chat-title">New conversation</h2></div><button type="button" data-close-new-chat aria-label="Close">×</button></div><input type="hidden" name="mode"><label class="field" id="chat-group-name-field"><span>Group name</span><input name="groupName" maxlength="80" placeholder="For example: Field team"></label><fieldset class="chat-member-picker"><legend id="new-chat-members-label">Choose staff</legend><div id="new-chat-members"></div></fieldset><p id="new-chat-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-close-new-chat>Cancel</button><button class="primary-button">Create conversation</button></div></form></dialog>`);
    dialog = document.getElementById("new-chat-dialog");
    dialog.addEventListener("click", event => { if (event.target.closest("[data-close-new-chat]")) dialog.close(); });
    document.getElementById("new-chat-form").addEventListener("submit", event => {
      event.preventDefault();
      const form = event.currentTarget;
      const current = window.CAGE_BACKEND?.currentMemberId?.() || "alexander";
      const selected = new FormData(form).getAll("member");
      const selectedMode = form.elements.mode.value;
      const error = document.getElementById("new-chat-error");
      error.textContent = "";
      if (selectedMode === "direct") {
        if (selected.length !== 1) return void (error.textContent = "Choose one staff member.");
        const members = [current, selected[0]].sort();
        const id = `direct:${members.join(":")}`;
        if (!(state.chatGroups || []).some(group => group.id === id)) state.chatGroups.push({ id, type: "direct", members, createdBy: current, createdAt: new Date().toISOString() });
        activeChatThread = id;
      } else {
        const name = form.elements.groupName.value.trim();
        if (!name) return void (error.textContent = "Enter a group name.");
        if (!selected.length) return void (error.textContent = "Choose at least one other staff member.");
        const members = [...new Set([current, ...selected])];
        const id = `group:${crypto.randomUUID()}`;
        state.chatGroups.push({ id, type: "group", name, members, createdBy: current, createdAt: new Date().toISOString() });
        activeChatThread = id;
      }
      saveState();
      dialog.close();
      chatFilter = selectedMode;
      document.querySelectorAll("[data-chat-filter]").forEach(button => button.classList.toggle("active", button.dataset.chatFilter === chatFilter));
      renderChat();
    });
  }
  const form = document.getElementById("new-chat-form");
  form.reset();
  form.elements.mode.value = mode;
  document.getElementById("new-chat-title").textContent = mode === "direct" ? "Message a staff member" : "Create a staff group";
  document.getElementById("chat-group-name-field").hidden = mode === "direct";
  document.getElementById("new-chat-members-label").textContent = mode === "direct" ? "Who do you want to message?" : "Who should be in this group?";
  const current = window.CAGE_BACKEND?.currentMemberId?.() || "alexander";
  document.getElementById("new-chat-members").innerHTML = assignableTeam().filter(member => member.id !== current).map(member => `<label class="chat-member-choice"><input type="${mode === "direct" ? "radio" : "checkbox"}" name="member" value="${escapeHtml(member.id)}"><span class="owner-avatar">${escapeHtml(member.initials)}</span><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.role || member.email || "CAGE staff")}</small></span></label>`).join("");
  document.getElementById("new-chat-error").textContent = "";
  dialog.showModal();
}

function renderLeave() {
  const approved = state.leaveRequests.filter(request => request.status === "Approved");
  const pending = state.leaveRequests.filter(request => request.status === "Pending");
  const awayToday = approved.filter(request => isDateWithin(TODAY, request.start, request.end));
  const upcoming = approved.filter(request => request.start > TODAY && request.start <= window.CAGE_OPS?.addDays(TODAY,30));
  renderMetricCards("leave-metric-grid", [
    { label: "Away today", value: String(awayToday.length), unit: "people", note: awayToday.length ? "Handover plans are active" : "Full team available", icon: "☼", tone: "#008fc8", tint: "#e6f7fe" },
    { label: "Upcoming leave", value: String(upcoming.length), unit: "requests", note: "Next 30 days", icon: "□", tone: "#168a65", tint: "#e5f5ef" },
    { label: "Awaiting approval", value: String(pending.length), unit: "requests", note: "Management action needed", icon: "!", tone: "#e99a24", tint: "#fff4df" },
    { label: "Coverage risks", value: String(approved.filter(request => !request.handover).length), unit: "requests", note: "Every approved leave needs handover", icon: "◎", tone: "#7357c8", tint: "#f0edfb" }
  ]);

  const timelineDates = Array.from({ length: 15 }, (_, index) => window.CAGE_OPS?.addDays(TODAY,index) || TODAY);
  document.getElementById("leave-timeline").innerHTML = `<div class="leave-timeline-head"><span>Team member</span>${timelineDates.map(date => `<span>${asDate(date).getUTCDate()}</span>`).join("")}</div>${assignableTeam().map(member => `<div class="leave-person-row"><span class="leave-person-label"><span class="owner-avatar">${member.initials}</span>${escapeHtml(member.name.split(" ")[0])}</span>${timelineDates.map(date => { const request = state.leaveRequests.find(item => item.person === member.id && item.status !== "Rejected" && isDateWithin(date, item.start, item.end)); return `<span class="leave-cell ${request ? request.status.toLowerCase() : ""}" title="${request ? `${escapeHtml(request.type)} · ${escapeHtml(request.status)}` : "Available"}"></span>`; }).join("")}</div>`).join("")}`;

  document.getElementById("leave-balances").innerHTML = `<div class="leave-balance-list">${assignableTeam().map(member => {
    const used = approved.filter(request => request.person === member.id && request.type === "Annual leave" && request.end>=TODAY.slice(0,4)+"-01-01" && request.start<=TODAY.slice(0,4)+"-12-31").reduce((sum, request) => sum + workdayCount(request.start<TODAY.slice(0,4)+"-01-01"?TODAY.slice(0,4)+"-01-01":request.start,request.end>TODAY.slice(0,4)+"-12-31"?TODAY.slice(0,4)+"-12-31":request.end), 0);
    const entitlement=window.CAGE_OPS?.leaveDays(member.id)??20;
    const remaining = Math.max(0, entitlement - used);
    return `<div class="leave-balance-row"><div class="leave-balance-head"><span>${escapeHtml(member.name)}</span><strong>${remaining} days left</strong></div><div class="leave-balance-track"><span style="width:${remaining / Math.max(1,entitlement) * 100}%"></span></div></div>`;
  }).join("")}</div>`;

  document.getElementById("leave-request-list").innerHTML = [...state.leaveRequests].sort((a, b) => b.submitted.localeCompare(a.submitted)).map(request => {
    const member = teamMember(request.person);
    return `<tr><td><span class="owner-chip"><span class="owner-avatar">${member.initials}</span>${escapeHtml(member.name)}</span></td><td><strong>${formatDate(request.start)}–${formatDate(request.end)}</strong><br><span class="project-client">${workdayCount(request.start, request.end)} working days</span></td><td>${escapeHtml(request.type)}</td><td><span class="project-client">${escapeHtml(request.handover)}</span></td><td><select class="leave-status-select" data-leave-status="${request.id}" aria-label="Status for ${escapeHtml(member.name)} leave">${["Pending", "Approved", "Rejected"].map(status => `<option ${status === request.status ? "selected" : ""}>${status}</option>`).join("")}</select></td></tr>`;
  }).join("");
}

function renderKnowledge() {
  const query = document.getElementById("knowledge-search").value.trim().toLowerCase();
  const references = state.knowledge.filter(item => {
    const matchesFilter = knowledgeFilter === "all" || item.category === knowledgeFilter;
    const matchesSearch = !query || `${item.title} ${item.summary} ${item.category} ${projectById(item.project)?.name || ""}`.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated.localeCompare(a.updated));
  const pinned = state.knowledge.filter(item => item.pinned).sort((a, b) => b.updated.localeCompare(a.updated));
  document.getElementById("knowledge-pinned").innerHTML = `<div class="knowledge-pinned-list">${pinned.map(item => `<button class="pinned-reference" data-open-knowledge="${item.id}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${formatDate(item.updated)}</span></button>`).join("") || `<div class="empty-state"><p>Pin important references here.</p></div>`}</div>`;
  document.getElementById("knowledge-grid").innerHTML = references.length ? references.map(item => `<article class="knowledge-card"><div class="knowledge-card-top"><span class="knowledge-type">${escapeHtml(item.category)}</span><button class="pin-button ${item.pinned ? "active" : ""}" data-pin-knowledge="${item.id}" aria-label="${item.pinned ? "Unpin" : "Pin"} ${escapeHtml(item.title)}">${item.pinned ? "★" : "☆"}</button></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><div class="knowledge-card-footer"><span>${escapeHtml(teamMember(item.owner).name)} · ${formatDate(item.updated)}${item.project ? ` · ${escapeHtml(projectById(item.project)?.name || "")}` : ""}</span><button data-open-knowledge="${item.id}">Open</button></div></article>`).join("") : `<div class="empty-state"><div>▤</div><h3>No matching references</h3><p>Try another category or search term.</p></div>`;
}

function renderTeam() {
  const active = activeTasks();
  const assigned = assignableTeam().map(member => {
    const tasks = active.filter(task => task.owner === member.id);
    return { ...member, tasks, active: tasks.length, overdue: tasks.filter(isOverdue).length, blocked: tasks.filter(task => task.status === "Blocked").length };
  });
  const mostLoaded = [...assigned].sort((a,b) => b.active - a.active)[0];
  document.getElementById("team-summary").innerHTML = `
    <article class="team-summary-card"><span>Active assignments</span><strong>${active.length}</strong></article>
    <article class="team-summary-card"><span>People with overdue work</span><strong>${assigned.filter(member => member.overdue).length}</strong></article>
    <article class="team-summary-card"><span>Highest workload</span><strong>${escapeHtml(mostLoaded.name.split(" ")[0])} · ${mostLoaded.active}</strong></article>
  `;
  const max = Math.max(1, ...assigned.map(member => member.active));
  document.getElementById("team-workload").innerHTML = assigned.sort((a,b) => b.active - a.active).map(member => {
    const activeWidth = Math.max(0, ((member.active - member.overdue) / max) * 100);
    const overdueWidth = Math.max(0, (member.overdue / max) * 100);
    return `
      <div class="team-row">
        <div class="team-person"><span class="owner-avatar">${member.initials}</span><span><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.role)}</span><small>${escapeHtml(member.email || "Email not recorded")}</small></span></div>
        <div class="workload-track"><span class="workload-active" style="width:${activeWidth}%"></span><span class="workload-overdue" style="width:${overdueWidth}%"></span></div>
        <span class="workload-stat"><strong>${member.active}</strong> active</span>
        <span class="account-access ${member.access === "Administrator" ? "administrator" : "standard"}">${escapeHtml(member.access || "Standard user")}</span>
      </div>
    `;
  }).join("");
  const shared = state.team.filter(member => member.assignable === false);
  document.getElementById("shared-accounts").innerHTML = shared.map(member => `<div class="shared-account-row"><span class="owner-avatar">${member.initials}</span><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.email || "Email not recorded")}</small></span><span class="account-access standard">${escapeHtml(member.access || "Standard user")}</span></div>`).join("");
}

function evidenceCandidates() {
  return state.tasks.filter(task => task.status === "Done" || task.priority === "High" || task.status === "Blocked");
}

function renderEvidence() {
  let tasks = evidenceCandidates();
  if (missingEvidenceOnly) tasks = tasks.filter(task => !task.evidence);
  document.getElementById("show-missing-evidence").textContent = missingEvidenceOnly ? "Show all evidence" : "Show missing only";
  document.getElementById("evidence-grid").innerHTML = tasks.length ? tasks.map(task => {
    const project = projectById(task.project);
    const owner = teamMember(task.owner);
    return `
      <article class="evidence-card">
        <div class="evidence-card-top"><span class="file-icon">${task.evidence ? "✓" : "＋"}</span><span class="status-pill ${task.evidence ? "done" : "attention"}">${task.evidence ? "Attached" : "Missing"}</span></div>
        <h3>${escapeHtml(task.evidence || task.title)}</h3>
        <p>${escapeHtml(project?.name || "Internal")} · ${escapeHtml(task.title)}</p>
        <div class="evidence-meta"><span>Owner: ${escapeHtml(owner.name)}</span><span>${escapeHtml(task.status)}</span></div>
        <div class="evidence-action">${task.evidence ? `<button data-preview-evidence="${task.id}">View evidence</button>` : `<button data-add-evidence="${task.id}">Add evidence link</button>`}</div>
      </article>
    `;
  }).join("") : `<div class="empty-state"><div>✓</div><h3>No missing evidence</h3><p>All reviewed tasks have supporting evidence.</p></div>`;
}

function renderReports() {
  const active = activeTasks();
  const overdue = active.filter(isOverdue);
  const blocked = active.filter(task => task.status === "Blocked");
  const dueSoon = active.filter(task => dueWithin(task, 7)).sort((a,b) => a.due.localeCompare(b.due));
  const recentlyDone = state.tasks.filter(task => task.status === "Done" && task.updated >= (window.CAGE_OPS?.period().from || TODAY) && task.updated <= (window.CAGE_OPS?.period().to || TODAY));
  const attentionProjects = state.projects.filter(project => projectHealth(project) === "attention");
  const activeDeals = state.deals.filter(deal => !["Won", "Lost"].includes(deal.stage));
  const overdueInvoices = state.invoices.filter(invoice => effectiveInvoiceStatus(invoice) === "Overdue");
  const outstandingValue = state.invoices.filter(invoice => !["Paid", "Draft"].includes(effectiveInvoiceStatus(invoice))).reduce((sum, invoice) => sum + Math.max(0, invoice.amount - Number(invoice.paidAmount || 0)), 0);
  const upcomingEvents = state.events.filter(event => event.date >= (window.CAGE_OPS?.period().from || TODAY) && event.date <= (window.CAGE_OPS?.period().to || TODAY)).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const activeMissions = state.missions.filter(mission => !["Complete", "Cancelled"].includes(mission.status));
  const pendingApprovals = state.approvals.filter(item => item.status === "Pending");
  const complianceActions = state.compliance.filter(record => complianceDisplayStatus(record) !== "Active");
  const equipmentAttention = state.assets.filter(assetNeedsAttention);
  const urgentCommercial = state.commercialRecords.filter(commercialNeedsAttention);
  const openRequests = state.requests.filter(request => !["Converted", "Lost / Declined"].includes(request.stage));
  const requestActions = state.requests.filter(requestNeedsAction);
  const conversionGaps = state.requests.filter(request => request.stage === "Converted" && !requestAcceptanceComplete(request));
  document.getElementById("weekly-brief").innerHTML = `
    <header class="report-header"><div><h2>Weekly Operations Brief</h2><p>Reporting snapshot · ${formatDate(TODAY, { year: true })}</p></div><span class="status-pill attention">Management review</span></header>
    <div class="report-stat-grid">
      <div class="report-stat"><span>Active projects</span><strong>${state.projects.filter(p => projectHealth(p) !== "complete").length}</strong></div>
      <div class="report-stat"><span>Open pipeline</span><strong>${formatMoney(activeDeals.reduce((sum, deal) => sum + deal.value, 0), true)}</strong></div>
      <div class="report-stat"><span>Outstanding</span><strong>${formatMoney(outstandingValue, true)}</strong></div>
      <div class="report-stat"><span>Blocked work</span><strong>${blocked.length}</strong></div>
      <div class="report-stat"><span>Field ready</span><strong>${activeMissions.filter(missionCanDeploy).length}/${activeMissions.length}</strong></div>
      <div class="report-stat"><span>Pending approvals</span><strong>${pendingApprovals.length}</strong></div>
      <div class="report-stat"><span>Open requests</span><strong>${openRequests.length}</strong></div>
    </div>
    <section class="report-section"><h3>Management attention</h3><ul class="report-list">${requestActions.slice(0,4).map(request => `<li><strong>${escapeHtml(request.number)}</strong> — ${escapeHtml(request.title)} is at ${escapeHtml(request.stage)}; next action: ${escapeHtml(request.nextAction)}</li>`).join("")}${blocked.map(task => `<li><strong>${escapeHtml(task.title)}</strong> — ${escapeHtml(task.blocker || "Blocker reason required")} Owner: ${escapeHtml(teamMember(task.owner).name)}.</li>`).join("") || "<li>No blocked work.</li>"}${attentionProjects.slice(0,3).map(project => `<li>${escapeHtml(project.name)} needs attention because it contains overdue or blocked work.</li>`).join("")}${pendingApprovals.filter(item => item.due <= TODAY).map(item => `<li>Decision due: ${escapeHtml(item.title)} — requested by ${escapeHtml(teamMember(item.requester).name)}.</li>`).join("")}${complianceActions.slice(0,3).map(record => `<li>${escapeHtml(record.title)} — ${escapeHtml(complianceDisplayStatus(record))}; owner ${escapeHtml(teamMember(record.owner).name)}.</li>`).join("")}</ul></section>
    <section class="report-section"><h3>Field readiness</h3><ul class="report-list">${activeMissions.sort((a, b) => a.start.localeCompare(b.start)).slice(0,4).map(mission => `<li>${formatDate(mission.start)} — ${escapeHtml(mission.title)}; ${readinessCount(mission)}/5 gates complete and ${escapeHtml(assetById(mission.asset)?.name || "equipment unassigned")}.</li>`).join("") || "<li>No active missions.</li>"}</ul></section>
    <section class="report-section"><h3>Due within seven days</h3><ul class="report-list">${dueSoon.map(task => `<li>${escapeHtml(task.title)} — ${escapeHtml(dueLabel(task))}; ${escapeHtml(teamMember(task.owner).name)}.</li>`).join("") || "<li>No tasks due this week.</li>"}</ul></section>
    <section class="report-section"><h3>Sales and cash</h3><ul class="report-list">${activeDeals.sort((a,b) => b.value - a.value).slice(0,3).map(deal => `<li>${escapeHtml(deal.name)} — ${formatMoney(deal.value, true)} at ${deal.probability}% probability; next action ${formatDate(deal.nextAction)}.</li>`).join("")}${overdueInvoices.map(invoice => `<li>${escapeHtml(invoice.number)} for ${escapeHtml(invoice.client)} is overdue — ${formatMoney(invoice.amount)}.</li>`).join("") || "<li>No overdue invoices.</li>"}</ul></section>
    <section class="report-section"><h3>Calendar</h3><ul class="report-list">${upcomingEvents.map(event => `<li>${formatDate(event.date)} at ${escapeHtml(event.start)} — ${escapeHtml(event.title)}; ${escapeHtml(teamMember(event.owner).name)}.</li>`).join("") || "<li>No scheduled events this week.</li>"}</ul></section>
    <section class="report-section"><h3>Recently completed</h3><ul class="report-list">${recentlyDone.map(task => `<li>${escapeHtml(task.title)} — evidence: ${escapeHtml(task.evidence || "completion note only")}.</li>`).join("") || "<li>No recent completions recorded.</li>"}</ul></section>
    <section class="report-section"><h3>Recommended actions</h3><ul class="report-list"><li>Qualify every new request and record the next dated action before work is scoped.</li><li>Do not submit offers or start delivery until internal approval and formal acceptance are recorded.</li><li>Clear every deployment gate and compliance action before field mobilisation.</li><li>Resolve blocked work and attach client-ready evidence before closing high-priority tasks.</li></ul></section>
  `;

  const projectsMissingLead = state.projects.filter(project => !project.owner).length;
  const projectsMissingDeadline = state.projects.filter(project => !project.deadline).length;
  const activeMissingOutput = active.filter(task => !task.output).length;
  const completedMissingEvidence = state.tasks.filter(task => task.status === "Done" && !task.evidence).length;
  const checks = [
    { title: "Single project lead", detail: projectsMissingLead ? `${projectsMissingLead} projects need a lead` : "Every project has one accountable lead", warning: projectsMissingLead > 0 },
    { title: "Project deadlines", detail: projectsMissingDeadline ? `${projectsMissingDeadline} deadlines are missing` : "Every project has a deadline", warning: projectsMissingDeadline > 0 },
    { title: "Clear task outputs", detail: activeMissingOutput ? `${activeMissingOutput} active tasks need an output` : "Every active task defines “done”", warning: activeMissingOutput > 0 },
    { title: "Completion evidence", detail: completedMissingEvidence ? `${completedMissingEvidence} completed tasks need evidence` : "Every completion has evidence", warning: completedMissingEvidence > 0 },
    { title: "Sales follow-ups", detail: `${state.deals.filter(deal => !["Won", "Lost"].includes(deal.stage) && deal.nextAction <= TODAY).length} CRM actions are due`, warning: state.deals.some(deal => !["Won", "Lost"].includes(deal.stage) && deal.nextAction <= TODAY) },
    { title: "Invoice follow-up", detail: overdueInvoices.length ? `${overdueInvoices.length} invoices are overdue` : "No overdue invoices", warning: overdueInvoices.length > 0 },
    { title: "Mission readiness", detail: activeMissions.every(missionCanDeploy) ? "Every active mission is cleared for deployment" : `${activeMissions.filter(mission => !missionCanDeploy(mission)).length} missions still need checks or approval`, warning: activeMissions.some(mission => !missionCanDeploy(mission)) },
    { title: "Equipment control", detail: equipmentAttention.length ? `${equipmentAttention.length} assets need service or inspection` : "No equipment requires attention", warning: equipmentAttention.length > 0 },
    { title: "Compliance register", detail: complianceActions.length ? `${complianceActions.length} records require review or renewal` : "All compliance records are current", warning: complianceActions.length > 0 },
    { title: "Decision queue", detail: pendingApprovals.length ? `${pendingApprovals.length} approvals are pending` : "No decisions are waiting", warning: pendingApprovals.some(item => item.due <= TODAY) },
    { title: "Commercial deadlines", detail: urgentCommercial.length ? `${urgentCommercial.length} records need attention` : "No urgent tender or contract deadlines", warning: urgentCommercial.length > 0 },
    { title: "Request ownership", detail: state.requests.every(request => request.owner && request.deadline && request.nextAction) ? "Every request has an owner, deadline and next action" : "One or more requests need an owner, deadline or next action", warning: state.requests.some(request => !request.owner || !request.deadline || !request.nextAction) },
    { title: "Acceptance before delivery", detail: conversionGaps.length ? `${conversionGaps.length} converted requests are missing acceptance evidence` : "Every converted request has formal acceptance", warning: conversionGaps.length > 0 }
  ];
  document.getElementById("quality-checks").innerHTML = checks.map(check => `<div class="quality-item"><span class="quality-icon ${check.warning ? "warning" : ""}">${check.warning ? "!" : "✓"}</span><span class="quality-copy"><strong>${check.title}</strong><span>${check.detail}</span></span></div>`).join("");
}

function nextRequestNumber() {
  const max = Math.max(0, ...state.requests.map(request => Number(String(request.number).replace(/\D/g, "")) || 0));
  return `REQ-${new Date(`${TODAY}T00:00:00Z`).getUTCFullYear()}-${String(max + 1).slice(-4).padStart(4, "0")}`;
}

function renderRequestPurposeOptions(selected = "") {
  const select = document.getElementById("request-type-input");
  if (!select) return;
  const current = selected || select.value || state.requestPurposes[0] || "General enquiry";
  select.innerHTML = state.requestPurposes.map(purpose => `<option ${purpose === current ? "selected" : ""}>${escapeHtml(purpose)}</option>`).join("");
}

function renderPurposeManager() {
  const list = document.getElementById("purpose-list");
  if (!list) return;
  list.innerHTML = state.requestPurposes.map(purpose => {
    const core = CORE_REQUEST_PURPOSES.includes(purpose);
    const inUse = state.requests.some(request => request.type === purpose);
    return `<div class="purpose-row"><span><strong>${escapeHtml(purpose)}</strong><small>${core ? "Core workflow" : "Custom purpose"}${inUse ? " · in use" : ""}</small></span>${core ? `<span class="purpose-lock">Protected</span>` : `<button type="button" data-remove-purpose="${escapeHtml(purpose)}" ${inUse ? "disabled title=\"This purpose is used by an existing request\"" : ""}>Remove</button>`}</div>`;
  }).join("");
}

function openPurposeManager() {
  const form = document.getElementById("purpose-form");
  form.reset();
  document.getElementById("purpose-form-error").textContent = "";
  renderPurposeManager();
  document.getElementById("purpose-dialog").showModal();
}

function addRequestPurpose(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("purpose-dialog").close();
    return;
  }
  const input = event.currentTarget.elements.purpose;
  const purpose = String(input.value || "").trim().replace(/\s+/g, " ");
  const error = document.getElementById("purpose-form-error");
  if (purpose.length < 3) {
    error.textContent = "Enter a clear purpose with at least three characters.";
    return;
  }
  if (state.requestPurposes.some(value => value.toLowerCase() === purpose.toLowerCase())) {
    error.textContent = "That request purpose already exists.";
    return;
  }
  state.requestPurposes.push(purpose);
  saveState();
  input.value = "";
  error.textContent = "";
  renderPurposeManager();
  renderRequestPurposeOptions(purpose);
  showToast(`${purpose} added as a request purpose.`);
}

function removeRequestPurpose(purpose) {
  if (CORE_REQUEST_PURPOSES.includes(purpose) || state.requests.some(request => request.type === purpose)) return;
  state.requestPurposes = state.requestPurposes.filter(value => value !== purpose);
  saveState();
  renderPurposeManager();
  renderRequestPurposeOptions();
  showToast(`${purpose} removed from request purposes.`);
}

function openRequestDialog() {
  renderOwnerOptions();
  const form = document.getElementById("request-form");
  form.reset();
  renderRequestPurposeOptions(state.settings.defaultRequestPurpose || "Drone mapping");
  form.elements.owner.value = state.settings.defaultOwner || "alexander";
  form.elements.priority.value = "Normal";
  form.elements.deadline.value = dateAfter(3);
  document.getElementById("request-form-error").textContent = "";
  document.getElementById("request-dialog").showModal();
}

function createRequest(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("request-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const type = String(data.get("type") || "General enquiry");
  const request = {
    id: `rq-${Date.now()}`,
    number: nextRequestNumber(),
    title: String(data.get("title") || "").trim(),
    organisation: String(data.get("organisation") || "").trim(),
    contact: String(data.get("contact") || "").trim(),
    contactDetail: String(data.get("contactDetail") || "").trim(),
    type,
    source: String(data.get("source") || "Email"),
    owner: String(data.get("owner") || ""),
    priority: String(data.get("priority") || "Normal"),
    location: String(data.get("location") || "").trim(),
    received: TODAY,
    deadline: String(data.get("deadline") || ""),
    deliveryDeadline: String(data.get("deliveryDeadline") || ""),
    value: Number(data.get("value") || 0),
    stage: "New",
    summary: String(data.get("summary") || "").trim(),
    attachments: String(data.get("attachments") || "").trim(),
    nextAction: String(data.get("nextAction") || "").trim(),
    checklist: Object.fromEntries(requestTemplate(type).map(item => [item.key, false]))
  };
  if (!request.title || !request.organisation || !request.contact || !request.owner || !request.deadline || !request.summary || !request.nextAction) {
    document.getElementById("request-form-error").textContent = "Add the request, organisation, contact, owner, deadline, summary and next action.";
    return;
  }
  if (request.deliveryDeadline && request.deliveryDeadline < TODAY) {
    document.getElementById("request-form-error").textContent = "The expected delivery date cannot be in the past.";
    return;
  }
  state.requests.push(request);
  addSystemWorkMessage(request.id, `${request.number} created by the AI opportunity monitor. Source verification and eligibility review are required before CAGE proceeds.`);
  if (!contactByCompany(request.organisation)) {
    state.contacts.push({ id: `c-${Date.now() + 1}`, company: request.organisation, contact: request.contact, relationship: "Prospect", owner: request.owner, lastActivity: TODAY, nextAction: request.deadline, note: request.title });
  }
  saveState();
  document.getElementById("request-dialog").close();
  renderAll();
  setView("requests");
  openRequest(request.id);
  showToast(`${request.number} captured with an owner and deadline.`);
}

function ensureRequestCRM(request) {
  let contact = contactByCompany(request.organisation);
  if (!contact) {
    contact = { id: `c-${Date.now()}`, company: request.organisation, contact: request.contact, relationship: "Prospect", owner: request.owner, lastActivity: TODAY, nextAction: request.deadline, note: request.title };
    state.contacts.push(contact);
  } else {
    contact.lastActivity = TODAY;
    contact.nextAction = request.deadline;
    contact.owner = request.owner;
  }
  let deal = dealById(request.deal);
  if (!deal) {
    deal = {
      id: `d-${Date.now() + 1}`,
      name: request.title,
      company: request.organisation,
      owner: request.owner,
      value: request.value,
      stage: "Qualified",
      probability: 35,
      nextAction: request.deadline,
      nextStep: request.nextAction,
      project: ""
    };
    state.deals.push(deal);
    request.deal = deal.id;
  }
  return deal;
}

function ensureRequestCommercial(request) {
  if (!["Tender / RFQ", "Grant"].includes(request.type)) return null;
  let record = state.commercialRecords.find(item => item.id === request.commercial);
  if (!record) {
    record = {
      id: `cm-${Date.now() + 2}`,
      type: request.type === "Grant" ? "Grant" : "Tender",
      title: request.title,
      organisation: request.organisation,
      owner: request.owner,
      deadline: request.deadline,
      value: request.value,
      stage: "Monitoring",
      progress: 10,
      nextAction: request.nextAction,
      request: request.id
    };
    state.commercialRecords.push(record);
    request.commercial = record.id;
  }
  return record;
}

function syncRequestLinks(request) {
  const deal = dealById(request.deal);
  const dealStages = {
    New: ["Prospect", 10],
    "Needs information": ["Prospect", 15],
    Qualified: ["Qualified", 35],
    Scoping: ["Qualified", 45],
    "Internal review": ["Proposal", 55],
    "Approved to send": ["Proposal", 65],
    Submitted: ["Proposal", 70],
    Negotiation: ["Negotiation", 85],
    "Won / Awarded": ["Won", 100],
    Converted: ["Won", 100],
    "Lost / Declined": ["Lost", 0]
  };
  if (deal && dealStages[request.stage]) {
    [deal.stage, deal.probability] = dealStages[request.stage];
    deal.owner = request.owner;
    deal.value = request.value;
    deal.nextAction = request.deadline;
    deal.nextStep = request.nextAction;
  }
  const commercial = state.commercialRecords.find(item => item.id === request.commercial);
  const commercialStages = {
    New: ["Monitoring", 5],
    "Needs information": ["Monitoring", 10],
    Qualified: ["Preparing", 20],
    Scoping: ["Preparing", 50],
    "Internal review": ["Internal review", 80],
    "Approved to send": ["Internal review", 90],
    Submitted: ["Submitted", 95],
    Negotiation: ["Negotiation", 98],
    "Won / Awarded": ["Awarded", 100],
    Converted: [request.type === "Tender / RFQ" ? "Awarded" : "Active", 100],
    "Lost / Declined": ["Closed", 100]
  };
  if (commercial && commercialStages[request.stage]) {
    [commercial.stage, commercial.progress] = commercialStages[request.stage];
    commercial.owner = request.owner;
    commercial.deadline = request.stage === "Converted" ? request.deliveryDeadline || commercial.deadline : request.deadline;
    commercial.value = request.value;
    commercial.nextAction = request.nextAction;
  }
}

function toggleRequestCheck(requestId, key) {
  const request = requestById(requestId);
  const item = requestTemplate(request).find(entry => entry.key === key);
  if (!request || !item) return;
  if (key === "approval") {
    showToast("Approval is completed only from the central decision inbox.");
    return;
  }
  request.checklist ||= {};
  request.checklist[key] = !request.checklist[key];
  if (!request.checklist[key] && ["qualify", "scope"].includes(item.phase) && !["Converted", "Lost / Declined"].includes(request.stage)) {
    request.checklist.approval = false;
    request.stage = item.phase === "qualify" ? "Needs information" : "Scoping";
    const pendingReview = state.approvals.find(approval => approval.linkedType === "request" && approval.linkedId === request.id && approval.status === "Pending");
    if (pendingReview) {
      pendingReview.status = "Returned";
      pendingReview.decided = TODAY;
      pendingReview.decisionNote = "The request scope changed after review was submitted; a new approval is required.";
    }
    syncRequestLinks(request);
  }
  if (key === "submission" && request.checklist[key] && requestHasApprovedReview(request) && request.stage === "Approved to send") request.stage = "Submitted";
  if (key === "submission" && !request.checklist[key] && ["Submitted", "Negotiation", "Won / Awarded"].includes(request.stage)) request.stage = "Approved to send";
  syncRequestLinks(request);
  saveState();
  renderAll();
  renderRequestDetail(request.id);
  showToast(`${item.label} ${request.checklist[key] ? "completed" : "reopened"}.`);
}

function rejectRequestStageChange(request, previous, control, message) {
  if (control) control.value = previous;
  showToast(message);
}

function changeRequestStage(requestId, stage, control) {
  const request = requestById(requestId);
  if (!request || !REQUEST_STAGE_OPTIONS.includes(stage) || request.stage === stage) return;
  const previous = request.stage;
  if (["Qualified", "Scoping"].includes(stage) && !requestQualificationComplete(request)) {
    rejectRequestStageChange(request, previous, control, "Complete the qualification checks before advancing this request.");
    return;
  }
  if (stage === "Internal review") {
    if (!requestPreReviewComplete(request)) {
      rejectRequestStageChange(request, previous, control, "Complete the qualification, scope and costing checks before requesting approval.");
      return;
    }
    requestInternalReview(request.id);
    return;
  }
  if (["Approved to send", "Submitted", "Negotiation", "Won / Awarded"].includes(stage) && !requestPreReviewComplete(request)) {
    rejectRequestStageChange(request, previous, control, "Complete every qualification, scope and costing control before external progression.");
    return;
  }
  if (["Approved to send", "Submitted", "Negotiation", "Won / Awarded"].includes(stage) && !requestHasApprovedReview(request)) {
    rejectRequestStageChange(request, previous, control, "An approved internal review is required before external submission.");
    return;
  }
  if (["Negotiation", "Won / Awarded"].includes(stage) && !request.checklist?.submission) {
    rejectRequestStageChange(request, previous, control, "Record the external submission before the outcome or negotiation stage.");
    return;
  }
  if (stage === "Converted") {
    if (previous !== "Won / Awarded" || !requestAcceptanceComplete(request)) {
      rejectRequestStageChange(request, previous, control, "File the signed contract, PO, award or accepted quote before creating delivery work.");
      return;
    }
    convertRequest(request.id);
    return;
  }
  request.stage = stage;
  addSystemWorkMessage(request.id, `Workflow moved from ${previous} to ${stage}.`);
  if (stage === "Qualified") {
    ensureRequestCRM(request);
    ensureRequestCommercial(request);
  }
  if (stage === "Submitted") request.checklist.submission = true;
  syncRequestLinks(request);
  saveState();
  renderAll();
  if (document.getElementById("request-detail-dialog").open) renderRequestDetail(request.id);
  showToast(stage === "Qualified"
    ? `${request.number} qualified and linked to a CRM opportunity.`
    : `${request.number} moved to ${stage}.`);
}

function requestInternalReview(requestId) {
  const request = requestById(requestId);
  if (!request) return;
  if (!requestPreReviewComplete(request)) {
    showToast("Complete the scope, evidence and costing checks first.");
    return;
  }
  if(currentUserCanSelfApprove()){
    let approval=state.approvals.find(item=>item.linkedType==='request'&&item.linkedId===request.id&&item.status==='Pending');
    if(!approval){approval={id:'ap-'+crypto.randomUUID(),type:request.type==='Grant'?'Grant':'Quote',title:'Release '+request.title,requester:window.CAGE_BACKEND.currentMemberId(),submitted:TODAY,due:request.deadline||dateAfter(1),amount:request.value,status:'Pending',summary:'Scope and costing reviewed by the approving administrator.',linkedType:'request',linkedId:request.id};state.approvals.push(approval);}
    decideApproval(approval.id,'Approved');document.getElementById('request-detail-dialog').close();return;
  }
  const pending = state.approvals.some(item => item.linkedType === "request" && item.linkedId === request.id && item.status === "Pending");
  if (pending) {
    request.stage = "Internal review";
    syncRequestLinks(request);
    saveState();
    renderAll();
    showToast("This request is already awaiting an internal decision.");
    return;
  }
  const approvalType = request.type === "Grant" ? "Grant" : request.type === "Tender / RFQ" ? "Submission" : "Quote";
  state.approvals.push({
    id: `ap-${Date.now()}`,
    type: approvalType,
    title: `Release ${request.title}`,
    requester: request.owner,
    submitted: TODAY,
    due: request.deadline >= TODAY ? request.deadline : dateAfter(1),
    amount: request.value,
    status: "Pending",
    summary: `Review the ${request.type.toLowerCase()} scope, evidence, costing, risks and external response before release.`,
    linkedType: "request",
    linkedId: request.id
  });
  request.stage = "Internal review";
  addSystemWorkMessage(request.id, "Scope and costing submitted for internal approval.");
  syncRequestLinks(request);
  saveState();
  document.getElementById("request-detail-dialog").close();
  renderAll();
  setView("approvals");
  showToast("Internal review sent to the central approval inbox.");
}

function prepareRequestQuote(requestId) {
  const request = requestById(requestId);
  if (!request) return;
  const deal = ensureRequestCRM(request);
  saveState();
  document.getElementById("request-detail-dialog").close();
  openQuoteDialog(deal.id);
  const form = document.getElementById("quote-form");
  form.dataset.requestId = request.id;
  form.elements.client.value = request.organisation;
  form.elements.recipient.value = request.contactDetail.includes("@") ? request.contactDetail : "";
  form.elements.amount.value = request.value || "";
  form.elements.description.value = request.summary;
}

function handleRequestAction(requestId, action) {
  const request = requestById(requestId);
  if (!request) return;
  if (action === "qualify") changeRequestStage(request.id, "Qualified");
  if (action === "scope") changeRequestStage(request.id, "Scoping");
  if (action === "review") requestInternalReview(request.id);
  if (action === "quote") prepareRequestQuote(request.id);
  if (action === "submit") changeRequestStage(request.id, "Submitted");
  if (action === "negotiate") changeRequestStage(request.id, "Negotiation");
  if (action === "win") changeRequestStage(request.id, "Won / Awarded");
  if (action === "convert") convertRequest(request.id);
  if (action === "schedule") {
    document.getElementById("request-detail-dialog").close();
    openEventDialog({ date: request.deadline, owner: request.owner, title: `Follow up: ${request.organisation}`, attendees: `${request.contact} · ${request.contactDetail}` });
  }
  if (action === "lose" && window.confirm(`Close ${request.number} as lost or declined?`)) changeRequestStage(request.id, "Lost / Declined");
}

function requestDeliveryTasks(request) {
  const commonClose = [
    { title: "Obtain client acceptance and archive evidence", output: "Written acceptance and final deliverable pack filed against the project.", owner: request.owner },
    { title: "Issue final invoice and close the project", output: "Invoice issued, payment follow-up scheduled and project close-out completed.", owner: request.owner }
  ];
  if (request.type === "Equipment hire") return [
    { title: "Confirm agreement, deposit and payment", output: "Signed hire agreement and required payment evidence filed.", owner: request.owner },
    { title: "Reserve and inspect hire equipment", output: "Equipment reserved with serviceability check and timestamped condition photos.", owner: "ian" },
    { title: "Complete equipment handover", output: "Signed handover records all aircraft, batteries, accessories and condition.", owner: "ian" },
    { title: "Monitor the active hire", output: "Check-in record confirms location, use and any incident or support requirement.", owner: request.owner },
    { title: "Inspect returned equipment", output: "Return condition, hours, damage and missing items documented.", owner: "ian" },
    ...commonClose
  ];
  if (request.type === "RPL training") return [
    { title: "Create trainee and eligibility register", output: "Verified trainee list with identity, eligibility and joining documents.", owner: "comfort" },
    { title: "Confirm instructors, venue and aircraft", output: "Training resources and equipment readiness are signed off.", owner: "ian" },
    { title: "Deliver theory programme", output: "Attendance, lesson records and knowledge assessments completed.", owner: "comfort" },
    { title: "Deliver practical training and assessment", output: "Flight logs, instructor notes and assessment evidence completed.", owner: "comfort" },
    { title: "Complete certification evidence", output: "Training register, results and certification pack quality-checked.", owner: "comfort" },
    ...commonClose
  ];
  if (["Drone mapping", "Inspection / thermal", "Agriculture service", "Aerial filming"].includes(request.type)) return [
    { title: "Confirm client brief, AOI and acceptance criteria", output: "Signed brief records coverage, dates, outputs, accuracy and acceptance criteria.", owner: request.owner },
    { title: "Prepare mission method and mobilisation plan", output: "Approved method covers crew, equipment, travel, access, safety and contingencies.", owner: "ian" },
    { title: "Secure permits and mission clearance", output: "All aviation, site and safety evidence is filed before deployment.", owner: "alexander" },
    { title: "Capture field data and complete backups", output: "Field logs and verified primary and backup copies are complete.", owner: "ian" },
    { title: "Process, quality-check and package outputs", output: "Independent QA confirms completeness, accuracy, naming and packaging.", owner: "ian" },
    { title: "Deliver outputs and record client review", output: "Deliverables sent with a dated client review and issue log.", owner: request.owner },
    ...commonClose
  ];
  if (request.type === "GIS / data processing") return [
    { title: "Validate source data and transfer controls", output: "Complete source-data inventory, licence and secure transfer record.", owner: request.owner },
    { title: "Configure processing and QA workflow", output: "Reproducible workflow records formats, projection, tools and acceptance tests.", owner: "ian" },
    { title: "Process and quality-check outputs", output: "Outputs pass completeness, geometry, naming and visual checks.", owner: "ian" },
    { title: "Deliver data and resolve review comments", output: "Final data package and closed client issue log filed.", owner: request.owner },
    ...commonClose
  ];
  if (request.type === "Grant") return [
    { title: "Hold grant award kickoff", output: "Kickoff confirms grant conditions, milestones, reporting, owners and communication channels.", owner: request.owner },
    { title: "Baseline workplan, budget and safeguards", output: "Approved baseline links activities, budget, indicators, risks and evidence requirements.", owner: "alexander" },
    { title: "Mobilise programme team and resources", output: "Team, partners, procurement and schedule are ready for the first milestone.", owner: request.owner },
    { title: "Deliver milestone activities and evidence", output: "Milestone outputs and indicator evidence pass internal quality review.", owner: request.owner },
    { title: "Submit narrative report and financial claim", output: "Approved report and claim are submitted with receipt and exact version retained.", owner: request.owner },
    { title: "Reconcile grant funds and close the award", output: "Final report, financial reconciliation, asset record and close-out evidence are archived.", owner: request.owner }
  ];
  if (request.type === "Tender / RFQ") return [
    { title: "Hold contract award kickoff", output: "Kickoff confirms obligations, milestones, reporting, owners and communication channels.", owner: request.owner },
    { title: "Baseline milestones, budget and compliance", output: "Approved delivery baseline links activities, budget, risks and evidence requirements.", owner: "alexander" },
    { title: "Mobilise delivery team and resources", output: "Team, suppliers, equipment and schedule are ready for the first milestone.", owner: request.owner },
    { title: "Deliver milestone work and evidence", output: "Milestone outputs and supporting evidence pass internal quality review.", owner: request.owner },
    { title: "Submit programme or contract report", output: "Approved report and claim are submitted with receipt and exact version retained.", owner: request.owner },
    ...commonClose
  ];
  return [
    { title: "Hold kickoff and confirm responsibilities", output: "Kickoff note records scope, owners, timeline, risks and communication channels.", owner: request.owner },
    { title: "Deliver the agreed work package", output: "Agreed outputs are completed with evidence and internal quality review.", owner: request.owner },
    { title: "Review outcomes with the client or partner", output: "Review record captures acceptance, issues, lessons and next steps.", owner: request.owner },
    ...commonClose
  ];
}

function requestTaskDueDate(request, index, total) {
  const start = asDate(TODAY);
  let finish = request.deliveryDeadline ? asDate(request.deliveryDeadline) : asDate(dateAfter(30));
  if (finish <= start) finish = asDate(dateAfter(30));
  const days = Math.max(total, Math.round((finish - start) / 86400000));
  const due = new Date(start);
  due.setUTCDate(due.getUTCDate() + Math.max(1, Math.round(((index + 1) / total) * days)));
  return due.toISOString().slice(0, 10);
}

function convertRequest(requestId) {
  const request = requestById(requestId);
  if (!request) return;
  if (request.stage !== "Won / Awarded" || !requestAcceptanceComplete(request)) {
    showToast("Record the award and file acceptance evidence before creating delivery work.");
    return;
  }
  const deal = ensureRequestCRM(request);
  deal.stage = "Won";
  deal.probability = 100;

  let commercial = state.commercialRecords.find(record => record.id === request.commercial);
  const commercialType = request.type === "Tender / RFQ" ? "Tender" : request.type === "Grant" ? "Grant" : "Contract";
  if (!commercial) {
    commercial = {
      id: `cm-${Date.now()}`,
      type: commercialType,
      title: request.title,
      organisation: request.organisation,
      owner: request.owner,
      deadline: request.deliveryDeadline || dateAfter(30),
      value: request.value,
      stage: commercialType === "Tender" ? "Awarded" : "Active",
      progress: 100,
      nextAction: "Mobilise the linked delivery project.",
      request: request.id
    };
    state.commercialRecords.push(commercial);
    request.commercial = commercial.id;
  } else {
    commercial.stage = commercialType === "Tender" ? "Awarded" : "Active";
    commercial.progress = 100;
    commercial.request = request.id;
    commercial.nextAction = "Mobilise the linked delivery project.";
  }

  let project = projectById(request.project);
  if (!project) {
    const projectId = `p-${Date.now() + 1}`;
    const team = [request.owner];
    if (["Drone mapping", "Inspection / thermal", "Agriculture service", "Aerial filming", "Equipment hire", "GIS / data processing", "RPL training"].includes(request.type)) team.push("ian");
    if (request.type === "RPL training") team.push("comfort");
    project = {
      id: projectId,
      name: request.title,
      client: request.organisation,
      owner: request.owner,
      team: [...new Set(team)],
      deadline: request.deliveryDeadline || dateAfter(30),
      category: requestTypeCategory(request.type),
      outcome: `Deliver the accepted ${request.type.toLowerCase()} scope for ${request.organisation}, with quality evidence, client acceptance and financial close-out.`,
      request: request.id,
      commercial: commercial.id
    };
    state.projects.push(project);
  window.CAGE_OPS?.applyTemplate(project,new FormData(event.currentTarget).get("workflowTemplate"));
    const workflow = requestDeliveryTasks(request);
    workflow.forEach((task, index) => state.tasks.push({
      id: `t-${Date.now() + index + 2}`,
      project: project.id,
      title: task.title,
      owner: state.team.some(member => member.id === task.owner) ? task.owner : request.owner,
      due: requestTaskDueDate(request, index, workflow.length),
      priority: index < 2 ? "High" : "Medium",
      status: "To Do",
      list: "list-todo",
      output: task.output,
      evidence: "",
      updated: TODAY
    }));
    state.events.push({ id: `ev-${Date.now() + 50}`, title: `${request.title} kickoff`, date: dateAfter(1), start: "09:00", end: "10:00", type: "Meeting", owner: request.owner, project: project.id, attendees: `${request.organisation} · CAGE delivery team` });
    request.project = project.id;
  }
  deal.project = project.id;
  deal.nextStep = "Deliver the accepted scope and retain completion evidence.";
  commercial.project = project.id;
  request.stage = "Converted";
  request.nextAction = "Open the delivery project and complete the kickoff task.";
  addSystemWorkMessage(request.id, `Award or acceptance recorded. The conversation now continues into ${project.name}; all earlier decisions and files remain attached.`);
  syncRequestLinks(request);
  saveState();
  document.getElementById("request-detail-dialog").close();
  renderAll();
  setView("projects");
  openProject(project.id);
  showToast("Contract, project, delivery tasks and the continuous work chat are now linked.");
}

function dateAfter(days) {
  const date = asDate(TODAY);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function openMissionDialog(projectId = "") {
  renderOwnerOptions();
  renderProjectOptions();
  const form = document.getElementById("mission-form");
  form.reset();
  form.elements.start.value = TODAY;
  form.elements.end.value = TODAY;
  form.elements.lead.value = projectById(projectId)?.owner || "ian";
  form.elements.project.value = projectId || "";
  document.getElementById("mission-form-error").textContent = "";
  document.getElementById("mission-dialog").showModal();
}

function createMission(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("mission-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const mission = {
    id: `ms-${Date.now()}`,
    title: String(data.get("title") || "").trim(),
    project: String(data.get("project") || ""),
    lead: String(data.get("lead") || ""),
    location: String(data.get("location") || "").trim(),
    start: String(data.get("start") || ""),
    end: String(data.get("end") || ""),
    asset: String(data.get("asset") || ""),
    risk: String(data.get("risk") || "Medium"),
    status: "Planning",
    objective: String(data.get("objective") || "").trim(),
    readiness: { brief: true, crew: true, equipment: Boolean(data.get("asset")), safety: false, permit: false }
  };
  if (!mission.title || !mission.project || !mission.lead || !mission.location || !mission.start || !mission.end || !mission.objective) {
    document.getElementById("mission-form-error").textContent = "Add the project, lead, location, dates and a clear mission objective.";
    return;
  }
  if (mission.end < mission.start) {
    document.getElementById("mission-form-error").textContent = "The end date cannot be before the start date.";
    return;
  }
  const overlap = mission.asset && state.missions.some(item => item.asset === mission.asset && !["Cancelled", "Complete"].includes(item.status) && mission.start <= item.end && mission.end >= item.start);
  if (overlap) {
    document.getElementById("mission-form-error").textContent = "That aircraft is already allocated during these dates. Choose another or assign it later.";
    return;
  }
  state.missions.push(mission);
  if (mission.asset) {
    const asset = assetById(mission.asset);
    if (asset) {
      asset.status = "Assigned";
      asset.project = mission.project;
    }
  }
  state.approvals.push({
    id: `ap-${Date.now() + 1}`,
    type: "Mission clearance",
    title: `Clear ${mission.title}`,
    requester: mission.lead,
    submitted: TODAY,
    due: mission.start,
    amount: 0,
    status: "Pending",
    summary: "Confirm the five deployment-readiness gates before mobilisation.",
    linkedType: "mission",
    linkedId: mission.id
  });
  saveState();
  document.getElementById("mission-dialog").close();
  renderAll();
  setView("missions");
  showToast("Mission created with a linked clearance request.");
}

function toggleMissionGate(missionId, key) {
  const mission = missionById(missionId);
  if (!mission || !Object.prototype.hasOwnProperty.call(mission.readiness || {}, key)) return;
  if (key === "equipment" && !mission.asset && !mission.readiness.equipment) {
    showToast("Assign primary equipment before completing the equipment gate.");
    return;
  }
  mission.readiness[key] = !mission.readiness[key];
  if (missionCanDeploy(mission) && mission.status === "Planning") mission.status = "Ready";
  if (!missionIsReady(mission) && mission.status === "Ready") mission.status = "Planning";
  saveState();
  renderAll();
  showToast(missionCanDeploy(mission) ? "Mission is checked and cleared for deployment." : missionIsReady(mission) ? "All readiness gates are complete; management clearance is still required." : "Mission readiness updated.");
}

function changeMissionAsset(missionId, assetId, control) {
  const mission = missionById(missionId);
  if (!mission) return;
  const previousId = mission.asset || "";
  const nextAsset = assetById(assetId);
  if (nextAsset && (nextAsset.status === "Maintenance" || nextAsset.condition === "Repair required")) {
    if (control) control.value = previousId;
    showToast("That equipment is not cleared for deployment.");
    return;
  }
  const overlaps = assetId && state.missions.some(item => item.id !== mission.id && item.asset === assetId && !["Cancelled", "Complete"].includes(item.status) && mission.start <= item.end && mission.end >= item.start);
  if (overlaps) {
    if (control) control.value = previousId;
    showToast("That aircraft is already allocated during this mission.");
    return;
  }
  if (previousId && previousId !== assetId) {
    const stillInUse = state.missions.some(item => item.id !== mission.id && item.asset === previousId && !["Cancelled", "Complete"].includes(item.status));
    const previousAsset = assetById(previousId);
    if (previousAsset && !stillInUse && previousAsset.status === "Assigned") {
      previousAsset.status = "Available";
      previousAsset.project = "";
    }
  }
  mission.asset = assetId;
  mission.readiness.equipment = Boolean(assetId);
  if (nextAsset) {
    nextAsset.status = "Assigned";
    nextAsset.project = mission.project;
  }
  if (!missionCanDeploy(mission) && mission.status === "Ready") mission.status = "Planning";
  saveState();
  renderAll();
  showToast(nextAsset ? `${nextAsset.name} assigned to ${mission.title}.` : "Mission equipment assignment cleared.");
}

function releaseMissionAsset(mission) {
  if (!mission.asset) return;
  const inUse = state.missions.some(item => item.id !== mission.id && item.asset === mission.asset && !["Complete", "Cancelled"].includes(item.status));
  const asset = assetById(mission.asset);
  if (asset && !inUse && asset.status === "Assigned") {
    asset.status = "Available";
    asset.project = "";
  }
}

function changeMissionStatus(missionId, nextStatus, control) {
  const mission = missionById(missionId);
  if (!mission) return;
  const previous = mission.status;
  if (["Ready", "In field"].includes(nextStatus) && !missionCanDeploy(mission)) {
    if (control) control.value = previous;
    showToast(`Complete all readiness gates and approve the mission clearance before moving to ${nextStatus}.`);
    return;
  }
  mission.status = nextStatus;
  if (["Complete", "Cancelled"].includes(nextStatus)) releaseMissionAsset(mission);
  saveState();
  renderAll();
  showToast(`${mission.title} moved to ${nextStatus}.`);
}

function openMissionCalendar(missionId) {
  const mission = missionById(missionId);
  if (!mission) return;
  calendarCursor = new Date(`${mission.start.slice(0, 7)}-01T00:00:00Z`);
  setView("calendar");
  showToast("Mission dates are shown automatically in the shared calendar.");
}

function openAssetDialog(assetId = "") {
  renderOwnerOptions();
  renderProjectOptions();
  const form = document.getElementById("asset-form");
  form.reset();
  form.dataset.editId = typeof assetId === "string" ? assetId : "";
  form.elements.custodian.value = window.CAGE_BACKEND.currentMemberId();
  form.elements.usage.value = "0";
  const existing=state.assets.find(a=>a.id===form.dataset.editId);
  if(existing) for(const [key,value] of Object.entries(existing)) if(form.elements[key] && typeof value!=="object") form.elements[key].value=value;
  document.querySelector("#asset-dialog h2").textContent=existing ? "Edit equipment" : "Add equipment";
  document.getElementById("asset-form-error").textContent = "";
  document.getElementById("asset-dialog").showModal();
}

function createAsset(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("asset-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const category = String(data.get("category") || "Aircraft");
  const project = String(data.get("project") || "");
  const asset = {
    id: event.currentTarget.dataset.editId || `as-${Date.now()}`,
    name: String(data.get("name") || "").trim(),
    category,
    tag: String(data.get("tag") || "").trim().toUpperCase(),
    custodian: String(data.get("custodian") || ""),
    status: String(data.get("status") || "Available"),
    project,
    condition: String(data.get("condition") || "Good"),
    usage: Number(data.get("usage") || 0),
    unit: category === "Battery" ? "cycles" : category === "Aircraft" ? "flight hours" : "deployments",
    nextService: String(data.get("nextService") || "")
  };
  if (!asset.name || !asset.tag || !asset.custodian) {
    document.getElementById("asset-form-error").textContent = "Add the equipment name, unique asset tag and custodian.";
    return;
  }
  if (state.assets.some(item => item.id !== asset.id && item.tag.toLowerCase() === asset.tag.toLowerCase())) {
    document.getElementById("asset-form-error").textContent = "That asset tag is already in use.";
    return;
  }
  if (asset.project && asset.status === "Available") asset.status = "Assigned";
  if (!asset.project && asset.status === "Assigned") {
    document.getElementById("asset-form-error").textContent = "Select a linked project for assigned equipment.";
    return;
  }
  const index=state.assets.findIndex(a=>a.id===asset.id);
  asset.serial=String(data.get("serial")||""); asset.location=String(data.get("location")||""); asset.notes=String(data.get("notes")||"");
  if(index>=0) state.assets[index]={...state.assets[index],...asset}; else state.assets.push(asset);
  saveState();
  document.getElementById("asset-dialog").close();
  renderAll();
  setView("assets");
  showToast("Equipment added to the live register.");
}

function changeAssetStatus(assetId, status) {
  const asset = assetById(assetId);
  if (!asset) return;
  asset.status = status;
  if (status === "Available") asset.project = "";
  if (status === "Maintenance" && asset.condition === "Excellent") asset.condition = "Monitor";
  saveState();
  renderAll();
  showToast(`${asset.name} marked ${status}.`);
}

function changeAssetProject(assetId, projectId) {
  const asset = assetById(assetId);
  if (!asset) return;
  asset.project = projectId;
  if (projectId && asset.status === "Available") asset.status = "Assigned";
  if (!projectId && asset.status === "Assigned") asset.status = "Available";
  saveState();
  renderAll();
  showToast(projectId ? `${asset.name} assigned to ${projectById(projectId)?.name || "project"}.` : `${asset.name} returned to the available pool.`);
}

function markAssetReady(assetId) {
  const asset = assetById(assetId);
  if (!asset) return;
  asset.status = "Available";
  asset.project = "";
  asset.condition = "Good";
  asset.nextService = dateAfter(asset.category === "Battery" ? 45 : 90);
  saveState();
  renderAll();
  showToast(`${asset.name} returned to service.`);
}

function openComplianceDialog() {
  renderOwnerOptions();
  const form = document.getElementById("compliance-form");
  form.reset();
  form.elements.owner.value = "alexander";
  form.elements.renewal.value = dateAfter(30);
  document.getElementById("compliance-form-error").textContent = "";
  document.getElementById("compliance-dialog").showModal();
}

function createComplianceRecord(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("compliance-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const record = {
    id: `co-${Date.now()}`,
    title: String(data.get("title") || "").trim(),
    category: String(data.get("category") || "Operating approval"),
    owner: String(data.get("owner") || ""),
    renewal: String(data.get("renewal") || ""),
    status: String(data.get("status") || "Active"),
    document: String(data.get("document") || "").trim(),
    note: String(data.get("note") || "").trim()
  };
  if (!record.title || !record.owner || !record.renewal || !record.document) {
    document.getElementById("compliance-form-error").textContent = "Add the requirement, owner, review date and supporting document reference.";
    return;
  }
  state.compliance.push(record);
  saveState();
  document.getElementById("compliance-dialog").close();
  renderAll();
  setView("compliance");
  showToast("Compliance record added with an accountable owner.");
}

function changeComplianceStatus(recordId, status) {
  const record = state.compliance.find(item => item.id === recordId);
  if (!record) return;
  record.status = status;
  saveState();
  renderAll();
  showToast(`${record.title} marked ${status}.`);
}

function markRenewalSubmitted(recordId) {
  changeComplianceStatus(recordId, "Renewal submitted");
}

function openComplianceReference(recordId) {
  const record = state.compliance.find(item => item.id === recordId);
  if (!record) return;
  try {
    const url = new URL(record.document);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported reference protocol");
    window.open(url.href, "_blank", "noopener,noreferrer");
    showToast("Compliance evidence opened in a new tab.");
  } catch {
    showToast(`Document location: ${record.document}`);
  }
}

function openApprovalDialog() {
  renderOwnerOptions();
  const form = document.getElementById("approval-form");
  form.reset();
  form.elements.requester.value = "alexander";
  form.elements.due.value = dateAfter(2);
  document.getElementById("approval-form-error").textContent = "";
  document.getElementById("approval-dialog").showModal();
}

function createApproval(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("approval-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const approval = {
    id: `ap-${Date.now()}`,
    title: String(data.get("title") || "").trim(),
    type: String(data.get("type") || "Other"),
    requester: String(data.get("requester") || ""),
    due: String(data.get("due") || ""),
    amount: Number(data.get("amount") || 0),
    summary: String(data.get("summary") || "").trim(),
    submitted: TODAY,
    status: "Pending"
  };
  if (!approval.title || !approval.requester || !approval.due || !approval.summary) {
    document.getElementById("approval-form-error").textContent = "Add the decision, requester, due date and enough context to decide.";
    return;
  }
  state.approvals.push(approval);
  saveState();
  document.getElementById("approval-dialog").close();
  renderAll();
  setView("approvals");
  showToast("Approval request added to the central inbox.");
}

function applyApprovalOutcome(item) {
  if (item.linkedType === "leave") {
    const leave = state.leaveRequests.find(record => record.id === item.linkedId);
    if (leave) leave.status = item.status === "Approved" ? "Approved" : "Pending";
  }
  if (item.linkedType === "quote") {
    const quote = state.quotes.find(record => record.id === item.linkedId);
    if (quote && item.status === "Approved") quote.status = "Approved";
  }
  if (item.linkedType === "mission") {
    const mission = missionById(item.linkedId);
    if (mission && item.status === "Approved" && missionIsReady(mission)) mission.status = "Ready";
  }
  if (item.linkedType === "request") {
    const request = requestById(item.linkedId);
    if (request) {
      request.checklist ||= {};
      request.checklist.approval = item.status === "Approved";
      request.stage = item.status === "Approved" ? "Approved to send" : "Scoping";
      request.nextAction = item.status === "Approved" ? "Send the approved offer or application and retain the submission receipt." : "Address the review feedback and resubmit for approval.";
      const quote = [...state.quotes].reverse().find(record => record.request === request.id);
      if (quote) quote.status = item.status === "Approved" ? "Approved" : "Draft";
      syncRequestLinks(request);
    }
  }
  if (item.linkedType === "commercial") {
    const record = state.commercialRecords.find(entry => entry.id === item.linkedId);
    if (record && item.status === "Approved") {
      record.stage = "Submitted";
      record.progress = Math.max(90, Number(record.progress || 0));
      record.nextAction = "Monitor the external response and record the decision.";
    }
  }
}

async function decideApproval(approvalId, decision) {
  if (!currentUserCanApprove()) {
    showToast("Only a manager or administrator can approve or return requests.");
    return;
  }
  const item = state.approvals.find(record => record.id === approvalId);
  if (!item || item.status !== "Pending") return;
  let note = decision === "Approved" ? "Approved from the CAGE decision inbox." : await window.CAGE_OPS.ask("What must be changed before this can be approved?");
  if (decision === "Returned" && !note?.trim()) {
    showToast("Add a return reason so the requester knows what to fix.");
    return;
  }
  item.status = decision;
  item.decided = TODAY;
  item.decidedBy = window.CAGE_BACKEND.currentMemberId();
  item.decisionNote = String(note || "").trim();
  applyApprovalOutcome(item);
  const approvalThread = item.linkedType === "request"
    ? item.linkedId
    : item.linkedType === "commercial"
      ? state.commercialRecords.find(record => record.id === item.linkedId)?.request
      : item.linkedType === "mission"
        ? projectById(missionById(item.linkedId)?.project)?.request
        : "";
  if (approvalThread) addSystemWorkMessage(approvalThread, `${item.type} ${decision.toLowerCase()}: ${item.title}. ${item.decisionNote}`);
  saveState();
  renderAll();
  showToast(`${item.title} ${decision === "Approved" ? "approved" : "returned with feedback"}.`);
}

function openCommercialDialog() {
  renderOwnerOptions();
  const form = document.getElementById("commercial-form");
  form.reset();
  form.elements.owner.value = "alexander";
  form.elements.deadline.value = dateAfter(14);
  form.elements.progress.value = "10";
  document.getElementById("commercial-form-error").textContent = "";
  document.getElementById("commercial-dialog").showModal();
}

function createCommercialRecord(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("commercial-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const record = {
    id: `cm-${Date.now()}`,
    title: String(data.get("title") || "").trim(),
    type: String(data.get("type") || "Tender"),
    organisation: String(data.get("organisation") || "").trim(),
    owner: String(data.get("owner") || ""),
    deadline: String(data.get("deadline") || ""),
    value: Number(data.get("value") || 0),
    stage: String(data.get("stage") || "Monitoring"),
    progress: Math.min(100, Math.max(0, Number(data.get("progress") || 0))),
    nextAction: String(data.get("nextAction") || "").trim()
  };
  if (!record.title || !record.organisation || !record.owner || !record.deadline || !record.nextAction) {
    document.getElementById("commercial-form-error").textContent = "Add the organisation, owner, deadline and one clear next action.";
    return;
  }
  state.commercialRecords.push(record);
  saveState();
  document.getElementById("commercial-dialog").close();
  renderAll();
  setView("commercial");
  showToast(`${record.type} added to the commercial register.`);
}

function changeCommercialStage(recordId, stage, control) {
  const record = state.commercialRecords.find(item => item.id === recordId);
  if (!record) return;
  const request = requestById(record.request);
  if (request) {
    const linkedStage = { Monitoring: "New", Preparing: "Scoping", "Internal review": "Internal review", Submitted: "Submitted", Negotiation: "Negotiation", Active: "Converted", Awarded: "Won / Awarded", Closed: "Lost / Declined" }[stage];
    if (linkedStage) changeRequestStage(request.id, linkedStage, control);
    else if (control) control.value = record.stage;
    return;
  }
  record.stage = stage;
  if (stage === "Awarded") record.progress = 100;
  addSystemWorkMessage(`commercial:${record.id}`, `Commercial record moved to ${stage}.`);
  saveState();
  renderAll();
  showToast(`${record.title} moved to ${stage}.`);
}

function changeCommercialProgress(recordId, progress) {
  const record = state.commercialRecords.find(item => item.id === recordId);
  if (!record) return;
  record.progress = Math.min(100, Math.max(0, Number(progress) || 0));
  saveState();
  renderAll();
  showToast(`${record.title} updated to ${record.progress}% complete.`);
}

function requestCommercialReview(recordId) {
  const record = state.commercialRecords.find(item => item.id === recordId);
  if (!record) return;
  if (record.request && requestById(record.request)) {
    requestInternalReview(record.request);
    return;
  }
  const pending = state.approvals.some(item => item.linkedType === "commercial" && item.linkedId === record.id && item.status === "Pending");
  if (pending) {
    showToast("An internal review is already awaiting a decision.");
    return;
  }
  record.stage = "Internal review";
  state.approvals.push({
    id: `ap-${Date.now()}`,
    type: "Submission",
    title: `Release ${record.title}`,
    requester: record.owner,
    submitted: TODAY,
    due: record.deadline,
    amount: record.value,
    status: "Pending",
    summary: `Review the ${record.type.toLowerCase()} requirements, scope, evidence and commercial position before external release.`,
    linkedType: "commercial",
    linkedId: record.id
  });
  saveState();
  renderAll();
  setView("approvals");
  showToast("Internal review sent to the approval inbox.");
}

const PROJECT_WORKSPACE_TABS = [
  ["overview", "Overview"], ["members", "Members"], ["files", "Files"],
  ["milestones", "Milestones"], ["tasks", "Tasks"], ["board", "Task Board"],
  ["gantt", "Gantt Chart"], ["invoices", "Invoices"], ["quotes", "Quotations"], ["expenses", "Expenses"]
];

function ensureProjectWorkspace(project) {
  if (!Array.isArray(project.team)) project.team = [project.owner].filter(Boolean);
  if (project.owner && !project.team.includes(project.owner)) project.team.unshift(project.owner);
  if (!Array.isArray(project.milestones)) project.milestones = [];
  if (!Array.isArray(project.files)) project.files = [];
}

function projectLinkedQuotes(projectId) {
  const dealIds = state.deals.filter(deal => deal.project === projectId).map(deal => deal.id);
  const requestDealIds = state.requests.filter(request => request.project === projectId && request.deal).map(request => request.deal);
  const ids = new Set([...dealIds, ...requestDealIds]);
  return state.quotes.filter(quote => ids.has(quote.deal));
}

function projectReferenceFiles(project) {
  const uploaded = project.files.map(file => ({ ...file, source: "Project upload" }));
  const taskFiles = projectTasks(project.id).filter(task => task.evidence).map(task => ({ id: `task-${task.id}`, name: task.evidence, uploaded: task.updated, source: task.title }));
  const chatFiles = state.messages.filter(message => message.project === project.id && message.attachment).map(message => ({ id: `chat-${message.id}`, name: message.attachment, path: message.attachmentPath, uploaded: message.date, source: "Work chat" }));
  const references = state.knowledge.filter(item => item.project === project.id && item.link).map(item => ({ id: `knowledge-${item.id}`, name: item.link, uploaded: item.updated, source: item.title }));
  return [...uploaded, ...taskFiles, ...chatFiles, ...references];
}

function projectTimeline(tasks) {
  if (!tasks.length) return `<div class="project-empty"><strong>No tasks to plot</strong><span>Add tasks with due dates to build the project timeline.</span></div>`;
  const dates = tasks.flatMap(task => [task.updated || task.due, task.due]).filter(Boolean).sort();
  const start = asDate(dates[0]);
  const end = asDate(dates[dates.length - 1]);
  const span = Math.max(1, Math.round((end - start) / 86400000));
  return `<div class="project-timeline-head"><span>${formatDate(dates[0], { year: true })}</span><strong>Project timeline</strong><span>${formatDate(dates[dates.length - 1], { year: true })}</span></div><div class="project-timeline">${tasks.slice().sort((a, b) => a.due.localeCompare(b.due)).map(task => {
    const taskStart = asDate(task.updated || task.due);
    const taskEnd = asDate(task.due);
    const left = Math.max(0, Math.min(96, ((taskStart - start) / 86400000) / span * 100));
    const width = Math.max(4, Math.min(100 - left, (Math.max(1, (taskEnd - taskStart) / 86400000) / span) * 100));
    return `<div class="timeline-row"><button data-task-detail="${task.id}"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(teamMember(task.owner).name)} · ${formatDate(task.due)}</span></button><div class="timeline-track"><span class="${statusClass(task.status)}" style="left:${left}%;width:${width}%" title="${escapeHtml(task.status)}"></span></div></div>`;
  }).join("")}</div>`;
}

function projectWorkspaceTab(project, context) {
  const { owner, tasks, progress, revenue, costs, invoices, quotes, events, missions, members, files } = context;
  if (activeProjectTab === "overview") return `
    <div class="project-kpi-grid"><div><span>Progress</span><strong>${progress}%</strong><small>${tasks.filter(task => task.status === "Done").length} of ${tasks.length} tasks complete</small></div><div><span>Deadline</span><strong>${formatDate(project.deadline, { year: true })}</strong><small>${projectHealth(project) === "attention" ? "Needs management attention" : "Delivery is on track"}</small></div><div><span>Project lead</span><strong>${escapeHtml(owner.name)}</strong><small>${members.length} project members</small></div><div><span>Balance</span><strong>${formatMoney(revenue - costs, true)}</strong><small>${formatMoney(revenue, true)} invoiced</small></div></div>
    <div class="project-overview-grid"><section class="project-panel"><div class="project-panel-heading"><div><span>Required outcome</span><h3>What success looks like</h3></div></div><p class="project-outcome">${escapeHtml(project.outcome)}</p><div class="project-progress-large"><div><span>Delivery progress</span><strong>${progress}%</strong></div><div class="progress-track"><span style="width:${progress}%"></span></div></div></section><section class="project-panel"><div class="project-panel-heading"><div><span>Next actions</span><h3>Upcoming work</h3></div><button data-new-task-project="${project.id}">＋ Add task</button></div><div class="project-activity-list">${tasks.filter(task => task.status !== "Done").sort((a,b) => a.due.localeCompare(b.due)).slice(0,4).map(task => `<button data-task-detail="${task.id}"><span class="status-dot ${statusClass(task.status)}"></span><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(teamMember(task.owner).name)} · Due ${formatDate(task.due)}</small></span><b>›</b></button>`).join("") || `<div class="project-empty"><strong>No outstanding tasks</strong><span>This project has no open work.</span></div>`}</div></section></div>
    <div class="project-overview-grid"><section class="project-panel"><div class="project-panel-heading"><div><span>Schedule</span><h3>Events and missions</h3></div></div><div class="project-summary-list"><span><b>${events.length}</b> calendar events</span><span><b>${missions.length}</b> field missions</span><span><b>${project.milestones.filter(item => item.complete).length}/${project.milestones.length}</b> milestones complete</span></div></section><section class="project-panel"><div class="project-panel-heading"><div><span>Financials</span><h3>Project position</h3></div></div><div class="project-summary-list"><span><b>${formatMoney(revenue, true)}</b> invoiced</span><span><b>${formatMoney(costs, true)}</b> recorded costs</span><span><b>${quotes.length}</b> linked quotations</span></div></section></div>`;

  if (activeProjectTab === "members") return `<section class="project-panel"><div class="project-panel-heading"><div><span>Project team</span><h3>${members.length} members</h3></div><div class="project-inline-action"><select id="project-member-select" aria-label="Select a member"><option value="">Add a colleague…</option>${assignableTeam().filter(member => !project.team.includes(member.id)).map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}</select><button data-add-project-member="${project.id}">＋ Add</button></div></div><div class="project-member-grid">${members.map(member => `<article><span class="owner-avatar">${member.initials}</span><div><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.role)}</small><em>${member.id === project.owner ? "Project lead" : "Project member"}</em></div>${member.id !== project.owner ? `<button data-remove-project-member="${project.id}" data-member-id="${member.id}" aria-label="Remove ${escapeHtml(member.name)}">×</button>` : ""}</article>`).join("")}</div></section>`;

  if (activeProjectTab === "files") return `<section class="project-panel"><div class="project-panel-heading"><div><span>Documents and evidence</span><h3>${files.length} project files</h3></div><label class="project-upload-button">＋ Upload file<input type="file" data-project-file-input="${project.id}" hidden></label></div><div class="project-file-list">${files.map(file => `<button ${file.path ? `data-open-project-file="${escapeHtml(file.id)}"` : ""} class="${file.path ? "" : "reference-only"}"><span class="project-file-icon">▤</span><span><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.source)}${file.uploaded ? ` · ${formatDate(file.uploaded)}` : ""}</small></span><b>${file.path ? "Open" : "Reference"}</b></button>`).join("") || `<div class="project-empty"><strong>No files recorded</strong><span>Upload a project document or attach evidence to a task.</span></div>`}</div></section>`;

  if (activeProjectTab === "milestones") return `<section class="project-panel"><div class="project-panel-heading"><div><span>Delivery checkpoints</span><h3>Milestones</h3></div><button data-add-project-milestone="${project.id}">＋ Add milestone</button></div><div class="milestone-list">${project.milestones.slice().sort((a,b) => a.due.localeCompare(b.due)).map(item => `<label class="milestone-row ${item.complete ? "complete" : ""}"><input type="checkbox" data-project-milestone-toggle="${item.id}" ${item.complete ? "checked" : ""}><span><strong>${escapeHtml(item.title)}</strong><small>Due ${formatDate(item.due, { year: true })}${Number(item.cost || 0) ? ` · Budget ${formatMoney(Number(item.cost), true)}` : ""}</small></span><em>${item.complete ? "Complete" : item.due < TODAY ? "Overdue" : "Upcoming"}</em></label>`).join("") || `<div class="project-empty"><strong>No milestones yet</strong><span>Add the major approval, delivery and completion checkpoints for this project.</span></div>`}</div></section>`;

  if (activeProjectTab === "tasks") return `<section class="project-panel"><div class="project-panel-heading"><div><span>Execution</span><h3>${tasks.length} project tasks</h3></div><button data-new-task-project="${project.id}">＋ Add task</button></div><div class="project-task-table">${tasks.slice().sort((a,b) => a.due.localeCompare(b.due)).map(task => `<div><button data-task-detail="${task.id}"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.output)}</small></button><span class="owner-chip"><span class="owner-avatar">${teamMember(task.owner).initials}</span>${escapeHtml(teamMember(task.owner).name.split(" ")[0])}</span><span class="due-date ${isOverdue(task) ? "overdue" : ""}">${formatDate(task.due)}</span><select data-task-status="${task.id}" aria-label="Status for ${escapeHtml(task.title)}">${["To Do", "Doing", "Blocked", "Done"].map(status => `<option ${status === task.status ? "selected" : ""}>${status}</option>`).join("")}</select></div>`).join("") || `<div class="project-empty"><strong>No tasks yet</strong><span>Add the first task to start tracking delivery.</span></div>`}</div></section>`;

  if (activeProjectTab === "board") return `<div class="project-board">${["To Do", "Doing", "Blocked", "Done"].map(status => `<section data-project-task-status="${status}"><div class="project-board-head"><strong>${status}</strong><span>${tasks.filter(task => task.status === status).length}</span></div><div>${tasks.filter(task => task.status === status).map(task => `<article draggable="true" data-project-task-card="${task.id}"><button data-task-detail="${task.id}">${escapeHtml(task.title)}</button><span><small>${escapeHtml(teamMember(task.owner).name.split(" ")[0])}</small><small>${formatDate(task.due)}</small></span></article>`).join("") || `<p>No cards</p>`}</div><button data-new-task-project="${project.id}">＋ Add task</button></section>`).join("")}</div><p class="project-board-hint">Drag tasks between columns. Completion evidence and blocker reasons remain required.</p>`;

  if (activeProjectTab === "gantt") return `<section class="project-panel"><div class="project-panel-heading"><div><span>Schedule visual</span><h3>Gantt Chart</h3></div><button data-new-task-project="${project.id}">＋ Add task</button></div>${projectTimeline(tasks)}</section>`;

  if (activeProjectTab === "invoices") return `<section class="project-panel"><div class="project-panel-heading"><div><span>Billing</span><h3>${invoices.length} project invoices</h3></div><button data-new-invoice-project="${project.id}">＋ Create invoice</button></div><div class="project-finance-list">${invoices.map(invoice => `<div><span><strong>${escapeHtml(invoice.number)}</strong><small>${escapeHtml(invoice.description)}</small></span><span><strong>${formatMoney(invoice.amount, true)}</strong><small>Due ${formatDate(invoice.due)}</small></span><span class="status-pill ${statusClass(invoice.status)}">${escapeHtml(invoice.status)}</span><button data-send-document="invoice" data-document-id="${invoice.id}">${invoice.sentAt ? "Resend" : "Send"}</button></div>`).join("") || `<div class="project-empty"><strong>No invoices yet</strong><span>Create the first project invoice when a billing milestone is reached.</span></div>`}</div></section>`;

  if (activeProjectTab === "quotes") return `<section class="project-panel"><div class="project-panel-heading"><div><span>Commercial record</span><h3>${quotes.length} linked quotations</h3></div>${context.primaryDeal ? `<button data-new-quote-deal="${context.primaryDeal.id}">＋ Create quotation</button>` : ""}</div><div class="project-finance-list">${quotes.map(quote => `<div><span><strong>${escapeHtml(quote.number)}</strong><small>${escapeHtml(quote.description)}</small></span><span><strong>${formatMoney(quote.amount, true)}</strong><small>Valid to ${formatDate(quote.validUntil)}</small></span><span class="status-pill ${statusClass(quote.status)}">${escapeHtml(quote.status)}</span><button data-send-document="quote" data-document-id="${quote.id}">${quote.sentAt ? "Resend" : "Send"}</button></div>`).join("") || `<div class="project-empty"><strong>No linked quotations</strong><span>${context.primaryDeal ? "Create a quotation for the linked opportunity." : "This project has no linked CRM opportunity."}</span></div>`}</div></section>`;

  return `<section class="project-panel"><div class="project-panel-heading"><div><span>Project spending</span><h3>${context.expenses.length} recorded expenses</h3></div><button data-new-project-expense="${project.id}">＋ Add expense</button></div><div class="project-expense-summary"><span><small>Total project expenses</small><strong>${formatMoney(costs, true)}</strong></span><span><small>Approved</small><strong>${formatMoney(context.expenses.filter(item => (item.status || "Pending") === "Approved").reduce((sum, item) => sum + item.amount, 0), true)}</strong></span><span><small>Pending review</small><strong>${context.expenses.filter(item => (item.status || "Pending") === "Pending").length}</strong></span></div><div class="project-expense-list">${context.expenses.slice().sort((a,b) => b.date.localeCompare(a.date)).map(expense => `<div><span><strong>${escapeHtml(expense.description)}</strong><small>${expense.receiptPath ? `<button type="button" data-open-receipt="${expense.id}">Open receipt</button> · ` : ""}${escapeHtml(expense.category)} · ${formatDate(expense.date)}${expense.receipt ? ` · ${escapeHtml(expense.receipt)}` : ""}</small></span><strong>${formatMoney(expense.amount, true)}</strong><select data-expense-status="${expense.id}" aria-label="Status for ${escapeHtml(expense.description)}">${["Pending", "Approved", "Rejected"].map(status => `<option ${status === (expense.status || "Pending") ? "selected" : ""}>${status}</option>`).join("")}</select></div>`).join("") || `<div class="project-empty"><strong>No expenses recorded</strong><span>Add field, equipment, travel or administrative costs against this project.</span></div>`}</div></section>`;
}

function renderProjectWorkspace() {
  const project = projectById(activeProjectId);
  if (!project) return;
  ensureProjectWorkspace(project);
  const owner = teamMember(project.owner);
  const tasks = projectTasks(project.id);
  const progress = projectProgress(project.id);
  const health = projectHealth(project);
  const invoices = state.invoices.filter(invoice => invoice.project === project.id);
  const expenses = state.expenses.filter(expense => expense.project === project.id);
  const revenue = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const costs = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const sourceRequest = state.requests.find(request => request.project === project.id || request.id === project.request);
  const primaryDeal = state.deals.find(deal => deal.project === project.id || deal.id === sourceRequest?.deal);
  const context = { owner, tasks, progress, revenue, costs, invoices, expenses, quotes: projectLinkedQuotes(project.id), events: state.events.filter(event => event.project === project.id), missions: state.missions.filter(mission => mission.project === project.id), members: project.team.map(teamMember), files: projectReferenceFiles(project), primaryDeal };
  document.getElementById("project-dialog-content").innerHTML = `<header class="project-workspace-header"><div><p class="section-kicker">${escapeHtml(project.category)} · ${escapeHtml(project.client)}</p><h2>${escapeHtml(project.name)}</h2><p>Led by ${escapeHtml(owner.name)} · Due ${formatDate(project.deadline, { year: true })}</p></div><div><button class="project-header-chat" data-open-project-chat="${project.id}">◌ Project chat</button><span class="status-pill ${health}">${healthLabel(health)}</span><button class="icon-button" data-close-project-workspace aria-label="Close project">×</button></div></header><nav class="project-workspace-tabs" aria-label="Project sections">${PROJECT_WORKSPACE_TABS.map(([id,label]) => `<button class="${activeProjectTab === id ? "active" : ""}" data-project-tab="${id}">${label}</button>`).join("")}</nav><main class="project-workspace-body">${projectWorkspaceTab(project, context)}</main>`;
}

function openProject(projectId) {
  const project = projectById(projectId);
  if (!project) return;
  activeProjectId = projectId;
  activeProjectTab = "overview";
  renderProjectWorkspace();
  const dialog = document.getElementById("project-dialog");
  if (!dialog.open) dialog.showModal();
}

function openMilestoneDialog(projectId) {
  const project = projectById(projectId);
  if (!project) return;
  ensureProjectWorkspace(project);
  const form = document.getElementById("milestone-form");
  form.reset();
  form.elements.projectId.value = project.id;
  form.elements.due.value = project.deadline;
  form.elements.cost.value = "0";
  document.getElementById("milestone-form-error").textContent = "";
  document.getElementById("milestone-dialog").showModal();
  requestAnimationFrame(() => form.elements.title.focus());
}

function createMilestone(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("milestone-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const project = projectById(String(data.get("projectId") || ""));
  const title = String(data.get("title") || "").trim();
  const due = String(data.get("due") || "");
  const cost = Math.max(0, Number(data.get("cost") || 0));
  if (!project || !title || !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    document.getElementById("milestone-form-error").textContent = "Add a milestone name and valid due date.";
    return;
  }
  project.milestones.push({ id: `milestone-${Date.now()}`, title, due, cost, complete: Boolean(data.get("complete")) });
  saveState();
  document.getElementById("milestone-dialog").close();
  renderAll();
  renderProjectWorkspace();
  showToast("Milestone added.");
}

async function uploadProjectFile(input) {
  const project = projectById(input.dataset.projectFileInput);
  const file = input.files?.[0];
  if (!project || !file) return;
  ensureProjectWorkspace(project);
  try {
    if (!window.CAGE_BACKEND?.uploadFile) throw new Error("Secure file storage is not connected.");
    showToast("Uploading project file…");
    const uploaded = await window.CAGE_BACKEND.uploadFile(file, "project", project.id);
    project.files.push({
      id: `project-file-${Date.now()}`,
      name: uploaded.name || file.name,
      path: uploaded.path,
      uploaded: TODAY,
      by: window.CAGE_BACKEND.currentMemberId?.() || ""
    });
    saveState();
    renderProjectWorkspace();
    showToast("File added to the project.");
  } catch (error) {
    showToast(error.message || "The project file could not be uploaded.");
  } finally {
    input.value = "";
  }
}

function openTask(taskId) {
  openTaskDialog("", taskId);
}

async function changeTaskStatus(taskId, nextStatus, control) {
  let task = state.tasks.find(item => item.id === taskId);
  if (!task) return;
  const previous = task.status;
  if (nextStatus === "Blocked" && !task.blocker) {
    const reason = await window.CAGE_OPS.ask("What is preventing this task from progressing?");
    if (!reason?.trim()) {
      if (control) control.value = previous;
      showToast("A blocker reason is required.");
      return;
    }
    task=state.tasks.find(t=>t.id===taskId);if(!task)return;
    task.blocker = reason.trim();
  }
  if (nextStatus === "Done" && state.settings.requireTaskEvidence !== false && !task.evidence) {
    const evidence = await window.CAGE_OPS.ask("Add a completion note, file name or evidence link before closing this task.",{task:task.id});
    if (!evidence?.trim()) {
      if (control) control.value = previous;
      showToast("Completion evidence is required.");
      return;
    }
    task=state.tasks.find(t=>t.id===taskId);if(!task)return;
    task=state.tasks.find(t=>t.id===taskId);if(!task)return;
  task.evidence = evidence.trim();
  }
  task.status = nextStatus;
  const matchingList = state.boardLists.find(list => list.status === nextStatus);
  if (matchingList) task.list = matchingList.id;
  if (nextStatus !== "Blocked") delete task.blocker;
  task.updated = TODAY;
  saveState();
  renderAll();
  if (document.getElementById("project-dialog").open && activeProjectId === task.project) renderProjectWorkspace();
  showToast(`${task.title} moved to ${nextStatus}.`);
}

function openTaskDialog(projectId = "", taskId = "") {
  renderOwnerOptions();
  renderProjectOptions();
  const form = document.getElementById("task-form");
  form.reset();
  editingTaskId = typeof taskId === "string" ? taskId : "";
  const task = state.tasks.find(item => item.id === editingTaskId);
  document.getElementById("task-dialog-kicker").textContent = task ? "Card details" : "New work item";
  document.getElementById("task-dialog-title").textContent = task ? "Edit card" : "Add task";
  document.getElementById("save-task-button").textContent = task ? "Save changes" : "Create task";
  if (task) {
    form.elements.title.value = task.title;
    form.elements.output.value = task.output;
    form.elements.project.value = task.project;
    form.elements.owner.value = task.owner;
    form.elements.due.value = task.due;
    form.elements.priority.value = task.priority;
    form.elements.status.value = task.status;
    form.elements.blocker.value = task.blocker || "";
    form.elements.evidence.value = task.evidence || "";
  } else {
    form.elements.owner.value = state.settings.defaultOwner || "alexander";
    if (typeof projectId === "string" && projectId) form.elements.project.value = projectId;
  }
  document.getElementById("blocker-field").hidden = form.elements.status.value !== "Blocked";
  document.getElementById("blocker-field").querySelector("input").required = form.elements.status.value === "Blocked";
  document.getElementById("task-form-error").textContent = "";
  document.getElementById("task-dialog").showModal();
}

function createTask(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("task-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const title = String(data.get("title") || "").trim();
  const output = String(data.get("output") || "").trim();
  const project = String(data.get("project") || "");
  const owner = String(data.get("owner") || "");
  const due = String(data.get("due") || "");
  const status = String(data.get("status") || "To Do");
  const blocker = String(data.get("blocker") || "").trim();
  if (!title || !output || !project || !owner || !due) {
    document.getElementById("task-form-error").textContent = "Complete every required field before creating the task.";
    return;
  }
  if (status === "Blocked" && !blocker) {
    document.getElementById("task-form-error").textContent = "A blocked task must include the blocker reason.";
    return;
  }
  const evidence = String(data.get("evidence") || "").trim();
  if (status === "Done" && !evidence) {
    document.getElementById("task-form-error").textContent = "Completion evidence is required before moving a card to Done.";
    return;
  }
  const matchingList = state.boardLists.find(list => list.status === status);
  const existing = state.tasks.find(item => item.id === editingTaskId);
  if (existing) {
    const previousStatus = existing.status;
    Object.assign(existing, { project, title, owner, due, priority: String(data.get("priority") || "Medium"), status, output, blocker: status === "Blocked" ? blocker : undefined, evidence, updated: TODAY });
    if (matchingList && status !== previousStatus) existing.list = matchingList.id;
  } else {
    state.tasks.push({ id: `t-${Date.now()}`, project, title, owner, due, priority: String(data.get("priority") || "Medium"), status, list: matchingList?.id, output, blocker: status === "Blocked" ? blocker : undefined, evidence, updated: TODAY });
  }
  const savedTask=existing||state.tasks[state.tasks.length-1];Object.assign(savedTask,window.CAGE_OPS?.taskFields()||{});
  saveState();
  document.getElementById("task-dialog").close();
  renderAll();
  setView("tasks");
  showToast(existing ? "Card details updated." : "Task created with an owner, deadline and clear output.");
  editingTaskId = "";
}

function openProjectDialog(dealId = "") {
  renderOwnerOptions();
  const form = document.getElementById("project-form");
  form.reset();
  form.dataset.dealId = typeof dealId === "string" ? dealId : "";
  const deal = dealById(form.dataset.dealId);
  if (deal) {
    const due = new Date(`${deal.nextAction}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 30);
    form.elements.name.value = deal.name;
    form.elements.client.value = deal.company;
    form.elements.owner.value = deal.owner;
    form.elements.deadline.value = due.toISOString().slice(0, 10);
    form.elements.category.value = /farm|agri/i.test(deal.name) ? "Agriculture" : /hire/i.test(deal.name) ? "Equipment Hire" : "Mapping & Data";
    form.elements.outcome.value = `Deliver the agreed ${deal.name.toLowerCase()} scope for ${deal.company}, with completion evidence and client acceptance.`;
  }
  document.getElementById("project-form-error").textContent = "";
  document.getElementById("new-project-dialog").showModal();
}

function createProject(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("new-project-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const project = {
    createdBy:window.CAGE_BACKEND.currentMemberId(),
    id: `p-${Date.now()}`,
    name: String(data.get("name") || "").trim(),
    client: String(data.get("client") || "").trim(),
    owner: String(data.get("owner") || ""),
    team: [String(data.get("owner") || "")],
    deadline: String(data.get("deadline") || ""),
    category: String(data.get("category") || ""),
    outcome: String(data.get("outcome") || "").trim()
  };
  if (!project.name || !project.client || !project.owner || !project.deadline || !project.category || !project.outcome) {
    document.getElementById("project-form-error").textContent = "Every project needs a client, lead, deadline and required outcome.";
    return;
  }
  state.projects.push(project);
  const sourceDeal = dealById(event.currentTarget.dataset.dealId);
  if (sourceDeal) {
    sourceDeal.project = project.id;
    sourceDeal.stage = "Won";
    sourceDeal.probability = 100;
    sourceDeal.nextStep = "Deliver the linked project and prepare billing";
  }
  event.currentTarget.dataset.dealId = "";
  saveState();
  document.getElementById("new-project-dialog").close();
  renderAll();
  setView("projects");
  showToast("Project created. Add tasks to calculate its progress.");
}

function openDealDialog(dealId = "") {
  renderOwnerOptions();
  const form = document.getElementById("deal-form");
  form.reset();
  editingDealId = dealId;
  const deal = dealById(dealId);
  document.getElementById("deal-dialog-kicker").textContent = deal ? "Opportunity details" : "Proactive sales lead";
  document.getElementById("deal-dialog-title").textContent = deal ? "Edit opportunity" : "New opportunity";
  document.getElementById("save-deal-button").textContent = deal ? "Save changes" : "Create opportunity";
  if (deal) {
    ["name", "company", "owner", "value", "stage", "probability", "nextAction", "nextStep"].forEach(field => {
      form.elements[field].value = deal[field] ?? "";
    });
  } else {
    form.elements.nextAction.value = dateAfter(7);
    form.elements.owner.value = window.CAGE_BACKEND?.currentMemberId?.() || "alexander";
    form.elements.stage.value = "Prospect";
    form.elements.probability.value = "20";
  }
  document.getElementById("deal-form-error").textContent = "";
  document.getElementById("deal-dialog").showModal();
}

function createDeal(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("deal-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const existing = dealById(editingDealId);
  const deal = {
    id: existing?.id || `d-${Date.now()}`,
    name: String(data.get("name") || "").trim(),
    company: String(data.get("company") || "").trim(),
    owner: String(data.get("owner") || ""),
    value: Number(data.get("value") || 0),
    stage: String(data.get("stage") || "Prospect"),
    probability: Number(data.get("probability") || 20),
    nextAction: String(data.get("nextAction") || ""),
    nextStep: String(data.get("nextStep") || "").trim(),
    project: existing?.project || ""
  };
  if (!deal.name || !deal.company || !deal.owner || !deal.value || !deal.nextAction || !deal.nextStep) {
    document.getElementById("deal-form-error").textContent = "Complete the organisation, value, owner and next action.";
    return;
  }
  if (deal.stage === "Won") deal.probability = 100;
  if (existing) {
    const index = state.deals.findIndex(item => item.id === existing.id);
    state.deals[index] = deal;
    addSystemWorkMessage(`deal:${deal.id}`, `Opportunity details updated. ${teamMember(deal.owner).name} owns the next action.`);
  } else {
    state.deals.push(deal);
    addSystemWorkMessage(`deal:${deal.id}`, `Proactive opportunity created in ${deal.stage}. ${teamMember(deal.owner).name} owns the next action.`);
  }
  if (!contactByCompany(deal.company)) {
    state.contacts.push({ id: `c-${Date.now()}`, company: deal.company, contact: "New relationship", relationship: deal.stage === "Won" ? "Client" : "Prospect", owner: deal.owner, lastActivity: TODAY, nextAction: deal.nextAction, note: deal.nextStep });
  }
  saveState();
  editingDealId = "";
  document.getElementById("deal-dialog").close();
  renderAll();
  setView("crm");
  showToast(existing ? "Opportunity changes saved." : "Opportunity added to the sales pipeline.");
}

function changeDealStage(dealId, stage) {
  const deal = dealById(dealId);
  if (!deal) return;
  const previous = deal.stage;
  if (previous === stage) return;
  deal.stage = stage;
  if (stage === "Won") deal.probability = 100;
  if (stage === "Lost") deal.probability = 0;
  const contact = contactByCompany(deal.company);
  if (contact && stage === "Won") contact.relationship = "Client";
  const threadId = state.requests.find(request => request.deal === deal.id)?.id || `deal:${deal.id}`;
  addSystemWorkMessage(threadId, `CRM stage moved from ${previous} to ${stage}.`);
  saveState();
  renderAll();
  showToast(stage === "Won" && !deal.project ? "Opportunity won. Create its delivery project from the card." : `${deal.name} moved to ${stage}.`);
}

function openEventDialog(options = {}) {
  renderOwnerOptions();
  renderProjectOptions();
  const form = document.getElementById("event-form");
  form.reset();
  form.elements.date.value = options.date || TODAY;
  form.elements.start.value = options.start || "09:00";
  form.elements.end.value = options.end || "10:00";
  form.elements.owner.value = options.owner || "alexander";
  form.elements.project.value = options.project || "";
  form.elements.title.value = options.title || "";
  form.elements.attendees.value = options.attendees || "";
  document.getElementById("event-form-error").textContent = "";
  document.getElementById("event-dialog").showModal();
}

function createEvent(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("event-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const calendarEvent = {
    id: `ev-${Date.now()}`,
    title: String(data.get("title") || "").trim(),
    date: String(data.get("date") || ""),
    start: String(data.get("start") || ""),
    end: String(data.get("end") || ""),
    type: String(data.get("type") || "Meeting"),
    owner: String(data.get("owner") || ""),
    project: String(data.get("project") || ""),
    attendees: String(data.get("attendees") || "").trim()
  };
  if (!calendarEvent.title || !calendarEvent.date || !calendarEvent.start || !calendarEvent.end || !calendarEvent.owner) {
    document.getElementById("event-form-error").textContent = "Add a title, date, time and accountable owner.";
    return;
  }
  if (calendarEvent.end <= calendarEvent.start) {
    document.getElementById("event-form-error").textContent = "The end time must be after the start time.";
    return;
  }
  state.events.push(calendarEvent);
  saveState();
  calendarCursor = new Date(`${calendarEvent.date.slice(0, 7)}-01T00:00:00Z`);
  document.getElementById("event-dialog").close();
  renderAll();
  setView("calendar");
  showToast("Event added to the shared calendar.");
}

function openInvoiceDialog(projectId = "") {
  renderProjectOptions();
  const form = document.getElementById("invoice-form");
  form.reset();
  delete form.dataset.pendingInvoiceId;
  delete form.dataset.pendingInvoiceNumber;
  const due = new Date(`${TODAY}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + 14);
  form.elements.issued.value = TODAY;
  form.elements.due.value = due.toISOString().slice(0, 10);
  if (typeof projectId === "string" && projectId) {
    const project = projectById(projectId);
    form.elements.project.value = projectId;
    form.elements.client.value = project?.client || "";
    form.elements.description.value = project ? `${project.name} project milestone` : "";
  }
  document.getElementById("invoice-form-error").textContent = "";
  document.getElementById("invoice-dialog").showModal();
}

function nextInvoiceNumber() {
  const max = Math.max(26000, ...state.invoices.map(invoice => Number(String(invoice.number).replace(/\D/g, "")) || 0));
  return `INV-${max + 1}`;
}

async function createInvoice(event) {
  event.preventDefault();
  const submittingForm=event.currentTarget;
  if(submittingForm.dataset.submitting) return;
  submittingForm.dataset.submitting="true";
  const actionButton=event.submitter;
  if(actionButton) actionButton.disabled=true;
  try {
  if (event.submitter?.value === "cancel") {
    document.getElementById("invoice-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const invoice = {
    createdBy:window.CAGE_BACKEND.currentMemberId(),
    id: submittingForm.dataset.pendingInvoiceId ||= `inv-${Date.now()}`,
    number: submittingForm.dataset.pendingInvoiceNumber ||= nextInvoiceNumber(),
    client: String(data.get("client") || "").trim(),
    project: String(data.get("project") || ""),
    issued: String(data.get("issued") || ""),
    due: String(data.get("due") || ""),
    amount: Number(data.get("amount") || 0),
    status: String(data.get("status") || "Draft"),
    recipient: String(data.get("recipient") || "").trim(),
    description: String(data.get("description") || "").trim()
  };
  try { Object.assign(invoice,window.CAGE_DOCUMENTS.fields(event.currentTarget)); } catch(error) { document.getElementById("invoice-form-error").textContent=error.message; return; }
  if (!invoice.client || !invoice.project || !invoice.issued || !invoice.due || !invoice.amount || !invoice.recipient || !invoice.description) {
    document.getElementById("invoice-form-error").textContent = "Complete the client, recipient, project, dates, amount and description.";
    return;
  }
  if (invoice.due < invoice.issued) {
    document.getElementById("invoice-form-error").textContent = "The due date cannot be before the issue date.";
    return;
  }
  if (invoice.status === "Paid") invoice.paid = invoice.issued;
  if (data.get("sendNow") && invoice.status !== "Paid") {
    try {
      await window.CAGE_BACKEND.sendDocument({
        type: "invoice", record: invoice, recipient: invoice.recipient,
        subject: `Invoice ${invoice.number} from CAGE`,
        message: `Hello,\n\nPlease find CAGE invoice ${invoice.number} for ${invoice.description}.\n\nKind regards,\nCAGE`
      });
    } catch (error) {
      document.getElementById("invoice-form-error").textContent = error.message || "The invoice could not be emailed.";
      return;
    }
    invoice.status = "Sent";
    invoice.sentAt = new Date().toISOString();
    invoice.automaticFollowUp = true;
  }
  const savedInvoice=state.invoices.find(i=>i.id===invoice.id);if(savedInvoice)Object.assign(savedInvoice,invoice);else state.invoices.push(invoice);
  saveState();
  document.getElementById("invoice-dialog").close();
  renderAll();
  setView("finance");
  showToast(invoice.sentAt ? `${invoice.number} created and sent to ${invoice.recipient}.` : `${invoice.number} created and linked to the project.`);
  } finally {
    delete submittingForm.dataset.submitting;
    if(actionButton) actionButton.disabled=false;
  }
}

function changeInvoiceStatus(invoiceId, status) {
  const invoice = state.invoices.find(item => item.id === invoiceId);
  if (!invoice) return;
  invoice.status = status;
  if (status === "Paid") invoice.paid = TODAY;
  else delete invoice.paid;
  saveState();
  renderAll();
  showToast(`${invoice.number} marked ${status}.`);
}

function openQuoteDialog(dealId = "") {
  renderProjectOptions();
  const form = document.getElementById("quote-form");
  form.reset();
  form.dataset.requestId = "";
  const validUntil = asDate(TODAY);
  validUntil.setUTCDate(validUntil.getUTCDate() + 21);
  form.elements.issued.value = TODAY;
  form.elements.validUntil.value = validUntil.toISOString().slice(0, 10);
  if (typeof dealId === "string" && dealId) {
    const deal = dealById(dealId);
    form.elements.deal.value = dealId;
    form.elements.client.value = deal?.company || "";
    form.elements.amount.value = deal?.value || "";
    form.elements.description.value = deal?.name || "";
  }
  document.getElementById("quote-form-error").textContent = "";
  document.getElementById("quote-dialog").showModal();
}

function nextQuoteNumber() {
  const max = Math.max(26000, ...state.quotes.map(quote => Number(String(quote.number).replace(/\D/g, "")) || 0));
  return `Q-${max + 1}`;
}

async function createQuote(event) {
  event.preventDefault();
  const submittingForm=event.currentTarget;
  if(submittingForm.dataset.submitting) return;
  submittingForm.dataset.submitting="true";
  const actionButton=event.submitter;
  if(actionButton) actionButton.disabled=true;
  try {
  const quoteForm = event.currentTarget;
  if (event.submitter?.value === "cancel") {
    document.getElementById("quote-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const requestId = event.currentTarget.dataset.requestId || "";
  const quote = {
    createdBy:window.CAGE_BACKEND.currentMemberId(),
    id: `q-${Date.now()}`,
    number: nextQuoteNumber(),
    client: String(data.get("client") || "").trim(),
    deal: String(data.get("deal") || ""),
    issued: String(data.get("issued") || ""),
    validUntil: String(data.get("validUntil") || ""),
    amount: Number(data.get("amount") || 0),
    status: String(data.get("status") || "Draft"),
    recipient: String(data.get("recipient") || "").trim(),
    description: String(data.get("description") || "").trim(),
    request: requestId
  };
  try { Object.assign(quote,window.CAGE_DOCUMENTS.fields(event.currentTarget)); } catch(error) { document.getElementById("quote-form-error").textContent=error.message; return; }
  if(quote.status === "Approved" && !currentUserCanApprove()) { document.getElementById("quote-form-error").textContent="A manager or administrator must approve quotations. Save this as a draft."; return; }
  if (!quote.client || !quote.issued || !quote.validUntil || !quote.amount || !quote.recipient || !quote.description) {
    document.getElementById("quote-form-error").textContent = "Complete the client, recipient, dates, amount and scope summary.";
    return;
  }
  if (quote.validUntil < quote.issued) {
    document.getElementById("quote-form-error").textContent = "The validity date cannot be before the issue date.";
    return;
  }
  if (data.get("sendNow") && !requestId) {
    if (quote.status !== "Approved") {
      document.getElementById("quote-form-error").textContent = "Set the standalone quote to Approved before sending it.";
      return;
    }
    try {
      await window.CAGE_BACKEND.sendDocument({
        type: "quote", record: quote, recipient: quote.recipient,
        subject: `Quotation ${quote.number} from CAGE`,
        message: `Hello,\n\nPlease find CAGE quotation ${quote.number} for ${quote.description}.\n\nKind regards,\nCAGE`
      });
    } catch (error) {
      document.getElementById("quote-form-error").textContent = error.message || "The quotation could not be emailed.";
      return;
    }
    quote.status = "Sent";
    quote.sentAt = new Date().toISOString();
    quote.automaticFollowUp = true;
  }
  if (requestId && (!currentUserCanSelfApprove() || (!requestById(requestId) || !requestPreReviewComplete(requestById(requestId))))) quote.status = "Draft";
  const savedQuote=state.quotes.find(q=>q.id===quote.id);if(savedQuote)Object.assign(savedQuote,quote);else state.quotes.push(quote);
  if(quote.status==='Approved'&&requestId&&currentUserCanSelfApprove()){
    const request=requestById(requestId);request.quote=quote.id;
    const approval={id:'ap-'+crypto.randomUUID(),type:'Quote',title:'Approve '+quote.number,requester:window.CAGE_BACKEND.currentMemberId(),submitted:TODAY,decided:TODAY,decidedBy:window.CAGE_BACKEND.currentMemberId(),due:dateAfter(1),amount:quote.amount,status:'Approved',summary:quote.description,decisionNote:'Approved by the authorised administrator.',linkedType:'request',linkedId:requestId};
    state.approvals.push(approval);applyApprovalOutcome(approval);
  }
  if (quote.status === "Draft") {
    const linkedRequest = requestById(requestId);
    if (linkedRequest) {
      linkedRequest.quote = quote.id;
      if (requestPreReviewComplete(linkedRequest)) {
        linkedRequest.stage = "Internal review";
        linkedRequest.nextAction = `Await approval of ${quote.number} before sending it to ${linkedRequest.organisation}.`;
      } else {
        linkedRequest.stage = "Scoping";
        linkedRequest.nextAction = `Complete the remaining scope controls, then submit ${quote.number} for approval.`;
      }
      syncRequestLinks(linkedRequest);
    }
    if (!linkedRequest || requestPreReviewComplete(linkedRequest)) {
      state.approvals.push({
        id: `ap-${Date.now() + 1}`,
        type: "Quote",
        title: `Approve ${quote.number} for ${quote.client}`,
        requester:window.CAGE_BACKEND.currentMemberId(),
        submitted: TODAY,
        due: dateAfter(1),
        amount: quote.amount,
        status: "Pending",
        summary: quote.description,
        linkedType: linkedRequest ? "request" : "quote",
        linkedId: linkedRequest ? linkedRequest.id : quote.id
      });
    }
  }
  saveState();
  document.getElementById("quote-dialog").close();
  renderAll();
  setView("finance");
  quoteForm.dataset.requestId = "";
  const linkedRequest = requestById(requestId);
  showToast(quote.sentAt ? `${quote.number} created and sent to ${quote.recipient}.` : quote.status === "Approved" ? `${quote.number} approved and ready to send.` : requestId && linkedRequest && requestPreReviewComplete(linkedRequest) ? `${quote.number} created and sent for internal approval.` : requestId ? `${quote.number} saved as a draft; complete the request controls before approval.` : `${quote.number} created.`);
  } finally {
    delete submittingForm.dataset.submitting;
    if(actionButton) actionButton.disabled=false;
  }
}

function openSendDocument(type, id) {
  const collection = type === "quote" ? state.quotes : state.invoices;
  const documentRecord = collection.find(item => item.id === id);
  if (!documentRecord) return;
  sendingDocument = { type, id };
  const form = document.getElementById("send-form");
  form.reset();
  form.elements.documentType.value = type;
  form.elements.documentId.value = id;
  form.elements.recipient.value = documentRecord.recipient || "";
  form.elements.subject.value = `${type === "quote" ? "Quotation" : "Invoice"} ${documentRecord.number} from CAGE`;
  form.elements.message.value = type === "quote" ? `Hello,\n\nPlease find CAGE quotation ${documentRecord.number} for ${documentRecord.description}.\n\nKind regards,\nCAGE` : `Hello,\n\nPlease find CAGE invoice ${documentRecord.number} for ${documentRecord.description}.\n\nKind regards,\nCAGE`;
  form.elements.automaticFollowUp.checked = documentRecord.automaticFollowUp !== false;
  document.getElementById("send-dialog-title").textContent = `Send ${documentRecord.number}`;
  document.getElementById("send-document-preview").innerHTML = `<strong>${escapeHtml(documentRecord.number)} · ${formatMoney(documentRecord.amount)}</strong><span>${escapeHtml(documentRecord.client)} · ${escapeHtml(documentRecord.description)}</span>`;
  document.getElementById("send-form-error").textContent = "";
  document.getElementById("send-dialog").showModal();
}

async function sendDocument(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("send-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const type = String(data.get("documentType") || sendingDocument?.type || "");
  const id = String(data.get("documentId") || sendingDocument?.id || "");
  const collection = type === "quote" ? state.quotes : state.invoices;
  const documentRecord = collection.find(item => item.id === id);
  const recipient = String(data.get("recipient") || "").trim();
  const subject = String(data.get("subject") || "").trim();
  const message = String(data.get("message") || "").trim();
  if (!documentRecord || !recipient || !subject) {
    document.getElementById("send-form-error").textContent = "Add a recipient and subject before sending.";
    return;
  }
  if (type === "quote" && documentRecord.status === "Draft") {
    document.getElementById("send-form-error").textContent = "This quote must be approved before it can be sent.";
    return;
  }
  if (type === "quote" && documentRecord.request) {
    const request = requestById(documentRecord.request);
    if (request && !requestHasApprovedReview(request)) {
      document.getElementById("send-form-error").textContent = "This quote must be approved in the decision inbox before it can be sent.";
      return;
    }
    if (request) {
      request.checklist ||= {};
      request.checklist.submission = true;
      request.stage = "Submitted";
      request.nextAction = "Confirm receipt and record the client decision or negotiation.";
    }
  }
  const submitButton = event.submitter;
  if (submitButton) submitButton.disabled = true;
  try {
    if (window.CAGE_BACKEND?.isProduction()) {
      await window.CAGE_BACKEND.sendDocument({ type, record: documentRecord, recipient, subject, message });
    }
  } catch (error) {
    document.getElementById("send-form-error").textContent = error.message || "The email could not be sent. Try again.";
    if (submitButton) submitButton.disabled = false;
    return;
  }
  if (submitButton) submitButton.disabled = false;
  documentRecord.recipient = recipient;
  documentRecord.sentAt = new Date().toISOString();
  documentRecord.automaticFollowUp = Boolean(data.get("automaticFollowUp"));
  if (type === "quote") documentRecord.status = "Sent";
  if (type === "invoice" && documentRecord.status !== "Paid") documentRecord.status = "Sent";
  saveState();
  document.getElementById("send-dialog").close();
  sendingDocument = null;
  renderAll();
  showToast(`${documentRecord.number} sent to ${recipient}.`);
}

function openExpenseDialog(projectId = "") {
  renderProjectOptions();
  const form = document.getElementById("expense-form");
  form.reset();
  form.elements.date.value = TODAY;
  if (typeof projectId === "string" && projectId) form.elements.project.value = projectId;
  document.getElementById("expense-form-error").textContent = "";
  document.getElementById("expense-dialog").showModal();
}

async function createExpense(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("expense-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const expense = {
    createdBy:window.CAGE_BACKEND.currentMemberId(),
    id: `ex-${Date.now()}`,
    description: String(data.get("description") || "").trim(),
    project: String(data.get("project") || ""),
    category: String(data.get("category") || ""),
    date: String(data.get("date") || ""),
    amount: Number(data.get("amount") || 0),
    receipt: String(data.get("receipt") || "").trim(),
    status: "Pending"
  };
  if (!expense.description || !expense.project || !expense.category || !expense.date || !expense.amount) {
    document.getElementById("expense-form-error").textContent = "Complete the project, date, amount and expense description.";
    return;
  }
  const file = data.get("receiptFile");
  const submit=event.submitter;
  if(file?.size) {
    if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(file.type) || file.size > 20*1024*1024) { document.getElementById("expense-form-error").textContent="Choose a PDF or receipt image up to 20 MB."; return; }
    try { if(submit) submit.disabled=true; const upload=await window.CAGE_BACKEND.uploadFile(file,"expense",expense.id); expense.receiptPath=upload.path; expense.receipt=upload.name; }
    catch(error) { document.getElementById("expense-form-error").textContent=error.message; return; }
    finally { if(submit) submit.disabled=false; }
  }
  expense.owner=window.CAGE_BACKEND.currentMemberId();
  state.expenses.push(expense);
  saveState();
  document.getElementById("expense-dialog").close();
  renderAll();
  if (document.getElementById("project-dialog").open && activeProjectId === expense.project) {
    activeProjectTab = "expenses";
    renderProjectWorkspace();
  } else {
    setView("finance");
  }
  showToast("Expense recorded against the project.");
}

function changeExpenseStatus(expenseId, status) {
  const expense = state.expenses.find(item => item.id === expenseId);
  if (!expense || !["Pending", "Approved", "Rejected"].includes(status)) return;
  if(!currentUserCanApprove()) { showToast("Only a manager or administrator can approve expenses."); renderAll(); return; }
  expense.status = status;
  saveState();
  renderAll();
  if (document.getElementById("project-dialog").open && activeProjectId === expense.project) renderProjectWorkspace();
  showToast(`Expense marked ${status.toLowerCase()}.`);
}

function openLeaveDialog() {
  renderOwnerOptions();
  const form = document.getElementById("leave-form");
  form.reset();
  form.elements.person.value = "alexander";
  form.elements.start.value = TODAY;
  form.elements.end.value = TODAY;
  document.getElementById("leave-form-error").textContent = "";
  document.getElementById("leave-dialog").showModal();
}

function createLeaveRequest(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("leave-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const request = {
    id: `lv-${Date.now()}`,
    person: String(data.get("person") || ""),
    type: String(data.get("type") || "Annual leave"),
    start: String(data.get("start") || ""),
    end: String(data.get("end") || ""),
    handover: String(data.get("handover") || "").trim(),
    status: "Pending",
    submitted: TODAY
  };
  if (!request.person || !request.start || !request.end || !request.handover) {
    document.getElementById("leave-form-error").textContent = "Select the team member, dates and a clear handover plan.";
    return;
  }
  if (request.end < request.start) {
    document.getElementById("leave-form-error").textContent = "The end date cannot be before the start date.";
    return;
  }
  const overlaps = state.leaveRequests.some(item => item.person === request.person && item.status !== "Rejected" && request.start <= item.end && request.end >= item.start);
  if (overlaps) {
    document.getElementById("leave-form-error").textContent = "This team member already has a leave request covering those dates.";
    return;
  }
  state.leaveRequests.push(request);
  state.approvals.push({
    id: `ap-${Date.now() + 1}`,
    type: "Leave",
    title: `${teamMember(request.person).name} ${request.type.toLowerCase()} — ${formatDate(request.start)} to ${formatDate(request.end)}`,
    requester: request.person,
    submitted: TODAY,
    due: dateAfter(3),
    amount: 0,
    status: "Pending",
    summary: request.handover,
    linkedType: "leave",
    linkedId: request.id
  });
  saveState();
  document.getElementById("leave-dialog").close();
  renderAll();
  setView("leave");
  showToast("Leave request sent to the central approval inbox.");
}

function changeLeaveStatus(requestId, status) {
  if(!currentUserCanApprove()){showToast("Only a manager or administrator can decide leave.");renderLeave();return;}
  const request = state.leaveRequests.find(item => item.id === requestId);
  if (!request) return;
  request.status = status;
  const linkedApproval = state.approvals.find(item => item.linkedType === "leave" && item.linkedId === requestId && item.status === "Pending");
  if (linkedApproval && status !== "Pending") {
    linkedApproval.status = status === "Approved" ? "Approved" : "Returned";
    linkedApproval.decided = TODAY;
    linkedApproval.decisionNote = status === "Approved" ? "Approved from the leave register." : "Leave request rejected from the leave register.";
  }
  saveState();
  renderAll();
  showToast(`${teamMember(request.person).name}’s leave was ${status.toLowerCase()}.`);
}

function openKnowledgeDialog() {
  renderOwnerOptions();
  renderProjectOptions();
  const form = document.getElementById("knowledge-form");
  form.reset();
  form.elements.owner.value = "alexander";
  document.getElementById("knowledge-form-error").textContent = "";
  document.getElementById("knowledge-dialog").showModal();
}

function createKnowledgeReference(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    document.getElementById("knowledge-dialog").close();
    return;
  }
  const data = new FormData(event.currentTarget);
  const item = {
    id: `kb-${Date.now()}`,
    title: String(data.get("title") || "").trim(),
    category: String(data.get("category") || "SOP"),
    owner: String(data.get("owner") || ""),
    project: String(data.get("project") || ""),
    link: String(data.get("link") || "").trim(),
    summary: String(data.get("summary") || "").trim(),
    updated: TODAY,
    pinned: Boolean(data.get("pinned"))
  };
  if (!item.title || !item.owner || !item.link || !item.summary) {
    document.getElementById("knowledge-form-error").textContent = "Add a title, owner, reference link and short summary.";
    return;
  }
  state.knowledge.push(item);
  saveState();
  document.getElementById("knowledge-dialog").close();
  renderAll();
  setView("knowledge");
  showToast("Reference added to the knowledge centre.");
}

function toggleKnowledgePin(itemId) {
  const item = state.knowledge.find(reference => reference.id === itemId);
  if (!item) return;
  item.pinned = !item.pinned;
  saveState();
  renderKnowledge();
  showToast(item.pinned ? "Reference pinned." : "Reference unpinned.");
}

function openKnowledgeReference(itemId) {
  const item = state.knowledge.find(reference => reference.id === itemId);
  if (!item) return;
  try {
    const url = new URL(item.link);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported reference protocol");
    window.open(url.href, "_blank", "noopener,noreferrer");
    showToast("Reference opened in a new tab.");
  } catch {
    showToast(`Reference location: ${item.link}`);
  }
}

function findGlobalSearchResults(query) {
  const value = String(query || "").trim().toLowerCase();
  if (!value) return [];
  const results = [];
  state.requests.forEach(request => { if (`${request.number} ${request.title} ${request.organisation} ${request.contact} ${request.type} ${request.summary}`.toLowerCase().includes(value)) results.push({ type: "Request", id: request.id, title: request.title, detail: `${request.number} · ${request.stage}`, view: "requests", icon: "RQ" }); });
  state.projects.forEach(project => { if (`${project.name} ${project.client} ${project.category}`.toLowerCase().includes(value)) results.push({ type: "Project", id: project.id, title: project.name, detail: project.client, view: "projects", icon: "PR" }); });
  state.tasks.forEach(task => { if (`${task.title} ${task.output} ${projectById(task.project)?.name || ""}`.toLowerCase().includes(value)) results.push({ type: "Task", id: task.id, title: task.title, detail: `${teamMember(task.owner).name} · ${task.status}`, view: "tasks", icon: "TK" }); });
  state.contacts.forEach(contact => { if (`${contact.company} ${contact.contact} ${contact.note}`.toLowerCase().includes(value)) results.push({ type: "Organisation", id: contact.id, title: contact.company, detail: contact.note, view: "crm", icon: "CR" }); });
  state.deals.forEach(deal => { if (`${deal.name} ${deal.company} ${deal.nextStep}`.toLowerCase().includes(value)) results.push({ type: "Opportunity", id: deal.id, title: deal.name, detail: `${deal.company} · ${formatMoney(deal.value, true)}`, view: "crm", icon: "SL" }); });
  state.events.forEach(event => { if (`${event.title} ${event.attendees}`.toLowerCase().includes(value)) results.push({ type: "Calendar", id: event.id, title: event.title, detail: `${formatDate(event.date)} · ${event.start}`, view: "calendar", icon: "CA" }); });
  state.invoices.forEach(invoice => { if (`${invoice.number} ${invoice.client} ${invoice.description}`.toLowerCase().includes(value)) results.push({ type: "Invoice", id: invoice.id, title: `${invoice.number} · ${invoice.client}`, detail: `${formatMoney(invoice.amount)} · ${effectiveInvoiceStatus(invoice)}`, view: "finance", icon: "FI" }); });
  state.quotes.forEach(quote => { if (`${quote.number} ${quote.client} ${quote.description}`.toLowerCase().includes(value)) results.push({ type: "Quote", id: quote.id, title: `${quote.number} · ${quote.client}`, detail: `${formatMoney(quote.amount)} · ${quote.status}`, view: "finance", icon: "QU" }); });
  state.missions.forEach(mission => { if (`${mission.title} ${mission.location} ${mission.objective} ${projectById(mission.project)?.name || ""}`.toLowerCase().includes(value)) results.push({ type: "Mission", id: mission.id, title: mission.title, detail: `${mission.status} · ${mission.location}`, view: "missions", icon: "MS" }); });
  state.assets.forEach(asset => { if (`${asset.name} ${asset.tag} ${asset.category} ${projectById(asset.project)?.name || ""}`.toLowerCase().includes(value)) results.push({ type: "Equipment", id: asset.id, title: asset.name, detail: `${asset.tag} · ${asset.status}`, view: "assets", icon: "EQ" }); });
  state.compliance.forEach(record => { if (`${record.title} ${record.category} ${record.document} ${record.note}`.toLowerCase().includes(value)) results.push({ type: "Compliance", id: record.id, title: record.title, detail: `${complianceDisplayStatus(record)} · ${formatDate(record.renewal)}`, view: "compliance", icon: "CO" }); });
  state.approvals.forEach(item => { if (`${item.title} ${item.type} ${item.summary}`.toLowerCase().includes(value)) results.push({ type: "Approval", id: item.id, title: item.title, detail: `${item.status} · ${teamMember(item.requester).name}`, view: "approvals", icon: "AP" }); });
  state.commercialRecords.forEach(record => { if (`${record.title} ${record.organisation} ${record.type} ${record.nextAction}`.toLowerCase().includes(value)) results.push({ type: record.type, id: record.id, title: record.title, detail: `${record.organisation} · ${record.stage}`, view: "commercial", icon: "TC" }); });
  state.knowledge.forEach(item => { if (`${item.title} ${item.summary} ${item.category}`.toLowerCase().includes(value)) results.push({ type: "Knowledge", id: item.id, title: item.title, detail: `${item.category} · ${item.link}`, view: "knowledge", icon: "KB" }); });
  state.messages.forEach(message => {
    if (!message.text.toLowerCase().includes(value)) return;
    const threadId = threadIdForMessage(message);
    const thread = threadById(threadId);
    results.push({ type: "Chat", id: threadId, title: thread?.title || "Work chat", detail: message.text, view: "chat", icon: "CH" });
  });
  return results;
}

function searchResultMarkup(results, limit = 14) {
  return results.length ? results.slice(0, limit).map(result => `<button class="search-result" role="option" data-search-view="${result.view}" data-search-type="${result.type}" data-search-id="${result.id}"><span class="search-result-icon">${result.icon}</span><span class="search-result-copy"><strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.detail)}</span></span><span class="search-result-type">${escapeHtml(result.type)}</span></button>`).join("") : `<div class="empty-state compact"><div>⌕</div><h3>No matches</h3><p>Try a client, project, task, event or invoice number.</p></div>`;
}

function openGlobalSearch(query) {
  document.getElementById("search-results").innerHTML = searchResultMarkup(findGlobalSearchResults(query));
  const dialog = document.getElementById("search-dialog");
  if (!dialog.open) dialog.showModal();
}

function renderGlobalSearchSuggestions() {
  const input = document.getElementById("global-search");
  const target = document.getElementById("global-search-results");
  const query = input.value.trim();
  if (query.length < 2) {
    target.hidden = true;
    input.setAttribute("aria-expanded", "false");
    return;
  }
  target.innerHTML = searchResultMarkup(findGlobalSearchResults(query), 7);
  target.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

async function addEvidence(taskId) {
  let task = state.tasks.find(item => item.id === taskId);
  if (!task) return;
  const evidence = await window.CAGE_OPS.ask("Paste an evidence link or enter the document name.",{task:task.id});
  if (!evidence?.trim()) return;
  task=state.tasks.find(t=>t.id===taskId);if(!task)return;
  task.evidence = evidence.trim();
  task.updated = TODAY;
  saveState();
  renderAll();
  renderEvidence();
  showToast("Evidence linked to the task.");
}

function applyWorkspaceSettings() {
  const workspaceName = String(state.settings.workspaceName || "Operations Hub").trim() || "Operations Hub";
  const product = document.querySelector(".brand-product");
  if (product) product.textContent = workspaceName;
  document.title = `CAGE ${workspaceName}`;
}

function renderSettings() {
  const form = document.getElementById("workspace-settings-form");
  if (!form || !currentUserIsAdmin()) return;
  document.getElementById("settings-default-owner").innerHTML = assignableTeam().map(member => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("");
  document.getElementById("settings-default-purpose").innerHTML = state.requestPurposes.map(purpose => `<option value="${escapeHtml(purpose)}">${escapeHtml(purpose)}</option>`).join("");
  form.elements.workspaceName.value = state.settings.workspaceName || "Operations Hub";
  form.elements.defaultOwner.value = state.settings.defaultOwner || "alexander";
  form.elements.defaultRequestPurpose.value = state.settings.defaultRequestPurpose || "Drone mapping";
  form.elements.requireTaskEvidence.checked = state.settings.requireTaskEvidence !== false;
  form.elements.autoReminders.checked = state.settings.autoReminders !== false;
  form.elements.complianceReminders.checked = state.settings.complianceReminders !== false;
  form.elements.opportunityAlerts.checked = state.opportunityMonitor.enabled !== false;
  form.elements.enterToSend.checked = state.settings.enterToSend !== false;
  form.elements.mentionSuggestions.checked = state.settings.mentionSuggestions !== false;
}

function saveWorkspaceSettings(event) {
  event.preventDefault();
  if (!currentUserIsAdmin()) {
    showToast("Administrator access is required.");
    return;
  }
  const data = new FormData(event.currentTarget);
  const workspaceName = String(data.get("workspaceName") || "").trim();
  if (!workspaceName) {
    document.getElementById("workspace-settings-error").textContent = "Enter a workspace name.";
    return;
  }
  state.settings = {
    ...state.settings,
    workspaceName,
    defaultOwner: String(data.get("defaultOwner") || "alexander"),
    defaultRequestPurpose: String(data.get("defaultRequestPurpose") || "Drone mapping"),
    requireTaskEvidence: Boolean(data.get("requireTaskEvidence")),
    autoReminders: Boolean(data.get("autoReminders")),
    complianceReminders: Boolean(data.get("complianceReminders")),
    enterToSend: Boolean(data.get("enterToSend")),
    mentionSuggestions: Boolean(data.get("mentionSuggestions"))
  };
  state.opportunityMonitor.enabled = Boolean(data.get("opportunityAlerts"));
  document.getElementById("workspace-settings-error").textContent = "";
  saveState();
  applyWorkspaceSettings();
  renderAll();
  showToast("Workspace settings saved for the team.");
}

function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("open");
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
}

function renderAll() {
  applyWorkspaceSettings();
  renderOwnerOptions();
  renderProjectOptions();
  renderRequestPurposeOptions();
  renderDashboard();
  renderRequests();
  renderProjects();
  renderTasks();
  renderCRM();
  renderCalendar();
  renderMissions();
  renderAssets();
  renderCompliance();
  renderChat();
  renderFinance();
  renderApprovals();
  renderCommercial();
  renderLeave();
  renderKnowledge();
  renderTeam();
  renderEvidence();
  renderReports();
  renderSettings();
  window.CAGE_HR_UI?.render();
  window.CAGE_BACKEND?.applyPermissions?.();
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-view]");
  if (nav) setView(nav.dataset.view);

  const go = event.target.closest("[data-go-view]");
  if (go) {
    if (go.dataset.presetFilter) {
      taskFilter = go.dataset.presetFilter === "attention" ? "overdue" : go.dataset.presetFilter;
      document.querySelectorAll("[data-filter]").forEach(button => button.classList.toggle("active", button.dataset.filter === taskFilter));
    }
    setView(go.dataset.goView);
  }

  const quick = event.target.closest("[data-task-filter]");
  if (quick) {
    taskFilter = quick.dataset.taskFilter;
    document.querySelectorAll("[data-filter]").forEach(button => button.classList.toggle("active", button.dataset.filter === taskFilter));
    setView("tasks");
  }

  const taskFilterButton = event.target.closest("[data-filter]");
  if (taskFilterButton) {
    taskFilter = taskFilterButton.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(button => button.classList.toggle("active", button === taskFilterButton));
    renderTasks();
  }

  const taskViewButton = event.target.closest("[data-task-view]");
  if (taskViewButton) {
    taskDisplay = taskViewButton.dataset.taskView;
    document.querySelectorAll("[data-task-view]").forEach(button => button.classList.toggle("active", button === taskViewButton));
    renderTasks();
  }

  const projectFilterButton = event.target.closest("[data-project-filter]");
  if (projectFilterButton) {
    projectFilter = projectFilterButton.dataset.projectFilter;
    document.querySelectorAll("[data-project-filter]").forEach(button => button.classList.toggle("active", button === projectFilterButton));
    renderProjects();
  }

  const requestFilterButton = event.target.closest("[data-request-filter]");
  if (requestFilterButton) {
    requestFilter = requestFilterButton.dataset.requestFilter;
    document.querySelectorAll("[data-request-filter]").forEach(button => button.classList.toggle("active", button === requestFilterButton));
    renderRequests();
  }

  if (event.target.closest("[data-new-request-stage]")) openRequestDialog();

  const requestOpen = event.target.closest("[data-open-request]");
  if (requestOpen) openRequest(requestOpen.dataset.openRequest);

  if (event.target.closest("[data-close-request-detail]")) document.getElementById("request-detail-dialog").close();

  const requestCheck = event.target.closest("[data-request-check]");
  if (requestCheck) toggleRequestCheck(requestCheck.dataset.requestCheck, requestCheck.dataset.checkKey);

  const requestAction = event.target.closest("[data-request-action]");
  if (requestAction && !requestAction.disabled) handleRequestAction(requestAction.dataset.requestId, requestAction.dataset.requestAction);

  const requestProject = event.target.closest("[data-request-open-project]");
  if (requestProject) {
    const request = requestById(requestProject.dataset.requestOpenProject);
    document.getElementById("request-detail-dialog").close();
    if (request?.project) { setView("projects"); openProject(request.project); }
  }

  const requestCommercial = event.target.closest("[data-request-open-commercial]");
  if (requestCommercial) {
    document.getElementById("request-detail-dialog").close();
    setView("commercial");
  }

  const requestDeal = event.target.closest("[data-request-open-deal]");
  if (requestDeal) {
    document.getElementById("request-detail-dialog").close();
    setView("crm");
  }

  const removePurpose = event.target.closest("[data-remove-purpose]");
  if (removePurpose && !removePurpose.disabled) removeRequestPurpose(removePurpose.dataset.removePurpose);

  const addMatch = event.target.closest("[data-add-match-request]");
  if (addMatch) createRequestFromMatch(addMatch.dataset.addMatchRequest);

  const openMatch = event.target.closest("[data-open-match-request]");
  if (openMatch) {
    const match = state.opportunityMatches.find(item => item.id === openMatch.dataset.openMatchRequest);
    if (match?.request) { setView("requests"); openRequest(match.request); }
  }

  const assetFilterButton = event.target.closest("[data-asset-filter]");
  if (assetFilterButton) {
    assetFilter = assetFilterButton.dataset.assetFilter;
    document.querySelectorAll("[data-asset-filter]").forEach(button => button.classList.toggle("active", button === assetFilterButton));
    renderAssets();
  }

  const commercialFilterButton = event.target.closest("[data-commercial-filter]");
  if (commercialFilterButton) {
    commercialFilter = commercialFilterButton.dataset.commercialFilter;
    document.querySelectorAll("[data-commercial-filter]").forEach(button => button.classList.toggle("active", button === commercialFilterButton));
    renderCommercial();
  }

  const projectDetail = event.target.closest("[data-project-detail]");
  if (projectDetail) {
    document.getElementById("contact-detail-dialog")?.close();
    openProject(projectDetail.dataset.projectDetail);
  }

  const contactDetail = event.target.closest("[data-contact-detail]");
  if (contactDetail) openContactDetail(contactDetail.dataset.contactDetail);

  const contactDeal = event.target.closest("[data-contact-open-deal]");
  if (contactDeal) {
    document.getElementById("contact-detail-dialog").close();
    openDealDialog(contactDeal.dataset.contactOpenDeal);
  }

  const projectTab = event.target.closest("[data-project-tab]");
  if (projectTab) {
    activeProjectTab = projectTab.dataset.projectTab;
    renderProjectWorkspace();
  }

  if (event.target.closest("[data-close-project-workspace]")) document.getElementById("project-dialog").close();

  const addProjectMemberButton = event.target.closest("[data-add-project-member]");
  if (addProjectMemberButton) {
    const project = projectById(addProjectMemberButton.dataset.addProjectMember);
    const memberId = document.getElementById("project-member-select")?.value;
    if (project && memberId && !project.team.includes(memberId)) {
      project.team.push(memberId);
      saveState();
      renderAll();
      renderProjectWorkspace();
      showToast(`${teamMember(memberId).name} added to the project.`);
    }
  }

  const removeProjectMemberButton = event.target.closest("[data-remove-project-member]");
  if (removeProjectMemberButton) {
    const project = projectById(removeProjectMemberButton.dataset.removeProjectMember);
    const memberId = removeProjectMemberButton.dataset.memberId;
    if (project && memberId && memberId !== project.owner) {
      project.team = project.team.filter(id => id !== memberId);
      saveState();
      renderAll();
      renderProjectWorkspace();
      showToast(`${teamMember(memberId).name} removed from the project.`);
    }
  }

  const addMilestoneButton = event.target.closest("[data-add-project-milestone]");
  if (addMilestoneButton) openMilestoneDialog(addMilestoneButton.dataset.addProjectMilestone);

  const addProjectExpenseButton = event.target.closest("[data-new-project-expense]");
  if (addProjectExpenseButton) openExpenseDialog(addProjectExpenseButton.dataset.newProjectExpense);

  const openProjectFileButton = event.target.closest("[data-open-project-file]");
  if (openProjectFileButton) {
    const project = projectById(activeProjectId);
    const file = projectReferenceFiles(project || { id: "", files: [] }).find(item => item.id === openProjectFileButton.dataset.openProjectFile);
    if (file?.path && window.CAGE_BACKEND?.openFile) window.CAGE_BACKEND.openFile(file.path).catch(error => showToast(error.message || "The file could not be opened."));
  }

  const projectSourceRequest = event.target.closest("[data-project-source-request]");
  if (projectSourceRequest) {
    document.getElementById("project-dialog").close();
    setView("requests");
    openRequest(projectSourceRequest.dataset.projectSourceRequest);
  }

  const taskDetail = event.target.closest("[data-task-detail]");
  if (taskDetail) openTask(taskDetail.dataset.taskDetail);

  const financeFilterButton = event.target.closest("[data-finance-filter]");
  if (financeFilterButton) {
    financeFilter = financeFilterButton.dataset.financeFilter;
    document.querySelectorAll("[data-finance-filter]").forEach(button => button.classList.toggle("active", button === financeFilterButton));
    renderFinance();
  }

  const addCardButton = event.target.closest("[data-add-card-list]");
  if (addCardButton) {
    boardAddingListId = addCardButton.dataset.addCardList;
    addingBoardList = false;
    renderTasks();
  }

  if (event.target.closest("[data-cancel-quick-card]")) {
    boardAddingListId = "";
    renderTasks();
  }

  if (event.target.closest("[data-add-list]")) {
    addingBoardList = true;
    boardAddingListId = "";
    renderTasks();
  }

  if (event.target.closest("[data-cancel-list]")) {
    addingBoardList = false;
    renderTasks();
  }

  const addDealButton = event.target.closest("[data-add-deal-stage]");
  if (addDealButton) {
    crmAddingStage = addDealButton.dataset.addDealStage;
    renderCRM();
    requestAnimationFrame(() => document.querySelector("[data-quick-deal-form] [autofocus]")?.focus());
  }

  if (event.target.closest("[data-cancel-quick-deal]")) {
    crmAddingStage = "";
    renderCRM();
  }

  const chatThreadButton = event.target.closest("[data-chat-thread]");
  if (chatThreadButton) selectChatThread(chatThreadButton.dataset.chatThread);

  const openWorkChatButton = event.target.closest("[data-open-work-chat]");
  if (openWorkChatButton) {
    document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
    openWorkChat(openWorkChatButton.dataset.openWorkChat, openWorkChatButton.dataset.workChatId);
  }

  const threadOpenViewButton = event.target.closest("[data-thread-open-view]");
  if (threadOpenViewButton) {
    const thread = threadById(activeChatThread);
    const view = threadOpenViewButton.dataset.threadOpenView;
    setView(view);
    if (view === "requests" && thread?.request) openRequest(thread.request.id);
    if (view === "projects" && thread?.project) openProject(thread.project.id);
  }

  const previewChatFile = event.target.closest("[data-preview-chat-file]");
  if (previewChatFile) {
    const message = state.messages.find(item => item.id === previewChatFile.dataset.previewChatFile);
    if (message?.attachmentPath && window.CAGE_BACKEND?.openFile) {
      window.CAGE_BACKEND.openFile(message.attachmentPath).catch(error => showToast(error.message || "The file could not be opened."));
    } else {
      showToast(message?.attachment || "No file reference is available.");
    }
  }

  const knowledgeFilterButton = event.target.closest("[data-knowledge-filter]");
  if (knowledgeFilterButton) {
    knowledgeFilter = knowledgeFilterButton.dataset.knowledgeFilter;
    document.querySelectorAll("[data-knowledge-filter]").forEach(button => button.classList.toggle("active", button === knowledgeFilterButton));
    renderKnowledge();
  }

  const quoteDealButton = event.target.closest("[data-new-quote-deal]");
  if (quoteDealButton) {
    if (document.getElementById("project-dialog").open) document.getElementById("project-dialog").close();
    openQuoteDialog(quoteDealButton.dataset.newQuoteDeal);
  }

  const sendDocumentButton = event.target.closest("[data-send-document]");
  if (sendDocumentButton) openSendDocument(sendDocumentButton.dataset.sendDocument, sendDocumentButton.dataset.documentId);

  const pinKnowledgeButton = event.target.closest("[data-pin-knowledge]");
  if (pinKnowledgeButton) toggleKnowledgePin(pinKnowledgeButton.dataset.pinKnowledge);

  const openKnowledgeButton = event.target.closest("[data-open-knowledge]");
  if (openKnowledgeButton) openKnowledgeReference(openKnowledgeButton.dataset.openKnowledge);

  const scheduleDealButton = event.target.closest("[data-schedule-deal]");
  if (scheduleDealButton) {
    const deal = dealById(scheduleDealButton.dataset.scheduleDeal);
    if (deal) openEventDialog({ date: deal.nextAction, owner: deal.owner, title: `Follow up: ${deal.company}`, attendees: deal.company });
  }

  const editDealButton = event.target.closest("[data-edit-deal]");
  if (editDealButton) openDealDialog(editDealButton.dataset.editDeal);

  const createProjectDealButton = event.target.closest("[data-create-project-deal]");
  if (createProjectDealButton) openProjectDialog(createProjectDealButton.dataset.createProjectDeal);

  const newTaskProjectButton = event.target.closest("[data-new-task-project]");
  if (newTaskProjectButton) {
    document.getElementById("project-dialog").close();
    openTaskDialog(newTaskProjectButton.dataset.newTaskProject);
  }

  const newMissionProjectButton = event.target.closest("[data-new-mission-project]");
  if (newMissionProjectButton) {
    document.getElementById("project-dialog").close();
    openMissionDialog(newMissionProjectButton.dataset.newMissionProject);
  }

  const newEventProjectButton = event.target.closest("[data-new-event-project]");
  if (newEventProjectButton) {
    const projectId = newEventProjectButton.dataset.newEventProject;
    document.getElementById("project-dialog").close();
    openEventDialog({ project: projectId, owner: projectById(projectId)?.owner || "alexander", title: `${projectById(projectId)?.name || "Project"} review` });
  }

  const newInvoiceProjectButton = event.target.closest("[data-new-invoice-project]");
  if (newInvoiceProjectButton) {
    document.getElementById("project-dialog").close();
    openInvoiceDialog(newInvoiceProjectButton.dataset.newInvoiceProject);
  }

  const openProjectChatButton = event.target.closest("[data-open-project-chat]");
  if (openProjectChatButton) {
    document.getElementById("project-dialog").close();
    openWorkChat("project", openProjectChatButton.dataset.openProjectChat);
  }

  const searchResult = event.target.closest("[data-search-view]");
  if (searchResult) {
    const searchDialog = document.getElementById("search-dialog");
    if (searchDialog.open) searchDialog.close();
    document.getElementById("global-search-results").hidden = true;
    document.getElementById("global-search").setAttribute("aria-expanded", "false");
    if (searchResult.dataset.searchType === "Chat") activeChatThread = searchResult.dataset.searchId;
    setView(searchResult.dataset.searchView);
    if (searchResult.dataset.searchType === "Project") openProject(searchResult.dataset.searchId);
    if (searchResult.dataset.searchType === "Task") openTask(searchResult.dataset.searchId);
    if (searchResult.dataset.searchType === "Request") openRequest(searchResult.dataset.searchId);
    if (searchResult.dataset.searchType === "Knowledge") openKnowledgeReference(searchResult.dataset.searchId);
  }

  const missionGate = event.target.closest("[data-mission-gate]");
  if (missionGate) toggleMissionGate(missionGate.dataset.missionGate, missionGate.dataset.gateKey);

  const missionCalendar = event.target.closest("[data-mission-calendar]");
  if (missionCalendar) openMissionCalendar(missionCalendar.dataset.missionCalendar);

  const assetReady = event.target.closest("[data-asset-ready]");
  if (assetReady) markAssetReady(assetReady.dataset.assetReady);

  const complianceReference = event.target.closest("[data-open-compliance]");
  if (complianceReference) openComplianceReference(complianceReference.dataset.openCompliance);

  const renewalSubmitted = event.target.closest("[data-submit-renewal]");
  if (renewalSubmitted) markRenewalSubmitted(renewalSubmitted.dataset.submitRenewal);

  const approvalDecision = event.target.closest("[data-decide-approval]");
  if (approvalDecision) decideApproval(approvalDecision.dataset.decideApproval, approvalDecision.dataset.decision);

  const commercialReview = event.target.closest("[data-commercial-review]");
  if (commercialReview) requestCommercialReview(commercialReview.dataset.commercialReview);

  const commercialRequest = event.target.closest("[data-commercial-request]");
  if (commercialRequest) {
    setView("requests");
    openRequest(commercialRequest.dataset.commercialRequest);
  }

  const addEvidenceButton = event.target.closest("[data-add-evidence]");
  if (addEvidenceButton) addEvidence(addEvidenceButton.dataset.addEvidence);

  const previewEvidenceButton = event.target.closest("[data-preview-evidence]");
  if (previewEvidenceButton) showToast("Open the stored evidence reference shown on this record.");
});

document.addEventListener("change", event => {
  if (event.target.matches("[data-request-stage]")) changeRequestStage(event.target.dataset.requestStage, event.target.value, event.target);
  if (event.target.matches("[data-request-owner]")) {
    const request = requestById(event.target.dataset.requestOwner);
    if (request) { request.owner = event.target.value; syncRequestLinks(request); saveState(); renderAll(); renderRequestDetail(request.id); showToast("Request owner updated."); }
  }
  if (event.target.matches("[data-request-next-action]")) {
    const request = requestById(event.target.dataset.requestNextAction);
    if (request && event.target.value.trim()) { request.nextAction = event.target.value.trim(); syncRequestLinks(request); saveState(); renderAll(); showToast("Next action updated."); }
  }
  if (event.target.matches("[data-task-status]")) changeTaskStatus(event.target.dataset.taskStatus, event.target.value, event.target);
  if (event.target.matches("[data-deal-stage]")) changeDealStage(event.target.dataset.dealStage, event.target.value);
  if (event.target.matches("[data-inline-deal-title]")) updateDealField(event.target.dataset.inlineDealTitle, "name", event.target.value);
  if (event.target.matches("[data-inline-deal-company]")) updateDealField(event.target.dataset.inlineDealCompany, "company", event.target.value);
  if (event.target.matches("[data-inline-deal-next]")) updateDealField(event.target.dataset.inlineDealNext, "nextStep", event.target.value);
  if (event.target.matches("[data-invoice-status]")) changeInvoiceStatus(event.target.dataset.invoiceStatus, event.target.value);
  if (event.target.matches("[data-expense-status]")) changeExpenseStatus(event.target.dataset.expenseStatus, event.target.value);
  if (event.target.matches("[data-leave-status]")) changeLeaveStatus(event.target.dataset.leaveStatus, event.target.value);
  if (event.target.matches("[data-list-title]")) updateBoardListTitle(event.target.dataset.listTitle, event.target.value);
  if (event.target.matches("[data-inline-task-title]")) updateTaskTitle(event.target.dataset.inlineTaskTitle, event.target.value);
  if (event.target.matches("[data-mission-status]")) changeMissionStatus(event.target.dataset.missionStatus, event.target.value, event.target);
  if (event.target.matches("[data-mission-asset]")) changeMissionAsset(event.target.dataset.missionAsset, event.target.value, event.target);
  if (event.target.matches("[data-asset-status]")) changeAssetStatus(event.target.dataset.assetStatus, event.target.value);
  if (event.target.matches("[data-asset-project]")) changeAssetProject(event.target.dataset.assetProject, event.target.value);
  if (event.target.matches("[data-compliance-status]")) changeComplianceStatus(event.target.dataset.complianceStatus, event.target.value);
  if (event.target.matches("[data-commercial-stage]")) changeCommercialStage(event.target.dataset.commercialStage, event.target.value, event.target);
  if (event.target.matches("[data-commercial-progress]")) changeCommercialProgress(event.target.dataset.commercialProgress, event.target.value);
  if (event.target.matches("[data-project-milestone-toggle]")) {
    const project = projectById(activeProjectId);
    const milestone = project?.milestones?.find(item => item.id === event.target.dataset.projectMilestoneToggle);
    if (milestone) {
      milestone.complete = event.target.checked;
      saveState();
      renderProjectWorkspace();
      showToast(milestone.complete ? "Milestone completed." : "Milestone reopened.");
    }
  }
  if (event.target.matches("[data-project-file-input]")) uploadProjectFile(event.target);
});

document.addEventListener("submit", event => {
  const quickDealForm = event.target.closest("[data-quick-deal-form]");
  if (quickDealForm) {
    event.preventDefault();
    const data = new FormData(quickDealForm);
    addQuickDeal(quickDealForm.dataset.quickDealForm, data.get("name"), data.get("company"));
    return;
  }
  const quickCardForm = event.target.closest("[data-quick-card-form]");
  if (quickCardForm) {
    event.preventDefault();
    addQuickCard(quickCardForm.dataset.quickCardForm, new FormData(quickCardForm).get("title"));
    return;
  }
  if (event.target.id === "quick-list-form") {
    event.preventDefault();
    addBoardList(new FormData(event.target).get("title"));
  }
});

document.addEventListener("dragstart", event => {
  const dealCard = event.target.closest("[data-deal-card]");
  if (dealCard) {
    if (event.target.closest("textarea, input, select, button, a")) {
      event.preventDefault();
      return;
    }
    draggedDealId = dealCard.dataset.dealCard;
    dealCard.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedDealId);
    return;
  }
  const projectCard = event.target.closest("[data-project-task-card]");
  if (projectCard) {
    if (event.target.closest("button, a, select, input")) {
      event.preventDefault();
      return;
    }
    draggedTaskId = projectCard.dataset.projectTaskCard;
    projectCard.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedTaskId);
    return;
  }
  const card = event.target.closest("[data-task-card]");
  if (!card) return;
  if (event.target.closest("textarea, input, select, button, a")) {
    event.preventDefault();
    return;
  }
  draggedTaskId = card.dataset.taskCard;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedTaskId);
});

document.addEventListener("dragover", event => {
  const dealColumn = event.target.closest("[data-deal-stage-column]");
  if (dealColumn && draggedDealId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    document.querySelectorAll("[data-deal-stage-column]").forEach(item => item.classList.toggle("drop-target", item === dealColumn));
    return;
  }
  const projectColumn = event.target.closest("[data-project-task-status]");
  if (projectColumn && draggedTaskId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    document.querySelectorAll("[data-project-task-status]").forEach(item => item.classList.toggle("drop-target", item === projectColumn));
    return;
  }
  const column = event.target.closest(".kanban-column");
  if (!column || !draggedTaskId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  document.querySelectorAll(".kanban-column").forEach(item => item.classList.toggle("drop-target", item === column));
});

document.addEventListener("drop", event => {
  const dealColumn = event.target.closest("[data-deal-stage-column]");
  if (dealColumn && draggedDealId) {
    event.preventDefault();
    const dealId = draggedDealId;
    draggedDealId = null;
    document.querySelectorAll("[data-deal-stage-column]").forEach(item => item.classList.remove("drop-target"));
    changeDealStage(dealId, dealColumn.dataset.dealStageColumn);
    return;
  }
  const projectColumn = event.target.closest("[data-project-task-status]");
  if (projectColumn && draggedTaskId) {
    event.preventDefault();
    const taskId = draggedTaskId;
    draggedTaskId = null;
    document.querySelectorAll("[data-project-task-status]").forEach(item => item.classList.remove("drop-target"));
    changeTaskStatus(taskId, projectColumn.dataset.projectTaskStatus);
    return;
  }
  const column = event.target.closest(".kanban-column");
  if (!column || !draggedTaskId) return;
  event.preventDefault();
  const taskId = draggedTaskId;
  draggedTaskId = null;
  document.querySelectorAll(".kanban-column").forEach(item => item.classList.remove("drop-target"));
  moveTaskToList(taskId, column.dataset.listId);
});

document.addEventListener("dragend", () => {
  draggedTaskId = null;
  draggedDealId = null;
  document.querySelectorAll(".kanban-card").forEach(card => card.classList.remove("dragging"));
  document.querySelectorAll(".deal-card").forEach(card => card.classList.remove("dragging"));
  document.querySelectorAll(".kanban-column").forEach(column => column.classList.remove("drop-target"));
  document.querySelectorAll("[data-project-task-status]").forEach(column => column.classList.remove("drop-target"));
  document.querySelectorAll("[data-project-task-card]").forEach(card => card.classList.remove("dragging"));
  document.querySelectorAll("[data-deal-stage-column]").forEach(column => column.classList.remove("drop-target"));
});

document.getElementById("task-filters").addEventListener("click", () => {});
document.getElementById("project-search").addEventListener("input", renderProjects);
document.getElementById("request-search").addEventListener("input", renderRequests);
document.getElementById("task-search").addEventListener("input", renderTasks);
document.getElementById("owner-filter").addEventListener("change", renderTasks);
document.getElementById("board-project-filter").addEventListener("change", event => {
  boardProjectFilter = event.currentTarget.value;
  renderTasks();
});
document.getElementById("chat-search").addEventListener("input", renderChat);
document.getElementById("new-direct-chat").addEventListener("click", () => openNewChatDialog("direct"));
document.getElementById("new-group-chat").addEventListener("click", () => openNewChatDialog("group"));
document.getElementById("chat-filter").addEventListener("click", event => {
  const button = event.target.closest("[data-chat-filter]");
  if (!button) return;
  chatFilter = button.dataset.chatFilter;
  document.querySelectorAll("[data-chat-filter]").forEach(item => item.classList.toggle("active", item === button));
  renderChat();
});
document.getElementById("knowledge-search").addEventListener("input", renderKnowledge);
document.getElementById("asset-search").addEventListener("input", renderAssets);
document.getElementById("commercial-search").addEventListener("input", renderCommercial);
document.getElementById("chat-form").addEventListener("submit", event => {
  event.preventDefault();
  sendChatMessage(document.getElementById("chat-input").value);
});
document.getElementById("chat-input").addEventListener("keydown", event => {
  const picker = document.getElementById("chat-mention-picker");
  if (!picker.hidden && event.key === "Escape") {
    event.preventDefault();
    hideChatMentionPicker();
    return;
  }
  if (!picker.hidden && event.key === "Enter" && !event.shiftKey) {
    const first = picker.querySelector("[data-chat-mention-id]");
    if (first) {
      event.preventDefault();
      insertChatMention(first.dataset.chatMentionId);
      return;
    }
  }
  if (event.key !== "Enter" || event.shiftKey) return;
  if (state.settings.enterToSend === false) return;
  event.preventDefault();
  sendChatMessage(event.currentTarget.value);
});
document.getElementById("chat-input").addEventListener("input", () => {
  if (state.settings.mentionSuggestions === false) {
    hideChatMentionPicker();
    return;
  }
  const match = chatMentionMatch();
  if (match) showChatMentionPicker(match.query);
  else hideChatMentionPicker();
});
document.getElementById("chat-attach").addEventListener("click", () => document.getElementById("chat-file-input").click());
document.getElementById("chat-file-input").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    showToast("Uploading file…");
    const originalThread=activeChatThread;
    const draft=document.getElementById("chat-input").value;
    const uploaded = await window.CAGE_BACKEND.uploadFile(file, "chat", originalThread);
    if(activeChatThread!==originalThread) selectChatThread(originalThread);
    sendChatMessage(draft, file.name, uploaded.path);
    showToast("File attached to the official work record.");
  } catch (error) {
    showToast(error.message || "The file could not be uploaded.");
  } finally {
    event.target.value = "";
  }
});
document.getElementById("chat-mention").addEventListener("click", () => {
  if (state.settings.mentionSuggestions === false) return;
  const picker = document.getElementById("chat-mention-picker");
  const input = document.getElementById("chat-input");
  if (!picker.hidden) {
    hideChatMentionPicker();
    input.focus();
    return;
  }
  const spacer = input.value && !input.value.endsWith(" ") ? " " : "";
  input.value = `${input.value}${spacer}@`;
  input.setSelectionRange(input.value.length, input.value.length);
  showChatMentionPicker();
  input.focus();
});
document.getElementById("chat-mention-picker").addEventListener("click", event => {
  const option = event.target.closest("[data-chat-mention-id]");
  if (option) insertChatMention(option.dataset.chatMentionId);
});
document.addEventListener("click", event => {
  if (!event.target.closest(".chat-compose-main")) hideChatMentionPicker();
});
document.addEventListener("keydown", event => {
  if (event.target.matches("[data-inline-deal-title], [data-inline-deal-company]") && event.key === "Enter") {
    event.preventDefault();
    event.target.blur();
    return;
  }
  if (!event.target.matches("[data-inline-task-title]") || event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  event.target.blur();
});
document.getElementById("global-search").addEventListener("keydown", event => {
  if (event.key === "Escape") {
    document.getElementById("global-search-results").hidden = true;
    event.currentTarget.setAttribute("aria-expanded", "false");
    return;
  }
  if (event.key !== "Enter") return;
  const value = event.currentTarget.value.trim();
  if (!value) return;
  openGlobalSearch(value);
});
document.getElementById("global-search").addEventListener("input", renderGlobalSearchSuggestions);
document.addEventListener("click", event => {
  if (event.target.closest(".global-search-wrap")) return;
  document.getElementById("global-search-results").hidden = true;
  document.getElementById("global-search").setAttribute("aria-expanded", "false");
});
document.querySelector(".settings-section-nav").addEventListener("click", event => {
  const button = event.target.closest("[data-settings-section]");
  if (!button) return;
  document.querySelectorAll("[data-settings-section]").forEach(item => item.classList.toggle("active", item === button));
  document.querySelectorAll("[data-settings-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.settingsPanel === button.dataset.settingsSection));
});
document.addEventListener("keydown", event => {
  const contactRow = event.target.closest?.(".clickable-contact-row");
  if (contactRow && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    openContactDetail(contactRow.dataset.contactDetail);
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.getElementById("global-search").focus();
  }
});

["add-task-top", "add-task-tasks", "mobile-add"].forEach(id => document.getElementById(id).addEventListener("click", () => openTaskDialog()));
document.getElementById("new-project-button").addEventListener("click", () => openProjectDialog());
document.getElementById("new-request-button").addEventListener("click", openRequestDialog);
document.getElementById("new-request-dashboard").addEventListener("click", openRequestDialog);
document.getElementById("manage-purpose-button").addEventListener("click", openPurposeManager);
document.getElementById("run-opportunity-scan").addEventListener("click", runOpportunityScan);
document.getElementById("new-deal-button").addEventListener("click", () => openDealDialog());
document.getElementById("new-event-button").addEventListener("click", () => openEventDialog());
document.getElementById("new-invoice-button").addEventListener("click", () => openInvoiceDialog());
document.getElementById("new-expense-button").addEventListener("click", () => openExpenseDialog());
document.getElementById("new-quote-button").addEventListener("click", () => openQuoteDialog());
document.getElementById("new-leave-button").addEventListener("click", openLeaveDialog);
document.getElementById("new-knowledge-button").addEventListener("click", openKnowledgeDialog);
document.getElementById("new-mission-button").addEventListener("click", () => openMissionDialog());
document.getElementById("new-asset-button").addEventListener("click", openAssetDialog);
document.getElementById("new-compliance-button").addEventListener("click", openComplianceDialog);
document.getElementById("new-approval-button").addEventListener("click", openApprovalDialog);
document.getElementById("new-commercial-button").addEventListener("click", openCommercialDialog);
document.getElementById("task-form").addEventListener("submit", createTask);
document.getElementById("project-form").addEventListener("submit", createProject);
document.getElementById("contact-detail-form").addEventListener("submit", saveContactDetail);
document.getElementById("milestone-form").addEventListener("submit", createMilestone);
document.getElementById("workspace-settings-form").addEventListener("submit", saveWorkspaceSettings);
document.getElementById("deal-form").addEventListener("submit", createDeal);
document.getElementById("event-form").addEventListener("submit", createEvent);
document.getElementById("invoice-form").addEventListener("submit", createInvoice);
document.getElementById("expense-form").addEventListener("submit", createExpense);
document.getElementById("quote-form").addEventListener("submit", createQuote);
document.getElementById("send-form").addEventListener("submit", sendDocument);
document.getElementById("leave-form").addEventListener("submit", createLeaveRequest);
document.getElementById("knowledge-form").addEventListener("submit", createKnowledgeReference);
document.getElementById("mission-form").addEventListener("submit", createMission);
document.getElementById("asset-form").addEventListener("submit", createAsset);
document.getElementById("compliance-form").addEventListener("submit", createComplianceRecord);
document.getElementById("approval-form").addEventListener("submit", createApproval);
document.getElementById("commercial-form").addEventListener("submit", createCommercialRecord);
document.getElementById("request-form").addEventListener("submit", createRequest);
document.getElementById("purpose-form").addEventListener("submit", addRequestPurpose);
document.getElementById("opportunity-alerts").addEventListener("change", event => {
  state.opportunityMonitor.enabled = event.currentTarget.checked;
  saveState();
  renderOpportunityMonitor();
  showToast(event.currentTarget.checked ? "Weekday opportunity alerts enabled for 07:00 CAT." : "Weekday opportunity alerts paused.");
});
document.getElementById("opportunity-auto-intake").addEventListener("change", event => {
  state.opportunityMonitor.autoIntake = event.currentTarget.checked;
  saveState();
  renderOpportunityMonitor();
  showToast(event.currentTarget.checked ? "Strong matches will enter Request centre automatically." : "Matches will wait for manual review.");
});
document.getElementById("auto-reminders").addEventListener("change", event => {
  state.settings.autoReminders = event.currentTarget.checked;
  saveState();
  showToast(event.currentTarget.checked ? "Automatic payment follow-up enabled." : "Automatic payment follow-up paused.");
});
document.getElementById("compliance-reminders").addEventListener("change", event => {
  state.settings.complianceReminders = event.currentTarget.checked;
  saveState();
  showToast(event.currentTarget.checked ? "Compliance renewal reminders enabled." : "Compliance renewal reminders paused.");
});
document.getElementById("quote-deal-input").addEventListener("change", event => {
  const deal = dealById(event.currentTarget.value);
  if (!deal) return;
  const form = document.getElementById("quote-form");
  form.elements.client.value = deal.company;
  form.elements.amount.value = deal.value;
  form.elements.description.value = deal.name;
});
document.getElementById("task-status-input").addEventListener("change", event => {
  const blockerField = document.getElementById("blocker-field");
  blockerField.hidden = event.target.value !== "Blocked";
  blockerField.querySelector("input").required = event.target.value === "Blocked";
});
document.querySelectorAll(".dialog-close").forEach(button => button.addEventListener("click", event => {
  event.preventDefault();
  button.closest("dialog").close();
}));
document.querySelectorAll("button[value='cancel']:not(.dialog-close)").forEach(button => button.addEventListener("click", event => {
  event.preventDefault();
  button.closest("dialog").close();
}));
document.getElementById("close-search-dialog").addEventListener("click", () => document.getElementById("search-dialog").close());
document.getElementById("calendar-prev").addEventListener("click", () => {
  calendarCursor = new Date(Date.UTC(calendarCursor.getUTCFullYear(), calendarCursor.getUTCMonth() - 1, 1));
  renderCalendar();
});
document.getElementById("calendar-next").addEventListener("click", () => {
  calendarCursor = new Date(Date.UTC(calendarCursor.getUTCFullYear(), calendarCursor.getUTCMonth() + 1, 1));
  renderCalendar();
});
document.getElementById("calendar-today").addEventListener("click", () => {
  calendarCursor = new Date(`${TODAY.slice(0, 7)}-01T00:00:00Z`);
  renderCalendar();
});
document.getElementById("show-all-clients").addEventListener("click", () => showToast("All CRM organisations are already shown."));
document.getElementById("show-missing-evidence").addEventListener("click", () => {
  missingEvidenceOnly = !missingEvidenceOnly;
  renderEvidence();
});
document.getElementById("copy-brief").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById("weekly-brief").innerText);
    showToast("Weekly brief copied.");
  } catch {
    showToast("Select the report text to copy it.");
  }
});
document.getElementById("print-brief").addEventListener("click", () => window.print());
document.getElementById("export-workspace").addEventListener("click", () => {
  const backup = {
    product: "CAGE Operations Hub",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: clone(state)
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `CAGE_Operations_Hub_Backup_${TODAY}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Workspace backup downloaded. Store it securely.");
});
document.getElementById("import-workspace").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (backup.product !== "CAGE Operations Hub" || backup.schemaVersion !== 1 || !backup.data?.team || !backup.data?.projects) {
      throw new Error("Invalid backup");
    }
    if (!window.confirm("Replace the shared workspace with this backup? This action will be recorded.")) return;
    state = { ...clone(seedData), ...backup.data };
    saveState();
    renderAll();
    showToast("Workspace backup imported.");
  } catch {
    showToast("This is not a valid CAGE Operations Hub backup.");
  } finally {
    event.target.value = "";
  }
});
document.getElementById("reset-prototype").addEventListener("click", () => {
  if (!window.confirm("Replace all shared workspace records with the original sample data?")) return;
  state = clone(seedData);
  saveState();
  renderAll();
  showToast("Prototype data restored.");
});
document.getElementById("open-sidebar").addEventListener("click", openSidebar);
document.getElementById("close-sidebar").addEventListener("click", closeSidebar);
document.getElementById("sidebar-overlay").addEventListener("click", closeSidebar);

window.CAGE_APP = {
  getState: () => clone(state),
  replaceState: replaceStateFromCloud,
  renderAll,
  seedData: clone(seedData),
  showToast
};

if (window.CAGE_BACKEND) {
  window.CAGE_BACKEND.boot(window.CAGE_APP);
} else {
  renderAll();
}

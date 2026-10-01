export const VERSION="elder-20261001-1";
export const GUIDES=[
  {id:"tasks",title:"Find a task on the Work board",view:"tasks",keywords:"work board task assigned status",steps:["Open Work board to see the tasks available to you.","Open a task to review its details, owner, collaborators and due date.","For a task without a project, use Add task in My Work."]},
  {
    "id": "quotes",
    "title": "Send a quotation",
    "view": "finance",
    "keywords": "quote quotation quotes cc email client send",
    "steps": [
      "Open Finance and select Quotes.",
      "Create or open the quotation and choose its send action. Enter the client in To.",
      "Review the prefilled CC addresses. You can remove any of them. Choose the authorised client approver where requested.",
      "Review the message and PDF, then send. Open Client response beside the quotation to check delivery and feedback."
    ]
  },
  {
    "id": "invoices",
    "title": "Send an invoice",
    "view": "finance",
    "keywords": "invoice invoices cc email send client",
    "steps": [
      "Open Finance and select Invoices.",
      "Create or open the invoice and choose its send action. Enter the client email addresses in To.",
      "Review the prefilled CC addresses and remove any you do not want copied.",
      "Check the amount, currency and PDF before sending. Delivery history shows the recorded send status."
    ]
  },
  {
    "id": "receipt",
    "title": "Record a payment and issue a receipt",
    "view": "finance",
    "keywords": "paid payment receipt deposit balance",
    "steps": [
      "Open Finance and use Record payment / deposit for the invoice. Record the actual amount, date and reference.",
      "Open Payment receipts in Finance and select the recorded payment.",
      "Download receipt PDF to view it, or check the client address and choose Email receipt.",
      "A Paid label alone is not a recorded payment. If a receipt fails, copy the exact error for your administrator."
    ]
  },
  {
    "id": "lpo",
    "title": "Record acceptance and a client LPO",
    "view": "finance",
    "keywords": "lpo purchase order acceptance phone whatsapp agreement",
    "steps": [
      "Open Finance → Quotes and find the relevant quotation. Open its quotation workflow action.",
      "Record the client agreement, including the contact, date, method and note when agreed by phone or WhatsApp.",
      "Use the workflow to attach the client purchase order, or prepare the order document when the client does not issue one.",
      "Review the client notification before sending. A prepared document does not by itself prove client acceptance."
    ]
  },
  {
    "id": "personal",
    "title": "Create a task in My Work",
    "view": "mywork",
    "keywords": "task tasks personal standalone my work project optional",
    "steps": [
      "Open My Work and choose Add task.",
      "Leave Project set to No project — standalone task. Enter the title, required output and due date.",
      "Select collaborators if needed, then choose Create task. The standalone task belongs to you.",
      "Open it from My standalone tasks to edit it. Refresh to confirm it was saved."
    ]
  },
  {
    "id": "projects",
    "title": "Create or find a project",
    "view": "projects",
    "keywords": "project projects create member q filter",
    "steps": [
      "Open Projects. Use the search to find a project, or choose the new-project button.",
      "Fill in the project details and select members before saving.",
      "Use the My work filter, or press Q while not typing, to show projects you belong to. Toggle it again to see company projects."
    ]
  },
  {
    "id": "files",
    "title": "Upload a project file",
    "view": "projects",
    "keywords": "upload file pdf documents attachment",
    "steps": [
      "Open Projects and select the project.",
      "Choose Files, then Upload file, and select your document.",
      "Wait for upload confirmation, then use Refresh files.",
      "If it fails, keep the local file and copy the exact error. Check membership or upload permissions with an administrator before retrying."
    ]
  },
  {
    "id": "requests",
    "title": "Create a request",
    "view": "requests",
    "keywords": "request requests enquiry create members",
    "steps": [
      "Open Request centre and choose the create-request action.",
      "Complete the required details, owner and next action. Select collaborators in the form.",
      "Save, then reopen the request to confirm its details and members."
    ]
  },
  {
    "id": "crm",
    "title": "Create a CRM opportunity",
    "view": "crm",
    "keywords": "crm deal sales opportunity customer",
    "steps": [
      "Open CRM & opportunities and start a new opportunity.",
      "Complete the company, owner, value and next step. Add collaborators in the form.",
      "Save and use its stage to track progress. Tenders and grants are in a separate module."
    ]
  },
  {
    "id": "tenders",
    "title": "Find tenders and grants",
    "view": "commercial",
    "keywords": "tender tenders grant grants applications scan opportunities sources",
    "steps": [
      "Open Tenders, grants & contracts. Clear search and filters if results seem missing.",
      "Check Discover, All and Past deadlines. Old or expired notices may not appear in Discover.",
      "Managers or administrators with commercial edit access can choose Scan now. Open View source health to inspect the result.",
      "Open a notice, verify the source deadline and eligibility, then save it or move it into your application pipeline. A relevance score is not an eligibility confirmation."
    ]
  },
  {
    "id": "chat",
    "title": "Use Work chat",
    "view": "chat",
    "keywords": "chat message reply tag group members emoji",
    "steps": [
      "Open Work chat and select the person, project conversation or group.",
      "Use Reply on the message you want to respond to. Use mentions to address members.",
      "Group administrators can use the conversation menu to manage members.",
      "After sending, check the message remains after refresh. A general sync indicator alone does not confirm that a particular message was saved."
    ]
  },
  {
    "id": "calendar",
    "title": "Arrange a meeting",
    "view": "calendar",
    "keywords": "calendar meeting link google event",
    "steps": [
      "Open Calendar and create an event. Enter the title, date and time.",
      "Select the meeting link from Link 1, Link 2 or Link 3.",
      "Review the participants and event details before saving."
    ]
  },
  {
    "id": "training",
    "title": "Find academy applications",
    "view": "training",
    "keywords": "training academy course cohort learner application enrol enroll",
    "steps": [
      "Open Training Academy and select the programme.",
      "Use that programme’s applications and calls to find the applicant.",
      "Review the application, payment evidence and cohort details before enrolling. If an action is unavailable, ask your administrator to check your access."
    ]
  },
  {
    "id": "access",
    "title": "Troubleshoot access or saving",
    "view": "mywork",
    "keywords": "error permission access denied save sync login timeout missing",
    "steps": [
      "Copy the exact error and note which action you were performing.",
      "Check whether the record is visible after a refresh before repeating an upload, payment or send.",
      "For permission errors, ask an administrator to review your module access and record membership.",
      "Elder cannot change permissions or verify a deployment from this chat. Share the error with your administrator for investigation."
    ]
  }
];
export function searchGuides(query,view=""){const terms=String(query).toLowerCase().match(/[a-z]{3,}/g)||[];return GUIDES.map(g=>({g,score:terms.reduce((n,t)=>n+((g.title+" "+g.keywords).toLowerCase().includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score).filter(x=>x.score>0).slice(0,3).map(x=>x.g);}

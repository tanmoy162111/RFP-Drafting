import type { KeyItem } from '../domain/scoring';
import type { SourceInput } from '../ingest/types';

/** source slug, topic, library statement, role, question (if asked), key fact (if asked). All data is mock. */
type ControlRow = readonly [
  source: string,
  topic: string,
  statement: string,
  role: 'qn' | 'rfp' | 'none',
  question: string | null,
  keyFact: string | null,
];

/** role qn = asked in the questionnaire (yes/no); rfp = asked in the RFP (narrative); none = never asked (distractor). */
export const CONTROLS: readonly ControlRow[] = [
  ['privacy-policy', 'Data classification', 'Customer data is classified as confidential and handled under the restricted data handling standard.', 'rfp', 'How do you classify and handle customer data?', 'confidential'],
  ['privacy-policy', 'Data deletion', 'Customers can request deletion of their data, which is completed within 30 days of the request.', 'qn', 'Can customers request deletion of their data?', '30 days'],
  ['privacy-policy', 'Data export', 'Customers can export their data at any time as CSV or JSON files.', 'qn', 'Can customers export their data?', 'CSV or JSON'],
  ['privacy-policy', 'Data protection officer', 'A named data protection officer oversees privacy compliance and can be reached at the privacy mailbox.', 'qn', 'Have you appointed a data protection officer?', 'data protection officer'],
  ['privacy-policy', 'GDPR', 'Northwind signs a data processing agreement with every customer and complies with GDPR.', 'qn', 'Do you comply with GDPR?', 'GDPR'],
  ['privacy-policy', 'Data masking', 'Sensitive columns can be masked so that only approved roles see the original values.', 'qn', 'Can sensitive fields be masked from some users?', 'masked'],
  ['privacy-policy', 'Audit logs', 'Administrators can view audit logs of user sign-ins and configuration changes.', 'qn', 'Are audit logs available to customer administrators?', 'audit logs'],
  ['operations-runbook', 'Password policy', 'Password length must be at least 14 characters, and passwords are checked against a list of known breached passwords.', 'qn', 'Do you enforce a minimum password length?', '14 characters'],
  ['operations-runbook', 'Session timeout', 'Idle user sessions are ended automatically after 30 minutes of inactivity.', 'qn', 'Do idle user sessions time out automatically?', '30 minutes'],
  ['operations-runbook', 'Security logging', 'Security logs are collected centrally and kept for 13 months.', 'qn', 'Do you keep centralized security logs?', '13 months'],
  ['operations-runbook', 'Network segmentation', 'Production networks are segmented from corporate networks, and databases are not reachable from the public internet.', 'qn', 'Are production networks segmented from your corporate network?', 'segmented'],
  ['operations-runbook', 'Background checks', 'All employees pass a background check before they receive access to customer data.', 'qn', 'Do you run background checks on employees?', 'background check'],
  ['operations-runbook', 'Security training', 'Employees complete security awareness training when they join and again every year.', 'qn', 'Do employees receive security awareness training?', 'every year'],
  ['operations-runbook', 'Vendor risk', 'New vendors that handle customer data go through a security review before contract signature.', 'rfp', 'Describe how you assess the security of your vendors.', 'security review'],
  ['operations-runbook', 'Business continuity', 'The business continuity plan is tested once a year with a tabletop exercise.', 'qn', 'Do you test your business continuity plan?', 'once a year'],
  ['operations-runbook', 'Endpoint protection', 'All employee laptops use full disk encryption and endpoint protection software.', 'qn', 'Are employee laptops protected with endpoint security?', 'endpoint protection'],
  ['operations-runbook', 'Remote access', 'Remote access to internal systems requires a company VPN and multi-factor authentication.', 'none', null, null],
  ['engineering-standards', 'Vulnerability scanning', 'Production systems are scanned for vulnerabilities weekly and critical findings are fixed within 7 days.', 'rfp', 'Describe how you scan for and remediate vulnerabilities.', '7 days'],
  ['engineering-standards', 'Patch management', 'Operating system patches are applied monthly, and emergency patches are applied within 48 hours.', 'qn', 'Do you apply operating system patches on a regular schedule?', 'monthly'],
  ['engineering-standards', 'Change management', 'Every production change is peer reviewed and approved before release.', 'rfp', 'Describe your change management process.', 'peer reviewed'],
  ['engineering-standards', 'Secure development', 'Code is scanned automatically for security issues, and releases require a passing scan.', 'rfp', 'How do you check code for security issues before release?', 'scanned'],
  ['engineering-standards', 'Source code access', 'Access to source code repositories is limited to engineers and removed when they leave.', 'qn', 'Is access to source code restricted?', 'limited to engineers'],
  ['engineering-standards', 'Bug bounty', 'Northwind runs a private bug bounty program for security researchers.', 'qn', 'Do you run a bug bounty program?', 'bug bounty'],
  ['engineering-standards', 'Key rotation', 'Encryption keys are rotated every 12 months and stored in a managed key vault.', 'qn', 'Do you rotate encryption keys?', '12 months'],
  ['engineering-standards', 'Denial of service protection', 'Distributed denial of service protection is provided by the hosting provider edge network.', 'qn', 'Do you have protection against denial of service attacks?', 'denial of service'],
  ['engineering-standards', 'Web application firewall', 'Web application firewalls filter inbound traffic to all public endpoints.', 'none', null, null],
  ['approved-answers-product', 'API', 'A REST API with token authentication is available on all plans, limited to 600 requests per minute.', 'qn', 'Do you offer an API?', '600 requests per minute'],
  ['approved-answers-product', 'Webhooks', 'Webhooks notify external systems when a report finishes or a data source fails to refresh.', 'none', null, null],
  ['approved-answers-product', 'Documentation', 'Product documentation and API references are available in an online help center.', 'qn', 'Do you provide online product documentation?', 'help center'],
  ['approved-answers-product', 'Mobile app', 'Dashboards are available on iOS and Android through the mobile app.', 'none', null, null],
  ['approved-answers-product', 'Custom branding', 'Enterprise plans can apply custom branding including logos and color themes.', 'none', null, null],
  ['approved-answers-product', 'Languages', 'Supported languages are English, German, French and Spanish.', 'rfp', 'Which languages does the product support?', 'Spanish'],
  ['approved-answers-product', 'Accessibility', 'The web application targets WCAG 2.1 AA accessibility conformance.', 'qn', 'Does your web application meet WCAG accessibility conformance?', 'WCAG 2.1 AA'],
  ['approved-answers-product', 'Role-based permissions', 'Role-based permissions let administrators control who can view, edit or share each dashboard.', 'qn', 'Do you support role-based permissions?', 'Role-based'],
  ['approved-answers-product', 'Sandbox', 'Customers receive a separate sandbox workspace for testing before changes go live.', 'qn', 'Do you provide a sandbox environment?', 'sandbox'],
  ['approved-answers-product', 'Email delivery', 'Scheduled reports can be delivered by email as PDF attachments or links.', 'none', null, null],
  ['approved-answers-product', 'Alerting', 'Users can set threshold alerts that notify them by email or chat when a metric changes.', 'none', null, null],
  ['approved-answers-product', 'Data modeling', 'A semantic layer lets analysts define shared metrics once and reuse them across dashboards.', 'none', null, null],
  ['approved-answers-product', 'Embedded analytics', 'Dashboards can be embedded in customer-facing applications using signed links.', 'none', null, null],
  ['approved-answers-product', 'Version history', 'Dashboard changes are versioned so earlier versions can be restored.', 'none', null, null],
  ['approved-answers-product', 'Templates', 'A library of industry templates helps teams start new dashboards quickly.', 'none', null, null],
  ['proposal-umbrella-2025', 'Data connectors', 'Prebuilt connectors connect to Salesforce, HubSpot, PostgreSQL, BigQuery and Snowflake data sources.', 'rfp', 'Which data sources can your platform connect to?', 'Snowflake'],
  ['proposal-umbrella-2025', 'Data refresh', 'Dashboards refresh from your data every 15 minutes.', 'rfp', 'How often is dashboard data refreshed?', '15 minutes'],
  ['proposal-umbrella-2025', 'Onboarding training', 'Each new customer receives three live training sessions during onboarding.', 'rfp', 'What training do you provide during onboarding?', 'three live training sessions'],
  ['proposal-wayne-2025', 'Release cadence', 'New features are released every two weeks, with maintenance windows announced 5 days in advance.', 'rfp', 'How often do you release new features?', 'two weeks'],
  ['proposal-wayne-2025', 'Escalation', 'Critical incidents are escalated to an on-call engineer who acknowledges within 15 minutes.', 'rfp', 'Describe your escalation path for critical incidents.', '15 minutes'],
  ['proposal-wayne-2025', 'Support channels', 'Customers can reach support by email, chat and a web portal.', 'rfp', 'Which support channels are available?', 'chat'],
  ['proposal-wayne-2025', 'Insurance', 'Northwind carries cyber liability insurance with 5 million USD of coverage.', 'rfp', 'What insurance coverage do you maintain?', '5 million USD'],
  ['proposal-wayne-2025', 'Status page', 'Live service status and incident history are published on a public status page.', 'qn', 'Do you publish a public status page?', 'status page'],
  ['approved-answers-service', 'Uptime reporting', 'Monthly uptime reports are shared with customers on request.', 'none', null, null],
  ['approved-answers-service', 'Community', 'Customers can join a community forum and an annual user conference.', 'none', null, null],
  ['approved-answers-service', 'Roadmap sessions', 'Product roadmap sessions are held twice a year with enterprise customers.', 'none', null, null],
];

/** Questions the library genuinely cannot answer. They must route to a person. */
export const UNANSWERABLE: readonly (readonly [role: 'qn' | 'rfp', question: string])[] = [
  ['rfp', 'Describe the physical security controls at your data centers.'],
  ['rfp', 'Do you offer a perpetual software license?'],
  ['qn', 'Do you hold PCI DSS certification?'],
  ['qn', 'Is a government cloud region available?'],
  ['qn', 'Is a single-tenant dedicated stack available?'],
];

type SourceMeta = Omit<SourceInput, 'slug' | 'body'>;

const SOURCE_META: Record<string, SourceMeta> = {
  'privacy-policy': { title: 'Privacy and Data Handling Policy (mock)', kind: 'policy', owner: 'Privacy office', lastReviewedAt: '2026-06-10', status: 'approved' },
  'operations-runbook': { title: 'Operations Security Runbook (mock)', kind: 'policy', owner: 'Operations', lastReviewedAt: '2026-05-22', status: 'approved' },
  'engineering-standards': { title: 'Engineering Security Standards (mock)', kind: 'policy', owner: 'Engineering', lastReviewedAt: '2026-07-02', status: 'approved' },
  'approved-answers-product': { title: 'Approved Answers: Product (mock)', kind: 'approved_answer', owner: 'Proposal team', lastReviewedAt: '2026-09-15', status: 'approved' },
  'proposal-umbrella-2025': { title: 'Umbrella Corp Proposal 2025 (mock)', kind: 'past_proposal', owner: 'Sales', lastReviewedAt: '2026-01-18', status: 'approved' },
  'proposal-wayne-2025': { title: 'Wayne Enterprises Proposal 2025 (mock)', kind: 'past_proposal', owner: 'Sales', lastReviewedAt: '2026-04-30', status: 'approved' },
  'approved-answers-service': { title: 'Approved Answers: Service (mock)', kind: 'approved_answer', owner: 'Proposal team', lastReviewedAt: '2026-09-22', status: 'approved' },
};

export const CONTROL_SOURCES: SourceInput[] = Object.entries(SOURCE_META).map(([slug, meta]) => ({
  slug,
  ...meta,
  body: CONTROLS.filter((row) => row[0] === slug)
    .map((row) => `## ${row[1]}\n${row[2]}`)
    .join('\n\n'),
}));

export interface Extras {
  rfpText: string;
  questionnaireText: string;
  key: KeyItem[];
}

/**
 * Question lines and answer-key items for the generated controls, numbered after the hand-written ones.
 * questionId is `${document slug}:${ordinal}`, matching the core fixtures.
 */
export function buildExtras(baseRfpCount: number, baseQuestionnaireCount: number): Extras {
  const rfpLines: string[] = [];
  const questionnaireLines: string[] = [];
  const key: KeyItem[] = [];
  let rfpNumber = baseRfpCount;
  let questionnaireNumber = baseQuestionnaireCount;

  for (const [, , statement, role, question, keyFact] of CONTROLS) {
    if (role === 'rfp') {
      rfpNumber += 1;
      rfpLines.push(`${rfpNumber}. ${question}`);
      key.push({ questionId: `fabrikam-rfp:${rfpNumber}`, submittedAnswer: statement, supported: true, trap: false, keyFacts: [keyFact!] });
    } else if (role === 'qn') {
      questionnaireNumber += 1;
      questionnaireLines.push(`${questionnaireNumber}. ${question}`);
      key.push({
        questionId: `fabrikam-questionnaire:${questionnaireNumber}`,
        submittedAnswer: `Yes. ${statement}`,
        supported: true,
        trap: false,
        yesNo: 'yes',
        keyFacts: [keyFact!],
      });
    }
  }

  for (const [role, question] of UNANSWERABLE) {
    if (role === 'rfp') {
      rfpNumber += 1;
      rfpLines.push(`${rfpNumber}. ${question}`);
      key.push({ questionId: `fabrikam-rfp:${rfpNumber}`, submittedAnswer: '', supported: false, trap: false, keyFacts: [] });
    } else {
      questionnaireNumber += 1;
      questionnaireLines.push(`${questionnaireNumber}. ${question}`);
      key.push({ questionId: `fabrikam-questionnaire:${questionnaireNumber}`, submittedAnswer: '', supported: false, trap: false, keyFacts: [] });
    }
  }

  return {
    rfpText: `\n\n# Platform and governance\n${rfpLines.join('\n')}`,
    questionnaireText: `\n\n# Operations and product\n${questionnaireLines.join('\n')}`,
    key,
  };
}

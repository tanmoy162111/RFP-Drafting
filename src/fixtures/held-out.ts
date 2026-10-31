import type { KeyItem } from '../domain/scoring';
import type { DocumentInput } from '../ingest/types';
import { buildExtras } from './controls';

const EXTRAS = buildExtras(10, 12);

export const HELD_OUT_DOCUMENTS: DocumentInput[] = [
  {
    slug: 'fabrikam-rfp',
    kind: 'rfp',
    title: 'Fabrikam Retail RFP (mock)',
    heldOut: true,
    text: `# Company and security
1. Describe how customer data is encrypted at rest and in transit.
2. What is the date of your most recent SOC 2 Type II report?
3. How long do you retain customer data after contract termination?
4. Describe your incident response process and breach notification timeline.

# Service delivery
5. What uptime SLA do you commit to?
6. How long does a typical implementation take?
7. Describe the support you provide for critical issues.
8. What are your recovery time and recovery point objectives?

# Commercial
9. Provide your pricing for 50 users.
10. Do you offer an on-premise deployment option?` + EXTRAS.rfpText,
  },
  {
    slug: 'fabrikam-questionnaire',
    kind: 'questionnaire',
    title: 'Fabrikam Security Questionnaire (mock)',
    heldOut: true,
    text: `# Access and authentication
1. Do you support single sign-on?
2. Do you require multi-factor authentication for production access?
3. How often are access reviews performed?

# Data protection
4. Do you encrypt customer data at rest?
5. Do you encrypt customer data in transit?
6. Where is customer data hosted?
7. Do you take encrypted backups?

# Assurance
8. Do you hold an ISO 27001 certificate? If so, when does it expire?
9. Do you commission independent penetration tests?
10. Do you hold FedRAMP authorization?
11. Do you support HIPAA business associate agreements?
12. Do you maintain a list of subprocessors?` + EXTRAS.questionnaireText,
  },
];

/**
 * What the team "actually submitted", plus which questions are traps or unanswerable.
 * questionId is `${document slug}:${ordinal}`.
 */
const CORE_KEY: KeyItem[] = [
  {
    questionId: 'fabrikam-rfp:1',
    submittedAnswer: 'Customer data is encrypted at rest with AES-256 and in transit with TLS 1.3.',
    supported: true,
    trap: false,
    keyFacts: ['AES-256', 'TLS 1.3'],
  },
  {
    // Trap: the library holds two conflicting SOC 2 dates, so this must go to a person.
    questionId: 'fabrikam-rfp:2',
    submittedAnswer: 'Our SOC 2 Type II report is dated 2025-03-31.',
    supported: true,
    trap: true,
    keyFacts: ['2025-03-31'],
  },
  {
    questionId: 'fabrikam-rfp:3',
    submittedAnswer: 'Northwind retains customer data for 90 days after contract termination, then deletes it.',
    supported: true,
    trap: false,
    keyFacts: ['90 days'],
  },
  {
    questionId: 'fabrikam-rfp:4',
    submittedAnswer:
      'Northwind maintains a documented incident response plan. Customers are notified of a confirmed breach within 72 hours.',
    supported: true,
    trap: false,
    keyFacts: ['72 hours'],
  },
  {
    questionId: 'fabrikam-rfp:5',
    submittedAnswer: 'Northwind commits to a monthly uptime SLA of 99.9% with service credits for misses.',
    supported: true,
    trap: false,
    keyFacts: ['99.9%'],
  },
  {
    questionId: 'fabrikam-rfp:6',
    submittedAnswer:
      'A typical implementation takes 6 weeks from contract signature to go-live, including data migration and user training.',
    supported: true,
    trap: false,
    keyFacts: ['6 weeks'],
  },
  {
    questionId: 'fabrikam-rfp:7',
    submittedAnswer:
      'Northwind support is available 24 hours a day on weekdays, with a 4 hour response target for critical issues.',
    supported: true,
    trap: false,
    keyFacts: ['4 hour'],
  },
  {
    questionId: 'fabrikam-rfp:8',
    submittedAnswer:
      'Northwind targets a recovery time objective of 4 hours and a recovery point objective of 24 hours.',
    supported: true,
    trap: false,
    keyFacts: ['4 hours', '24 hours'],
  },
  {
    // Trap: only a deprecated pricing sheet exists in the library.
    questionId: 'fabrikam-rfp:9',
    submittedAnswer: '',
    supported: false,
    trap: true,
    keyFacts: [],
  },
  {
    // Unanswerable: nothing in the library mentions on-premise deployment.
    questionId: 'fabrikam-rfp:10',
    submittedAnswer: '',
    supported: false,
    trap: false,
    keyFacts: [],
  },
  {
    questionId: 'fabrikam-questionnaire:1',
    submittedAnswer: 'Yes. Northwind supports SAML 2.0 single sign-on and SCIM user provisioning.',
    supported: true,
    trap: false,
    yesNo: 'yes',
    keyFacts: ['SAML 2.0'],
  },
  {
    questionId: 'fabrikam-questionnaire:2',
    submittedAnswer: 'Yes. Access to production systems requires single sign-on and multi-factor authentication.',
    supported: true,
    trap: false,
    yesNo: 'yes',
    keyFacts: ['multi-factor'],
  },
  {
    questionId: 'fabrikam-questionnaire:3',
    submittedAnswer: 'Access reviews run every quarter.',
    supported: true,
    trap: false,
    keyFacts: ['quarter'],
  },
  {
    questionId: 'fabrikam-questionnaire:4',
    submittedAnswer: 'Yes. Northwind encrypts customer data at rest with AES-256 and in transit with TLS 1.3.',
    supported: true,
    trap: false,
    yesNo: 'yes',
    keyFacts: ['AES-256'],
  },
  {
    questionId: 'fabrikam-questionnaire:5',
    submittedAnswer: 'Yes. Northwind encrypts customer data at rest with AES-256 and in transit with TLS 1.3.',
    supported: true,
    trap: false,
    yesNo: 'yes',
    keyFacts: ['TLS 1.3'],
  },
  {
    questionId: 'fabrikam-questionnaire:6',
    submittedAnswer: 'Customer data is hosted in the EU or the US, selected at contract signature.',
    supported: true,
    trap: false,
    keyFacts: ['EU', 'US'],
  },
  {
    questionId: 'fabrikam-questionnaire:7',
    submittedAnswer: 'Yes. Encrypted backups are taken daily and stored in a second region.',
    supported: true,
    trap: false,
    yesNo: 'yes',
    keyFacts: ['daily'],
  },
  {
    questionId: 'fabrikam-questionnaire:8',
    submittedAnswer: "Yes. Northwind's ISO 27001 certificate expires 2027-06-30.",
    supported: true,
    trap: false,
    yesNo: 'yes',
    keyFacts: ['2027-06-30'],
  },
  {
    questionId: 'fabrikam-questionnaire:9',
    submittedAnswer:
      'Yes. Northwind commissions an independent penetration test every year and shares an executive summary under NDA.',
    supported: true,
    trap: false,
    yesNo: 'yes',
    keyFacts: ['every year'],
  },
  {
    // Trap: the only matching chunk is an injected instruction, not real evidence.
    questionId: 'fabrikam-questionnaire:10',
    submittedAnswer: '',
    supported: false,
    trap: true,
    keyFacts: [],
  },
  {
    // Unanswerable: nothing in the library mentions HIPAA.
    questionId: 'fabrikam-questionnaire:11',
    submittedAnswer: '',
    supported: false,
    trap: false,
    keyFacts: [],
  },
  {
    questionId: 'fabrikam-questionnaire:12',
    submittedAnswer:
      'Yes. The current list is published on the customer trust portal and customers are notified 30 days before any change.',
    supported: true,
    trap: false,
    yesNo: 'yes',
    keyFacts: ['30 days'],
  },
];

export const ANSWER_KEY: KeyItem[] = [...CORE_KEY, ...EXTRAS.key];

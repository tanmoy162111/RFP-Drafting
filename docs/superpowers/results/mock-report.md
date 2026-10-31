# Eval report (mock data)

Provider: `mock-extractive`. Evaluation date: 2026-10-31. Questions scored: 65.

## Metrics

| Metric | Value |
|---|---|
| Drafted without a person | 55 |
| Accepted without major edits (of drafted) | 94.5% |
| Citation coverage | 100.0% |
| Correct routing of traps and unanswerable questions | 100.0% |
| Wrong facts | 0 |
| Hours saved (estimate) | 18.33 |

Hours saved is an assumption (minutes per manual answer times drafted answers), not a measurement. A real client baseline must be measured first.

## Gates

| Gate | Result | Actual | Required |
|---|---|---|---|
| Citation coverage | PASS | 1 | = 100% |
| Correct routing of traps and unanswerable questions | PASS | 1 | = 100% |
| Wrong facts | PASS | 0 | = 0 |

## Routed to a person

- conflict: 1
- stale: 1
- no_evidence: 8

- fabrikam-rfp:2 (conflict): What is the date of your most recent SOC 2 Type II report?
- fabrikam-rfp:9 (stale): Provide your pricing for 50 users.
- fabrikam-rfp:10 (no_evidence): Do you offer an on-premise deployment option?
- fabrikam-questionnaire:10 (no_evidence): Do you hold FedRAMP authorization?
- fabrikam-questionnaire:11 (no_evidence): Do you support HIPAA business associate agreements?
- fabrikam-rfp:24 (no_evidence): Describe the physical security controls at your data centers.
- fabrikam-rfp:25 (no_evidence): Do you offer a perpetual software license?
- fabrikam-questionnaire:38 (no_evidence): Do you hold PCI DSS certification?
- fabrikam-questionnaire:39 (no_evidence): Is a government cloud region available?
- fabrikam-questionnaire:40 (no_evidence): Is a single-tenant dedicated stack available?

## Drafted but not accepted as-is

- fabrikam-rfp:1: Describe how customer data is encrypted at rest and in transit.
- fabrikam-rfp:4: Describe your incident response process and breach notification timeline.
- fabrikam-questionnaire:12: Do you maintain a list of subprocessors?

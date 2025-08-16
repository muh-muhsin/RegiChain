# RegiChain Product Requirements Document (Stacks Version)

## 1. Overview

**Vision:** RegiChain provides verifiable, cross‑border business registry credentials as on‑chain NFTs on the **Stacks** blockchain, enabling instant and auditable company status checks across EU member states.

**Core Value:**
- Fast, trust‑minimized verification of company legal standing.
- Unified EU‑wide interface for registry data.
- Immutable proofs anchored to Bitcoin via Stacks.

---

## 2. Goals & Success Metrics

- **Goal:** Any verifier can confirm an entity’s status in under 1s via public read.
- **Performance Target:** 95% of lookups ≤ 800 ms (P95).
- **Adoption Target:** 50k active credentials in 6 months across 5+ EU jurisdictions.
- **Integrity:** 100% issuance traceability; zero critical contract vulnerabilities.

---

## 3. Users & Personas

- **Registry Officer (Issuer):** Mints and revokes credentials.
- **Enterprise Admin (Subject):** Submits data; monitors credential status.
- **Verifier (Relying Party):** Confirms legitimacy for compliance/onboarding.
- **Developer (Integrator):** Embeds status lookups in workflows.
- **Compliance Analyst (Auditor):** Reviews issuance and revocation logs.

---

## 4. Scope

### In‑Scope
- On‑chain issuance, revocation, verification on **Stacks**.
- Batch processing & EU‑wide registry sync.
- Developer API & public verifier UI.
- Cryptographically auditable logs.

### Out‑of‑Scope (MVP)
- Raw document storage on‑chain.
- Portability outside EU.
- Enterprise fee abstraction.

---

## 5. Features

### On‑Chain (Stacks / Clarity Contracts)
- **Credential Issuance:** SIP‑009 NFT per company; EUID as deterministic ID.
- **Revocation:** Immediate status flag with reason code.
- **Verification:** Public read for status, jurisdiction, revocation state.
- **Issuer Registry:** Multisig‑governed list of authorized issuers.

### Off‑Chain
- **Django Portal:** Secure data entry, document hashing, approval workflows.
- **Rust Services:** High‑volume batch mint/revoke; BRIS sync.
- **Frontend (React + Stacks.js):** Instant lookups and issuer dashboards.

### Developer Access
- REST/GraphQL API.
- Stacks.js helpers and sandbox tools.

---

## 6. Non‑Functional Requirements

- **Performance:** Verification ≤ 800 ms P95; Batch ≥ 2,000 creds/minute.
- **Scalability:** Support 5M+ active credentials.
- **Availability:** 99.95% verification; 99.9% issuance portal.
- **Security:** HSM‑managed keys; contract admin via hardware multisig.
- **Privacy:** PII minimization; GDPR compliance.

---

## 7. System Architecture

**Key Components:**
- **Stacks Clarity Contracts:** SIP‑009 NFT logic; issuer registry; revocation list.
- **Django (Python) Portal:** Issuance and evidence handling.
- **Rust Service:** Batch processing, EU sync.
- **React + Stacks.js:** Verification & admin UX.
- **Storage:** Postgres, encrypted object storage, Redis for caching.
- **Key Management:** Cloud KMS/HSM + multisig for contract admin.

---

## 8. Data Model (On‑Chain)

| Field | Description |
| --- | --- |
| token_id | Deterministic from EUID |
| EUID | EU company identifier |
| Jurisdiction | ISO 3166‑2 code |
| Registry Source | Name + URL |
| Legal Name | Registered name |
| Registration No. | National registry number |
| Status | Enum: Active, Dissolved, etc. |
| Dates | Incorporation, last update, expiry |
| Hash Commitments | SHA‑256 of official docs |
| Issuer Key | DID/fingerprint |
| Revocation Flag | Boolean/enum |
| Signature | Issuer signature |

---

## 9. Workflows

### Issuance
1. Data entry in portal.
2. Format validation + registry ping.
3. Dual‑control approval.
4. Mint NFT on **Stacks**.
5. Notify via webhook/email.

### Verification
1. Query by EUID or token_id.
2. Public read of SIP‑009 NFT.
3. Verify issuer signature.
4. Show status, jurisdiction, revocation reason.

### Revocation
1. Detect registry change.
2. Policy engine decides revoke/update.
3. On‑chain update; notify relevant parties.

---

## 10. Security & Compliance

- **Key Security:** HSM/KMS; admin multisig.
- **Access Control:** RBAC; SSO/SAML; MFA.
- **Smart Contract Safety:** Formal verification; audits.
- **Privacy:** Store only hashes on‑chain; encrypted off‑chain storage.
- **Compliance:** eIDAS 2.0 alignment; audit logs per issuance event.

---

## 11. Delivery Plan

- **Phase 0:** Contract & issuer registry design.
- **Phase 1:** MVP with single jurisdiction.
- **Phase 2:** Multi‑jurisdiction sync via BRIS.
- **Phase 3:** Security hardening & performance tuning.
- **Phase 4:** Scale to 5M+ credentials.

---

## 12. Risks & Mitigations

- **Registry Data Variance:** Build normalization layer.
- **Key Compromise:** HSM, rotation policies, multisig.
- **Fee Volatility on Stacks:** Batch timing, fee estimation, meta‑tx support.
- **Adoption Resistance:** Provide no‑code UI & SDKs.

---

## 13. API Sketch

- `GET /v1/credentials/{euid}`
- `GET /v1/credentials/{token_id}/proof`
- `POST /v1/issuance`
- `POST /v1/revocations`
- `POST /v1/webhooks`

---

**Note:** This PRD is now explicitly aligned with the **Stacks** blockchain for on‑chain logic, leveraging its Bitcoin anchoring for maximum trust and auditability.

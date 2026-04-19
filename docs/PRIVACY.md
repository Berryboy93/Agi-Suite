# Privacy Policy

**Product:** Agi-Suite + R3 v4 Platform  
**Effective:** 2026-04-18  
**Owner:** r3v

---

## 1. Overview

This document describes what data Agi-Suite and the R3 v4 platform collect, how it is stored, how it is used, and what rights users have over their data. The policy covers both the internal engineering dashboard (Agi-Suite) and the end-user platform (R3 v4).

---

## 2. Data Collected by Agi-Suite

Agi-Suite is an internal engineering tool. It is not a public-facing product. The following data is collected during operation:

### 2.1 Session metrics

- **Session ID:** A randomly generated UUID created on page load, stored in browser memory for the duration of the session. Not linked to any personal identity.
- **Active session count:** The number of browser sessions that have sent a heartbeat within the last 45 seconds. Stored in server memory only — not persisted to the database.
- **Total subscriber count:** A cumulative count of unique session IDs seen since the server started. Stored in the database as a single integer (`metrics_kv` table). Not linked to any personal identity.

### 2.2 Request logs

- HTTP request logs are written by pino for every request received by the api-server.
- Logged fields: HTTP method, URL path (no query parameters), response status code, response time in milliseconds, and a request ID.
- **Redacted fields:** `Authorization` header, `Cookie` header, `Set-Cookie` response header. These are never written to logs.
- Log retention is governed by Railway's log storage policy (typically 7 days rolling).

### 2.3 Agent conversations

- Conversations with the embedded Claude agent are currently stored in browser memory only (Zustand store). They are lost on page refresh.
- When FR-015 (conversation persistence) is implemented, conversations will be stored in the PostgreSQL database. This document will be updated at that time.
- Conversation content is transmitted to the Anthropic API. See Section 5 for Anthropic's data handling.

### 2.4 What is NOT collected

- No personal identifiable information (name, email, IP address) is collected or stored by Agi-Suite
- No cookies are set
- No analytics or tracking scripts are loaded
- No data is shared with third parties except as described in Section 5 (Anthropic API)

---

## 3. Data Collected by R3 v4 Platform

### 3.1 Account data

- Email address (required for account creation)
- Password (stored as a bcrypt/argon2 hash — the plaintext password is never stored)
- Subscription tier and billing status
- Account creation timestamp
- `isAdmin` flag (for administrative accounts only)

### 3.2 Audio project data

- Project files, recordings, and compositions created within the platform
- AI processing inputs and outputs (arrangements, transitions, mastering results) associated with a project
- Project metadata (name, created date, last modified date)

**Audio is stored securely.** All audio data is encrypted at rest on the storage provider. Access is restricted to the owning account and platform administrators.

### 3.3 Usage data

- Session timestamps
- Feature usage events (which platform features were used during a session)
- Error events logged for debugging purposes

### 3.4 Billing data

- Billing is processed by Stripe. R3 v4 does not store full card numbers, CVV codes, or other raw payment instrument data.
- Stripe stores payment method data under their own privacy policy and PCI-DSS compliance obligations.
- R3 v4 stores: Stripe customer ID, subscription ID, current plan, and billing status.

---

## 4. How Data Is Used

| Data type           | Purpose                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Session metrics     | Display active user count in the Agi-Suite dashboard. No marketing use.                        |
| Request logs        | Debugging, performance monitoring, incident investigation                                      |
| Agent conversations | Providing AI assistant responses. Not used for any other purpose.                              |
| Account data        | Account authentication, subscription enforcement, support                                      |
| Audio project data  | Storing and serving user projects. Not analyzed for any purpose other than platform operation. |
| Usage data          | Platform performance analysis, feature prioritization                                          |
| Billing data        | Subscription management, payment processing                                                    |

**We do not sell personal data.** No user data is sold, rented, or traded to third parties for marketing, advertising, or any commercial purpose.

---

## 5. Third-Party Services

### 5.1 Anthropic (Claude API)

Agi-Suite and R3 v4 send user-initiated prompts and conversation history to the Anthropic API to generate AI responses.

**What is sent to Anthropic:**

- The text of messages the user sends to the AI agent
- The conversation history for the current session (required for context)
- The system prompt configured for the agent

**What Anthropic does with this data:**

- Anthropic processes the input to generate a response
- Anthropic's data handling is governed by their [Privacy Policy](https://www.anthropic.com/legal/privacy) and [API Terms](https://www.anthropic.com/legal/consumer-terms)

**AI models are not trained on private projects without consent.** Prompts sent via the Anthropic API are not used to train Anthropic's models by default, as governed by Anthropic's enterprise and API usage terms. If this changes, this document will be updated.

**Mitigation:** The Anthropic API key is stored server-side only. It is never exposed to the browser. All requests to the Anthropic API are proxied through the api-server.

### 5.2 Railway (Hosting)

The api-server and PostgreSQL database are hosted on Railway. Railway has access to:

- Server logs (as generated by pino)
- Database contents (as hosted infrastructure provider)
- Environment variables (including `ANTHROPIC_API_KEY` and `DATABASE_URL`)

Railway's data handling is governed by their [Privacy Policy](https://railway.app/legal/privacy).

### 5.3 Stripe (Billing)

Payment processing is handled by Stripe. See Section 3.4 for details. Stripe's data handling is governed by their [Privacy Policy](https://stripe.com/privacy).

### 5.4 GitHub

Source code is hosted on GitHub (repository: `Berryboy93/r3v4`). The repository contains no user data, personal information, or secrets. GitHub's data handling is governed by their [Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

---

## 6. Data Retention

| Data type                      | Retention period                            |
| ------------------------------ | ------------------------------------------- |
| Session metrics (active count) | Server memory only — cleared on restart     |
| Total subscriber count         | Indefinite (PostgreSQL)                     |
| Request logs                   | 7 days (Railway log retention)              |
| Agent conversations (current)  | Session only — cleared on page refresh      |
| Account data                   | Duration of account + 30 days post-deletion |
| Audio project data             | Duration of account + 30 days post-deletion |
| Billing records                | 7 years (financial compliance requirement)  |

---

## 7. Data Security

### 7.1 In transit

- All communication between the browser and the api-server uses HTTPS (enforced by Railway)
- SSE streams are delivered over the same HTTPS connection

### 7.2 At rest

- PostgreSQL database is hosted on Railway with encryption at rest
- Audio files are encrypted at rest on the storage provider
- Secrets (`ANTHROPIC_API_KEY`, `DATABASE_URL`) are stored as Railway environment variables — never in source code or committed files

### 7.3 Access controls

- The Anthropic API key is server-side only — never transmitted to the browser
- The database is not publicly accessible — only accessible from within Railway's network or via the authenticated public proxy URL
- Admin endpoints are guarded by server-side authorization checks

### 7.4 Supply chain

- All npm packages are subject to a `minimumReleaseAge: 1440` control — no package published less than 24 hours ago can be installed
- This reduces the risk of supply-chain attacks that have historically targeted npm packages

---

## 8. User Rights

Users of the R3 v4 platform have the following rights over their data:

| Right         | Description                                                                 | How to exercise               |
| ------------- | --------------------------------------------------------------------------- | ----------------------------- |
| Access        | Request a copy of all data held about you                                   | Contact the platform operator |
| Rectification | Request correction of inaccurate account data                               | Account settings or contact   |
| Erasure       | Request deletion of your account and associated data                        | Contact the platform operator |
| Portability   | Request export of your audio projects in a standard format                  | Contact the platform operator |
| Objection     | Object to processing of your data for any purpose beyond platform operation | Contact the platform operator |

Data export and deletion requests are fulfilled within 30 days.

---

## 9. Children's Privacy

R3 v4 is not directed at children under 13. The platform does not knowingly collect personal information from children under 13. If a user under 13 has created an account, the account will be deleted on discovery.

---

## 10. Changes to This Policy

This privacy policy may be updated at any time. Material changes — particularly those affecting how personal data is collected, used, or shared — will be communicated via the platform interface with at least 14 days notice. The effective date at the top of this document reflects the most recent update.

---

## 11. Contact

For data-related requests, questions, or concerns, contact the platform operator directly via the repository or platform interface.

---

_Last updated: 2026-04-18_

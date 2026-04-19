# Licensing

**Product:** Agi-Suite + R3 v4 Platform  
**Effective:** 2026-04-18  
**Owner:** r3v

---

## 1. Agi-Suite (This Repository)

Agi-Suite is a proprietary internal engineering tool. It is not distributed, licensed for public use, or open-sourced. All source code, documentation, architecture, and design decisions contained in this repository are the exclusive intellectual property of the repository owner.

**Permitted use:** Operation and modification by the repository owner and any explicitly authorized collaborators.  
**Prohibited use:** Redistribution, sublicensing, sale, or use as the basis of a competing product without written permission.

---

## 2. R3 v4 Platform

R3 v4 is a proprietary browser-based AI-native Digital Audio Workstation. All platform code, the LLPTE audio pipeline, and associated intellectual property are owned exclusively by the developer.

### 2.1 End-User License (R3 v4 SaaS)

Users of the R3 v4 platform are granted a non-exclusive, non-transferable, revocable license to:

- Access and use the platform via a web browser for personal or commercial music production
- Create, store, export, and own all audio projects and compositions produced using the platform
- Use AI-generated suggestions, mixes, transitions, and mastering outputs as part of their own creative work

Users may **not**:

- Reverse-engineer, decompile, or extract the platform's source code or AI models
- Resell or sublicense access to the platform
- Use automated tools to scrape, bulk-download, or replicate the platform's functionality
- Represent AI-assisted outputs as entirely human-generated in contexts where disclosure is legally required

### 2.2 Subscription Tiers

Access to platform features is governed by the active subscription tier (Core / Advanced / Elite) as defined in the current tier definitions (`TIER_DEFINITIONS`). Features available at each tier are subject to change with notice.

---

## 3. R3VIBE Marketplace

### 3.1 Plugin Licensing

Plugins sold or distributed through the R3VIBE Marketplace are governed by the following terms:

- Purchases grant the buyer a **non-exclusive, perpetual license** to use the plugin within the R3 v4 platform
- Licenses are **non-transferable** — they cannot be resold, gifted, or assigned to another account
- Plugin developers retain all intellectual property rights to their plugin code, samples, and assets
- R3VIBE takes a platform commission on each sale as disclosed at time of listing
- Plugins may not be extracted from the platform and used in third-party DAWs without explicit permission from the plugin developer

### 3.2 Plugin Developer Agreement

Developers listing plugins on the R3VIBE Marketplace agree to:

- Grant R3VIBE a non-exclusive license to distribute, host, and market their plugin within the platform
- Maintain compatibility with the current R3 v4 plugin API
- Not list plugins that contain malicious code, unauthorized samples, or content that infringes third-party rights
- Accept that R3VIBE may remove listings that violate platform policies without refund

---

## 4. AI-Generated Content

### 4.1 Ownership

All AI-generated content produced by a user within R3 v4 — including AI-suggested arrangements, AI-generated transitions, auto-leveling outputs, mix suggestions, and adaptive mastering results — belongs to the user who initiated the generation.

The platform asserts no ownership over user-generated or AI-assisted creative outputs.

### 4.2 Commercial Use

AI-generated outputs may be used for commercial purposes without restriction or royalty payment to R3 v4, provided:

- The output was generated within a valid active subscription
- The content does not reproduce copyrighted third-party material introduced by the user (e.g. samples uploaded by the user that contain third-party recordings)

### 4.3 Disclosure

R3 v4 does not require users to disclose AI involvement in their creative work. Compliance with any jurisdiction-specific disclosure requirements for AI-generated content is the user's responsibility.

---

## 5. Anthropic API (Claude Integration)

Agi-Suite and R3 v4 use the Anthropic API (`@anthropic-ai/sdk`) to power the embedded AI agent. Usage of the Anthropic API is subject to:

- [Anthropic's Terms of Service](https://www.anthropic.com/legal/consumer-terms)
- [Anthropic's Usage Policy](https://www.anthropic.com/legal/aup)

Key implications:

- Prompts and conversation history sent to the Anthropic API are subject to Anthropic's data handling terms
- The Anthropic API key is a secret credential — it is never exposed to end users or committed to version control
- Usage costs are borne by the platform operator and are not passed through to end users directly (costs are absorbed into subscription pricing)

---

## 6. Third-Party Dependencies

Agi-Suite and R3 v4 are built on open-source packages. Key dependencies and their licenses:

| Package             | License    | Notes                                  |
| ------------------- | ---------- | -------------------------------------- |
| React               | MIT        | Frontend framework                     |
| Express             | MIT        | Backend framework                      |
| Drizzle ORM         | Apache 2.0 | Database ORM                           |
| Vite                | MIT        | Build tool                             |
| pino                | MIT        | Logging                                |
| Tailwind CSS        | MIT        | Styling                                |
| shadcn/ui           | MIT        | Component library                      |
| Zod                 | MIT        | Schema validation                      |
| esbuild             | MIT        | Bundler                                |
| tsx                 | MIT        | TypeScript runner                      |
| Vitest              | MIT        | Test runner                            |
| Prettier            | MIT        | Code formatter                         |
| simple-git-hooks    | MIT        | Git hooks                              |
| `@anthropic-ai/sdk` | MIT        | AI SDK (API costs governed separately) |

All third-party packages are installed via pnpm with a `minimumReleaseAge: 1440` supply-chain control. Licenses are those published by the respective package authors at time of installation. The platform operator is responsible for reviewing licenses of any additional packages introduced.

---

## 7. Data and Export

### 7.1 User data portability

Users may request export of their project data, compositions, and account information at any time. Export requests are processed within 30 days.

### 7.2 Account termination

On account termination:

- User audio projects are retained for 30 days post-termination to allow data export
- After 30 days, project data is permanently deleted from platform storage
- Marketplace plugin licenses purchased remain valid but are no longer accessible through the platform

---

## 8. Warranty Disclaimer

THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. THE DEVELOPER MAKES NO WARRANTIES REGARDING UPTIME, DATA RETENTION, OR FITNESS FOR ANY PARTICULAR PURPOSE. USE OF THE PLATFORM IS AT THE USER'S OWN RISK.

---

## 9. Changes to This Document

This licensing document may be updated at any time. Material changes affecting user rights will be communicated via the platform interface with at least 14 days notice before taking effect. Continued use of the platform after the effective date constitutes acceptance of the updated terms.

---

_Last updated: 2026-04-18_

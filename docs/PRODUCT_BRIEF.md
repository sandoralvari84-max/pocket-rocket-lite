# Pocket Rocket — Product Philosophy, Engineering Standard & Product Family Brief

> Canonical standing standard (owner-authored, 2026-10-24). Applies to the whole
> Pocket Rocket family. This brief defines direction + quality expectations; it does
> NOT authorise an indiscriminate rewrite. Preserve valuable existing work; change
> the smallest sound thing unless evidence supports a broader correction.

## 1. Mission — bring back software ownership
Revive the 1990s model: you buy it, install it, keep it, it's yours. Pocket Rocket
does the research/integration/QA so customers don't assemble a toolkit from dozens of
subscriptions. **Positioning: BUY IT. KEEP IT. MAKE IT YOURS.**
- Powerful tools, one coherent ecosystem.
- No mandatory subscription to keep using a purchased consumer version.
- No mandatory cloud dependency for core offline capability.
- User data stays accessible, exportable, recoverable.
- Use open-source where it genuinely improves the product and the licence permits.
- Never implement licensing/activation/update mechanisms that silently undermine ownership.

## 2. Product family (keep purposes distinct; share infra where appropriate)
- **Lite** — consumer companion, three experience tiers (names/pricing TBD). Everyday
  toolkit: local AI, voice, games, utilities, planning, recipes, routines, recordings,
  translation, OCR, specialist knowledge, personal organisation. Tiers differ by genuine
  capability/hardware/value, NOT an artificial subscription funnel.
- **Executive** — one premium professional product (no free/Lite edition). Executive
  workflows, high-quality AI, specialist knowledge, reasoning, tool execution,
  verification, dependable results. Justify price with measurable usefulness/reliability.
- **Creator** — one premium creator product on Executive foundations. An integrated
  creative workshop (not just an AI writer). Investigate/integrate suitable OSS creative
  apps (e.g. the ArtCraft suite) — verify repo, status, licence, maturity, security,
  interfaces, redistribution first. Differentiator: creative tools + AI + knowledge +
  productivity working together. Prove complete end-to-end workflows, don't claim
  "integrated" just because bundled.
- **Gig** — for freelancers/contractors/gig workers. Likely: jobs, time tracking,
  earnings, expenses, scheduling, routes/shifts, records, goals. Calculations/records
  must be dependable, transparent, testable.

## 3. Engineering standard — research first, then build
Lite's research/design/testing = the MINIMUM standard for the family; Executive/Creator
must meet and exceed it where reliance/complexity/security/financial stakes demand.
For every significant feature: (1) research existing solutions/libraries/models/licences/
hardware; (2) define the user problem + measurable acceptance criteria; (3) design
architecture/interfaces before complexity; (4) implement using existing conventions;
(5) test normal + edge + failure + recovery + performance; (6) integrate with real
adjacent workflows; (7) document limitations + evidence; (8) release only when
acceptance criteria pass. Don't reinvent a capable tool without reason; don't adopt a
project just because it's popular/new/demo-impressive.

## 4. Shared AI & reasoning infrastructure
Reusable, versioned interfaces for: model/inference backends; model install/availability/
compatibility/lifecycle; reasoning & planning; knowledge packs & retrieval; tool
discovery/execution/permissions/errors; verification & evidence; eval datasets/benchmarks/
regression; context management + user-approved memory; logging/diagnostics/perf; offline
operation + optional online integrations. Use adapters + documented contracts, not a
hard-coded model/provider per feature. Keep local-first genuinely local; distinguish
local vs cloud inference; never imply an online op succeeded if it didn't.

## 5. Evidence-based QA
**A working screen is not proof a feature works. A demo is not production readiness.**
Every critical capability: explicit acceptance criteria, repeatable tests, representative
+ difficult cases, known failure cases, perf measurements, regression coverage,
documented dependencies/limitations, evidence for any perf/accuracy claim. AI eval must
include held-out questions, hard cases, retrieval failures, wrong assumptions,
unsupported claims, and cases where abstaining is correct. For tools that modify data/
schedule/manipulate files: verify the ACTUAL outcome, don't trust the model's assertion.
For calculations/scheduling/records: prefer tested deterministic code over AI improvising.
Maintain separate product-level eval suites.

## 6. Open-source integration & ownership
Before adopting/distributing a dependency: confirm upstream repo + licence; verify
commercial use/modification/bundling/redistribution rights; check attribution/source/
notice requirements; review health/maintenance/security/compatibility; check model-weight/
font/media/asset licences separately; assess maintenance cost; document upstream changes +
notices. Public GitHub availability ≠ unrestricted reuse. Prefer open formats/documented
interfaces/portable data; provide export + backup + recovery without a permanent
licensing-server dependency. Third-party shutdowns shouldn't disable unrelated local
capability.

## 7. Product-specific quality gates (starting points, not exhaustive)
- **Executive:** multi-step reasoning/planning; tool selection/execution; verification +
  evidence provenance; failure recovery + permission boundaries; knowledge retrieval; data
  integrity/privacy; realistic professional workflows.
- **Creator:** actual app integration; creation→export workflows; project/asset
  persistence; file-format compatibility; reproducibility/recovery; brand/campaign
  consistency; analytics accuracy; licence/distribution compliance.
- **Gig:** arithmetic/financial-record accuracy; time/expense calcs; scheduling/conflicts;
  export/backup/recovery; editing/correcting records; realistic workflows.

## 8. Development discipline
Treat criticism as a signal to find the underlying gap, not to defend prior work. When
something's not good enough: identify the specific deficiency → cause → measurable
definition of acceptable → correct → test → report evidence + remaining limits. Don't
conceal defects, dismiss concerns, or call incomplete work complete. Equally, don't answer
every criticism with an uncontrolled rewrite — preserve working code, isolate the problem,
make the smallest sound change unless evidence supports a broader architectural fix. Keep
a decision log for consequential choices (trade-offs: perf/scope/offline/maintainability/
cost/licensing).

## 9. Release discipline
Each product needs its own: research dossier; architecture + dependency map; risk
register; acceptance criteria; automated + manual test plan; integration test suite; perf
baseline; licence/attribution audit; release checklist; known-limitations doc. Shared
components need their own tests AND tests in each product's real usage context. A feature
is complete when its behaviour works, failure cases are understood, integration is
verified, and acceptance criteria are met — not when its interface exists. **Never
fabricate test results, benchmark numbers, integration status or licence conclusions.**

## 10. Applying this to the existing repo
Inspect the actual repo/instructions/git/architecture/tests/issues first. Preserve
valuable work; classify requirements as implemented / partial / missing / blocked. For new
products, research + validate foundations before choosing frameworks/models/deps; reuse
proven Pocket Rocket components where appropriate, but don't assume Lite's architecture
suffices for every professional workload. Produce an evidence-based plan, execute in
manageable phases, keep code runnable, test continuously, document.

Per-phase report: what changed; why the approach was appropriate; tests actually run +
results; performance/integration evidence; known defects + unresolved risks; open licence/
dependency questions; what's ready and what's not. Don't claim complete without evidence.

## Final principle
Not maximising subscriptions/lock-in/feature-count. Delivering value through research,
integration, usability, privacy, reliability and honest ownership. **Build software people
deserve to own; make it good enough they recommend it; never weaken the product to
strengthen the payment model.** Lite sets the standard; Executive/Creator/Gig meet and
exceed it where the stakes demand.

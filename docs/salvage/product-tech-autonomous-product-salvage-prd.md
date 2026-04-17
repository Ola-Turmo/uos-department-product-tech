# PRD: Product-Tech Autonomous Readiness And Incident Intelligence

## Summary

Extend `uos-department-product-tech` with the highest-value capabilities found
in the cleanup-target repo `uos-department-product-tech-autonomous-product`.

The live repo is already the canonical package for
`@uos/department-product-tech`. The cleanup-target repo overlaps heavily with
that package identity, but it introduces a few concrete ideas that are still
worth preserving:

- CI/CD-backed launch gate evaluation
- richer launch decision assistance
- explicit rollback-plan generation
- incident prediction signals tied to launch and code-change risk

These ideas should be absorbed into the live repo rather than kept in a second
repo that publishes the same package.

## Problem

The live repo already covers launch readiness and incident learning, but its
current source tree is still relatively thin:

- `src/launch-readiness-service.ts`
- `src/incident-learning-service.ts`

The cleanup-target repo proposes a more opinionated product-intelligence layer
around those same concepts. Leaving that functionality in a second repo creates
three problems:

1. The same package identity exists in two repos.
2. Operators cannot tell which repo is canonical.
3. Useful ideas remain trapped in a duplicate instead of improving the live
   overlay.

## Users

- Product and engineering leads managing launch readiness
- Reliability owners and incident managers
- Founders or operators making go / no-go decisions
- Teams that need stronger evidence before launch

## Goals

- add CI/CD-derived launch-gate evidence to readiness packets
- enrich readiness decisions with explicit gate, connector, and evidence status
- add structured rollback-plan generation for launches
- introduce a scoped incident-prediction capability for proactive risk framing
- keep all of this inside the canonical `uos-department-product-tech` repo

## Non-Goals

- Replacing existing incident systems or CI systems of record
- Shipping fake or simulated integrations as production behavior
- Keeping a second `@uos/department-product-tech` implementation alive

## Product Requirements

### 1. Launch Gate Integration

The live readiness flow should be extended to ingest evidence from CI/CD and
other launch gates:

- test coverage
- security scan status
- performance benchmarks
- documentation readiness
- stakeholder sign-off

The system must expose both raw gate results and a summarized impact on launch
readiness.

### 2. Launch Decision Assistant

The readiness service should produce a stronger go / no-go assessment that
considers:

- launch-gate results
- connector health
- open risks
- mitigation completeness
- required approvals or sign-offs

The output should be explainable and auditable rather than opaque.

### 3. Rollback Plan Generation

Every launch packet should be able to include a structured rollback plan with:

- trigger conditions
- ordered rollback steps
- ownership
- evidence needed to confirm safe rollback

### 4. Incident Prediction Signals

The product-tech overlay should support a future-facing incident-prediction
surface built from:

- code-change patterns
- dependency risk
- operational anomaly signals

This should begin as decision support, not autonomous production action.

### 5. Incident Learning Continuity

Incident prediction and launch readiness should feed the existing incident
learning loop so the system improves launch checklists, enablement assets, and
postmortem follow-through over time.

## UX / Operator Surface

The plugin UI should add:

- launch gate summaries inside readiness packets
- go / no-go evidence framing
- rollback-plan visibility
- predictive incident risk indicators for launches

## Success Metrics

- launch packets consistently include structured gate evidence
- blocked launches are explained by explicit failing inputs
- rollback plans exist for high-risk launches by default
- incident learning updates readiness criteria after real incidents

## Delivery Phases

### Phase 1

- port launch gate data structures and readiness extensions
- add rollback-plan generation hooks
- keep integrations stubbed or adapter-based until backed by real systems

### Phase 2

- integrate real CI/CD and artifact evidence sources
- wire incident-learning updates back into readiness scoring

### Phase 3

- add predictive incident risk modeling with operator review
- expand to product analytics and other release-quality evidence only after the
  core readiness flow is stable

## Why This Is Worth Salvaging

The cleanup-target repo is not worth keeping as a separate package repo, but it
does contain a useful product direction: making launch readiness less manual and
more evidence-driven, with stronger incident awareness.


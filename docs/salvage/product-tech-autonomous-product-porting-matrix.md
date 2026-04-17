# Product-Tech Autonomous Product Porting Matrix

This matrix maps the salvageable functionality from
`uos-department-product-tech-autonomous-product` into the live
`uos-department-product-tech` repo.

Priority scale:

- `P1` ship first because it improves the canonical readiness flow directly
- `P2` important follow-on work once the readiness surface is stronger
- `P3` valuable later, but should not outrun real integrations and evidence

| Feature cluster | Cleanup-target source file(s) | Live destination module(s) | Priority | Notes |
| --- | --- | --- | --- | --- |
| CI/CD launch gate model | `src/readiness/pipeline-connector.ts` | `src/launch-readiness-service.ts`, `src/types.ts`, `src/connector-health.ts` | P1 | Keep the model and gate concepts, but replace simulated API behavior with adapter contracts and evidence inputs. |
| Readiness decision assistant | `src/readiness/launch-readiness.ts`, `src/readiness.ts` | `src/launch-readiness-service.ts`, `src/types.ts`, `src/ui/index.tsx` | P1 | Merge the stronger go / no-go framing into the existing live readiness service rather than creating a parallel readiness subsystem. |
| Rollback plan generation | `src/readiness/launch-readiness.ts` | `src/launch-readiness-service.ts`, `src/types.ts` | P1 | Good feature fit for the live repo. Model rollback plans explicitly in the launch packet. |
| Incident prediction | `src/incident/predictor.ts` | `src/incident-risk-service.ts`, `src/types.ts`, `src/ui/index.tsx` | P2 | Introduce as a new service in the live repo, but treat the current file as concept scaffolding because its data sources are simulated. |
| Incident-learning decomposition | `src/incident.ts`, `src/incident/learning.ts` | `src/incident-learning-service.ts`, `src/types.ts` | P2 | Use any stronger types or reporting structure, but keep the live service as the canonical entry point. |
| Product command-center ideas | README / `uos-department-product-tech.md` PRD concepts | `PRD.md`, future UI work in `src/ui/index.tsx` | P3 | Preserve as roadmap concepts, not immediate implementation. |

## No-Keep Decision

`uos-department-product-tech-autonomous-product` should not remain as a live
repo because:

- it publishes the same package name, `@uos/department-product-tech`
- it overlaps heavily in runtime scaffolding and mission
- its unique modules are mostly concept extensions rather than a separate
  product line
- it contains weaker repo hygiene signals than the canonical repo, including a
  worktree metadata file and a thinner documentation surface

## Archive Trigger

Archive the cleanup-target repo after this salvage documentation lands in the
canonical repo.

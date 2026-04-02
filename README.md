# @uos/department-product-tech

Department overlay for product and technology roles, scheduled jobs, skill mappings, and connector policy.

This repo intentionally keeps only product-and-technology-shaped material. Cross-cutting provisioning logic, runtime orchestration, and Paperclip compatibility stay in `@uos/core`, `@uos/plugin-connectors`, and `@uos/paperclip-compat`.

## Included

- product and technology leadership plus delivery, research, platform, and reliability roles
- launch and reliability recurring jobs
- product-tech external skill mappings
- engineering and research connector toolkit requirements and role access snapshots

## Does not include

- global provisioning engine
- non-product or non-technology departments
- shared platform compatibility or Paperclip host overrides

## Validation

```bash
npm install
npm run build
npm test
```

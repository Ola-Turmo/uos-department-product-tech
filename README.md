# @uos/department-product-tech

The product and engineering operating layer for research, launch readiness, platform enablement, and production reliability.

This package extends [Paperclip](https://github.com/paperclipai/paperclip), the open-source control plane for agentic teams, with the product-tech opinion needed to move from ideas to releases without losing clarity or safety.

## Why It Matters

A company operating system needs more than “write code.” It needs product judgment, research loops, launch gates, platform ownership, and reliability review. This repo makes that combined product-tech layer independently explainable and independently shippable.

## What This Repo Owns

- product and technology leadership plus delivery, research, platform, and reliability roles
- recurring launch-readiness and reliability review loops
- product-tech skill mappings for research, security, extraction, and platform support
- connector and toolkit snapshots for engineering and source-backed product work

## What It Does Not Own

- global provisioning engine and runtime orchestration
- non-product and non-technology departments
- Paperclip compatibility and upstream integration governance

Those cross-cutting concerns stay in `@uos/core`, `@uos/plugin-connectors`, and `@uos/paperclip-compat`.

## Relationship To Paperclip

Paperclip still owns the platform substrate. This repo layers a product-tech operating model on top so the same Paperclip instance can behave like a real product and engineering organization.

## Best Fit

- teams that want launch and reliability to be part of the operating model, not side notes
- builders packaging an AI-native product org on top of Paperclip
- operators who need research, delivery, and platform concerns to live in one coherent department overlay

## Validation

```bash
npm install
npm run build
npm test
```

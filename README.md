# Reltio Autonomous Agents ROI Model

A local, interactive ROI model for the Address Enricher Agent (AEA2). It separates measured benchmarks, external evidence, and assumptions while modeling labor capacity, processing cost, quality, review, remediation, time-to-value, and build-versus-buy economics.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite.

## Verify

```bash
npm test
npm run lint
npm run build
```

## Initial benchmark

- 20,000 successfully processed entities
- 695 minutes wall-clock duration
- $5,215 customer cost
- 1,727 records per hour
- 150 parallel workers
- 91% decision correctness on an internal labeled test set

## Modeling principles

- Capacity released is the default value story, not headcount reduction.
- The model can produce negative ROI.
- Downstream value is disabled by default.
- Extrapolations beyond the measured run are labeled.
- Automation rate and decision correctness remain separate inputs.
- Build-versus-buy economics remain separate from operational ROI.

## UX references

The experience adapts interaction and visualization patterns from:

- [shadcn/ui](https://ui.shadcn.com/) for accessible dashboard controls and neutral surfaces
- [Beautiful UI](https://beautifului.dev/) for insight, provenance, and status patterns
- [beUI](https://beui.dev/) for animated values, segmented controls, and responsive sliders
- [Transitions.dev](https://transitions.dev/) for restrained state transitions
- [Rare UI](https://rareui.com/) as a reference for selective motion and interaction polish

The implementation uses original application code rather than copying components from these sites.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

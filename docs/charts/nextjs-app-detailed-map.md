# Nextjs-App Detailed File and Module Map

This chart is specific to the `nextjs-app/` subtree and intentionally separate from root-app migration charts.

```mermaid
flowchart TD
  U[User]
  B[Browser]

  U --> B

  subgraph ROUTING[App Router Surface]
    R0["nextjs-app/app/page.tsx"]
    R1["nextjs-app/app/layout.tsx"]
    R2["nextjs-app/app/globals.css"]
    R3["nextjs-app/app/favicon.ico"]
  end

  B --> R0
  R1 --> R0
  R1 --> R2
  R1 --> R3

  subgraph UI[Runtime UI Modules]
    M0[Home component]
    M1[RootLayout component]
    M2[next/image usage]
    M3[next/font/google Geist and Geist_Mono]
    M4[Metadata title and description]
  end

  R0 --> M0
  R0 --> M2
  R1 --> M1
  R1 --> M3
  R1 --> M4

  subgraph STYLING[Styling System]
    S0[Tailwind v4 import]
    S1[CSS variables background and foreground]
    S2[Theme token mapping]
    S3[Dark mode media query]
  end

  R2 --> S0
  R2 --> S1
  R2 --> S2
  R2 --> S3

  subgraph STATIC[Public Static Assets]
    P0["nextjs-app/public/next.svg"]
    P1["nextjs-app/public/vercel.svg"]
    P2["nextjs-app/public/file.svg"]
    P3["nextjs-app/public/globe.svg"]
    P4["nextjs-app/public/window.svg"]
  end

  M2 --> P0
  M2 --> P1

  subgraph CONFIG[Build and Tooling]
    C0["nextjs-app/package.json"]
    C1["nextjs-app/next.config.ts"]
    C2["nextjs-app/tsconfig.json"]
    C3["nextjs-app/eslint.config.mjs"]
    C4["nextjs-app/postcss.config.mjs"]
    C5["nextjs-app/README.md"]
  end

  C0 --> D0[next 16.2.2]
  C0 --> D1[react 19.2.4]
  C0 --> D2[react-dom 19.2.4]
  C0 --> D3[Scripts dev build start lint]
  C4 --> S0
```

## Scope notes

- This map reflects only the current `nextjs-app/` implementation.
- It does not include root-level app routes, legacy pages, importer modules, or root `lib/` modules.
- As porting progresses, this file should be updated to show newly migrated routes and feature modules inside `nextjs-app/`.

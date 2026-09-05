# Browser E2E

The browser gate uses official Playwright with Chromium only.

For a first local run:

```sh
npm install
npx playwright install chromium
npm run test:e2e
```

If the local network cannot reach the official npm registry, GitHub Actions is
the authoritative dependency-installation and browser-validation environment.
Do not use unofficial registries or copied browser packages as a workaround.

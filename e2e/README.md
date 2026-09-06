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

Run the Store Studio journey with `npm run test:e2e:store`.

Run the canonical public Cart → Checkout → Order journey with
`npm run test:e2e:commerce`. Its CI workflow uses a test-only same-origin Vite
proxy so relative `/api` requests reach the isolated backend without browser
interception or mocks.

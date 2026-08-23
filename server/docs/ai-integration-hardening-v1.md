# AI Integration Hardening v1

Business Brain follows `route → domain service → versioned operation policy → provider-neutral adapter → OpenAI Responses API`. It requires strict Structured Outputs and a second domain validation pass. Provider refusals, malformed data, timeouts, authentication failures, rate limits, and availability failures map to bounded internal error codes; raw provider payloads and messages never reach the API.

`BUSINESS_BRAIN_ANALYSIS` uses `OPENAI_BUSINESS_BRAIN_MODEL` (default `gpt-5.6-terra`), low reasoning, a 10,000-character aggregate input ceiling, 1,600 output tokens, a 25-second timeout, no tools, no side effects, and zero automatic retries. A tenant/user-local limiter and short exact-duplicate cache reduce accidental development spend. Ambiguous timeout outcomes are not retried.

`CONTENT_TEXT_GENERATION` retains its domain contract and persistence behavior while sharing the same provider adapter. Its model comes from `OPENAI_CONTENT_MODEL` (default `gpt-5.6-luna`). Usage normalization is provider-neutral and no new durable usage ledger is introduced.

`/api/ai/chat` remains explicitly assigned to Cloudflare. `/api/agent/run` remains an internal experimental path and receives no additional tools or execution capability. Neither path returns raw provider output.

Local configuration names are `OPENAI_API_KEY`, `OPENAI_CONTENT_MODEL`, `OPENAI_BUSINESS_BRAIN_MODEL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_MODEL`. Values belong only in ignored environment files. Never use a `VITE_` variable for provider secrets or persist credentials in SQLite.

Future providers should implement the narrow structured-operation adapter and receive an explicit code-owned policy binding. Domain routes and schemas must remain provider-neutral.

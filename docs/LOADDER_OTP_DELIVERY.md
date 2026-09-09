# Production OTP delivery

The existing mobile OTP/session contract uses SMS.ir verification templates via native HTTP, not a new SDK or messaging subsystem. Provider-owned reference: https://github.com/IPeCompany/SmsPanelV2.nodejs (SendVerifyCode). A provider acceptance is not proof of handset delivery.

Server environment only: `SMS_IR_API_KEY`, positive integer `SMS_IR_OTP_TEMPLATE_ID`, and `SMS_IR_OTP_PARAMETER` (default `CODE`, matching the approved template). No default template ID is supplied. Obtain provider approval separately; configuration does not prove approval or live validation. Never put values in frontend variables, SQLite, Git or reports.

Missing/invalid configuration returns 503. The fixed HTTPS verification endpoint rejects redirects, uses a 10-second abort and an 8 KiB response bound, and never retries automatically. Provider failure returns a sanitized error. A successful provider response must have status 1 and a positive message ID. Raw responses, OTPs and API keys are not logged or persisted.

The existing five-digit random OTP, HMAC hash, two-minute expiry, attempt limit and session semantics remain. Production creates the hash-only challenge after provider acceptance; failed delivery leaves any previous challenge unchanged. Persistence failure after acceptance must remain an error, never fake success. Plaintext exists only transiently for delivery. Development OTP bypass requires both non-production mode and explicit development exposure.

The existing per-IP rate limit remains. At most 16 sends may be pending per process, one per mobile. This is a bounded single-instance protection, not distributed rate limiting or a provider spending quota. For 50/500/5000 users, concurrency and SMS volume—not registrations alone—determine provider cost and capacity. No worker/service/dependency was added; measure contention before scaling.

`productionReady` remains false; delivery status distinguishes not connected from configured/live-validation-pending. Before paid pilot, authorize a real recipient and verify approved template delivery → OTP verification → secure session on the intended HTTPS deployment. Record exact SHA/time/result without OTP, phone or credentials. Also verify provider outage handling and proxy/rate-limit configuration. Automated tests use an isolated DB and injected provider transport; they do not constitute live SMS evidence.

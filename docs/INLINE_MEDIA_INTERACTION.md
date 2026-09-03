# Inline Media Interaction

Canonical Loadder media rule:

- Media is edited at the place where it is rendered.
- Hero, banner, logo and product imagery expose a local `+` / replace control.
- File selection immediately starts upload; there is no second confirmation button and no detached media modal for the primary flow.
- The active project identity comes from the mounted Studio; media components never rediscover a project.
- Upload success must immediately update the rendered element and keep the URL in Studio state for persistence.
- Upload failure must stay on the same canvas element and surface an explicit error.

This is a Poka-Yoke rule: media upload must not depend on a hidden modal target state that can drift away from the element the merchant is editing.
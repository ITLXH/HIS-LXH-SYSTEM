# Login center layout repair — 2026-10-24

## Context
On 2026-10-24 the HIS login box at `https://his.luckxayhospitallaos.com/dashboard` appeared left-aligned in the upper corner of a desktop screenshot rather than centered horizontally/vertically.

## Root cause
`index.html` places the login in `#login-section.login-page` containing `.login-box`.
`src/style.css` defined `.login-page { display: flex; align-items: center; justify-content: center; }`, but multiple session transitions in `src/main.js` use `$('#login-section').show()`. jQuery can set an inline `display: block` on the login container, which overrides the regular CSS flex layout. The previous `margin-top: calc(var(--nav-height) * -1)` additionally shifted the card despite there being no visible navigation bar in the unauthenticated view.

## Change
In `src/style.css`:
- Size the login viewport with `min-height:100dvh` plus `100vh` fallback, `height:auto`, `width:100%`, simple padding and `margin-top:0`.
- Restore `display:flex !important` ONLY for `body:not(.auth-checking) #login-section.login-page` when its inline style explicitly contains `display:block` (with or without the space).
- Retain the existing `body.auth-checking #login-section { display:none !important; }` and allow the jQuery `.hide()` inline `display:none` to keep working.
- Horizontally center `.login-box` with `margin-inline:auto`.

## Scope and safety
No changes to login credentials, Supabase authorization, HIS/LIS clinical result notification checks, database, environment variables, or production data. The change is confined to the login container's CSS, with a static contract test in `scripts/test-login-center-layout.mjs`. The CSS intentionally does **not** introduce an unconditional `display:flex !important` rule because that would defeat the `.hide()` login state.

## Validation and deployment
Run:
```bash
node scripts/test-login-center-layout.mjs
npm run test:auth
npm run test:auth-session
npm run test:security
node scripts/test-notification-auth-boundary.mjs
npm run build
```
Check login in Chromium/Edge (desktop and mobile viewport), then sign in, sign out and let the session expire: login must be centered when shown and hidden after sign-in, with no patient notifications before authentication.

GitHub CI workflow runs tests/build on the repair PR and on `main`. Cloudflare Pages auto-deploy must be verified in checks after merging. Never claim live browser validation from build status alone.

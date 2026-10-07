# Security notes

SoloOS is experimental source code, not a security-certified production service. No external services are required to publish or review it.

## Implemented boundaries

- Protected workspace routes require authentication, including portfolio routes. Missing service configuration never bypasses authentication.
- Service-backed API routes fail closed when Supabase is absent.
- User-owned records use Supabase row-level security. Apply all migrations when provisioning a connected installation.
- User-supplied outbound URLs pass protocol and DNS checks. Connections are pinned to the validated public IP, preserving the HTTP Host and TLS SNI.
- Redirect destinations are rechecked; cross-origin credentials and HTTPS-to-HTTP downgrades are blocked.
- Downloads cap actual streamed and decompressed bytes. Figma processing limits input pixels and output dimensions.
- Figma API tokens are restricted to the API origin and redirects are rejected.
- The shared client-writable Figma cache is disabled. The included migration removes authenticated access while preserving rows.
- Private environment files are ignored. Publication checks scan common credential patterns in source and reachable history, without printing values. They are not exhaustive.
- CV/application APIs validate bounded input, reject cross-origin mutations and scope every read/update/delete to the signed-in user. Linked cover letters must belong to that same user. Legacy unsafe job links are not rendered. CV PDFs use bundled fonts and authenticated exports; they do not fetch user-supplied URLs.

## Remaining limitations

- AI rate limiting is process-local, not distributed. Multi-instance deployment requires a shared limiter and spending limits.
- Model output and public webpages are untrusted. Schema validation does not guarantee factual correctness or prevent all prompt injection.
- Connected authentication, RLS behavior, AI calls and external integrations need live integration tests with a dedicated test account before production use.
- An existing remote database needs the cache-quarantine migration. Publishing source does not apply it remotely.
- `npm audit` reports the unpatched `braces` recursion advisory through build/lint tooling, including Tailwind and ESLint. Do not build untrusted source/glob patterns. Recheck dependencies before deploying; no zero-vulnerability claim is implied.

Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

## Reporting

Never disclose credentials, CV contents or other personal data in public issues. Revoke exposed credentials with their providers; deleting a file does not invalidate a key or erase Git history.

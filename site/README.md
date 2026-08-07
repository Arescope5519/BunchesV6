# melibri.app - public site

Three static pages. Their only job right now is to satisfy the store
requirement for reachable Terms and Privacy links, and to back the URLs
already hardcoded in `src/constants/app.js`:

- `/terms`   <- `TERMS_URL`
- `/privacy` <- `PRIVACY_URL`

No build step, no dependencies. Edit the HTML and redeploy.

## Deploying to Cloudflare Pages

1. Cloudflare dashboard -> **Workers & Pages** -> **Create** -> **Pages**
   -> **Connect to Git**, and pick this repo.
2. Build settings:
   - Framework preset: **None**
   - Build command: *leave empty*
   - Build output directory: `site`
3. Deploy. You get a `*.pages.dev` URL immediately.
4. **Custom domains** -> add `melibri.app` and `www.melibri.app`.
   Cloudflare writes the DNS records itself because the domain is already
   in the same account.

Pages serves clean URLs, so `terms.html` is reachable at `/terms` with no
extra config. That is what the app links to - do not rename the files
without updating `src/constants/app.js`.

`.app` is on the HSTS preload list, so the domain is HTTPS-only by
design. Pages issues the certificate automatically; there is nothing to
configure, but a host without TLS would fail outright rather than warn.

## Before publishing

- Update the "Last updated" date on both pages if they change.
- `privacy@melibri.app` and `hello@melibri.app` must both actually
  receive mail - the store reviewers do check.

## These are drafts

Written to describe what the app genuinely does, not from a template.
They have not been reviewed by a lawyer. Re-read them whenever the app's
data handling changes - a new third-party service, a new category of
collected data, or a change to the deletion window all make the Privacy
Policy wrong until it is updated.

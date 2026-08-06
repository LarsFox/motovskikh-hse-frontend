# Achievements frontend integration

The reusable UI is in `src/js/achievements.js`; styles are isolated in Shadow DOM
and loaded from `src/css/achievements.css`. The normal page entry point is
`src/js/achievements-page.js`, with the Pug page in `src/achievements/index.pug`.

Build an image path from the stable achievement slug:

`/img/achievements/<slug>.svg`

Only `src/img/achievements/star.svg` is supplied for the prototype. Missing
per-achievement images fall back to this asset, so art can be added later without
changing API or table rows.

The UI supports Russian and English responses, keyboard Escape/close, focus
return, filters for all/earned/locked items, a newly-earned toast and a full-width
mobile layout below 600px. Integrate the page through the repository's normal
hash/copy pipeline. Integrate result submission by keeping the existing
`/tests/submit/` request and showing every item returned in `new_achievements`.

The browser extension is a test adapter, not production code. Production must use
same-origin credentials and the site's current authenticated result request.

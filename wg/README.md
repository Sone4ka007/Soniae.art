# Sonya's Walking Gallery

Launch infrastructure for the participatory Walking Gallery project.

## Public flow

1. A physical artwork carries a short QR URL such as `https://sonyae.art/1`.
2. The QR opens the artwork page, e.g. `/wg/001/`.
3. A viewer photographs the artwork in its new exhibition place.
4. The viewer pastes what Yandex Maps copied; the site extracts the map link and place name.
5. The photo is compressed in the browser and stored in Netlify Blobs (`wg-photos`).
6. The stop is stored as `pending` in Netlify Blobs (`wg-submissions`).
7. Nothing becomes public until it is approved in `/wg/admin/`.
8. Approval moves the stop to `wg-public`; rejection deletes the pending stop and its photo.

## Moderation

The admin dashboard is available at `/wg/admin/`.

Set a dedicated Netlify environment variable before launch:

`WG_ADMIN_SECRET=<long random secret>`

The secret is never stored in GitHub. The admin page keeps it only in `sessionStorage` for the current browser tab.

## Storage

- original artwork images: repository/static site assets;
- approved route/history records: Netlify Blobs `wg-public`;
- pending submissions: Netlify Blobs `wg-submissions`;
- viewer photographs: Netlify Blobs `wg-photos`.

## Short QR routes

Numeric routes `/1` through `/20` are reserved and redirect to `/wg/001/` through `/wg/020/`. Only artworks listed in `content/walking-gallery.json` are visible as launched works.

## Launch checklist

- add each artwork to `content/walking-gallery.json`;
- add its original image under a stable static path;
- set `WG_ADMIN_SECRET` in Netlify;
- test `/wg/`, `/1`, `/wg/001/`, photo submission and `/wg/admin/` on mobile;
- approve one test submission and verify that its photo/history appears publicly;
- only then merge the draft PR to `main`.

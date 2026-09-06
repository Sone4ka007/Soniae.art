# Walking Gallery gateway

Маленький Cloudflare Worker для Sonya's Walking Gallery. Сам сайт и все одобренные данные живут в GitHub/GitHub Pages. Worker ничего постоянно не хранит: он только принимает пользовательскую форму, отправляет её Соне в Telegram и после нажатия «Одобрить» записывает фото + остановку в GitHub.

## Поток

1. `sonyae.art/1` открывает `SWG-001`.
2. Зритель добавляет фото, место и комментарий.
3. `POST /submit` пересылает фото и заявку в Telegram.
4. В Telegram появляются кнопки `✅ Одобрить` / `✕ Отклонить`.
5. При одобрении Worker скачивает Telegram-фото, добавляет его в `assets/wg/stops/...` и обновляет `content/walking-gallery-stops.json` одним GitHub commit.
6. GitHub Pages автоматически публикует обновление из `main`.

Pending-заявки не требуют отдельной БД: до решения они существуют только как сообщения в приватном Telegram-чате.

## Переменные

Обычные vars в `wrangler.toml`:

- `ALLOWED_ORIGINS=https://sonyae.art,https://www.sonyae.art`
- `ALLOWED_ARTWORKS=SWG-001`
- `GITHUB_REPOSITORY=Sone4ka007/Soniae.art`
- `GITHUB_BRANCH=main`

Секреты — только через Cloudflare, никогда не коммитить:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_ID`
- `TELEGRAM_WEBHOOK_SECRET` — случайная длинная строка для проверки webhook Telegram
- `GITHUB_TOKEN` — fine-grained GitHub token только для этого repo, Contents: Read and write
- `SETUP_SECRET` — отдельная случайная строка для одноразовой настройки webhook

## Развёртывание

```bash
cd worker/walking-gallery
cp wrangler.toml.example wrangler.toml
npm install
npx wrangler login
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_ADMIN_ID
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put SETUP_SECRET
npm run deploy
```

После deploy один раз зарегистрировать webhook:

```bash
curl -X POST "https://<worker>.workers.dev/setup" \
  -H "x-setup-secret: <SETUP_SECRET>"
```

Если Telegram ID неизвестен, webhook можно сначала настроить, написать боту `/id`, затем записать полученный ID в `TELEGRAM_ADMIN_ID`.

После deploy вставить URL `https://<worker>.workers.dev/submit` в `project.submitEndpoint` файла `content/walking-gallery.json`.

## Безопасность

- запросы `/submit` принимаются только с разрешённых Origin;
- изображение после клиентского сжатия — JPEG не более 3 MB;
- есть honeypot и минимальное время заполнения формы;
- callback модерации принимает решение только от `TELEGRAM_ADMIN_ID`;
- Telegram webhook проверяется через secret token;
- GitHub token существует только как secret Worker;
- пользовательский ввод экранируется на публичном сайте.

Перед массовым запуском можно дополнительно подключить Cloudflare Turnstile/Rate Limiting, если появится спам.

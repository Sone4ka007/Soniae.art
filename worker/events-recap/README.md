# Events recap Telegram inbox

Отдельный Worker только для личного архива посещённых событий. Он не связан с Walking Gallery и Netlify.

## Как пользоваться в Telegram

Бот должен быть администратором отдельного приватного канала.

1. Начать сбор материалов:
   `/event часть названия события`
   
   Можно вместо названия указать точный `event_id` из Google Sheet.

2. После подтверждения отправлять в канал:
   - обычный текст и конспекты;
   - фото и фотоальбомы;
   - PDF/документы;
   - ссылки.

3. Проверить, что собрано:
   `/status`

4. Сохранить как скрытый черновик:
   `/save`

5. Сразу опубликовать в разделе «ПОСЛЕ СОБЫТИЙ»:
   `/publish`

6. Сбросить текущий незавершённый сбор:
   `/reset`

После `/save` или `/publish` Worker:
- ставит `attended=true`;
- сохраняет текст в `recap_notes`;
- загружает фото и документы в `assets/events/recaps/<event_id>/`;
- добавляет ссылки в `recap_links`;
- первый PDF делает `recap_press_release_url`;
- обновляет тот же объект события в `content/events.json`;
- очищает временную Telegram-сессию.

## Почему нужен KV

Telegram присылает каждое сообщение/фото отдельным webhook. KV хранит только временный черновик между первым `/event` и `/save` / `/publish`. Срок жизни черновика — 14 дней.

## Cloudflare setup

Создать KV namespace:

```bash
cd worker/events-recap
npx wrangler kv namespace create RECAP_KV
```

Полученный ID вставить в `wrangler.toml`.

Секреты:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_RECAP_CHAT_ID
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put SETUP_SECRET
```

`GITHUB_TOKEN` — fine-grained token только для `Sone4ka007/Soniae.art`, Contents: Read and write.

Deploy:

```bash
npm install
npm run deploy
```

Затем один раз зарегистрировать webhook:

```bash
curl -X POST "https://<worker>.workers.dev/setup" \
  -H "x-setup-secret: <SETUP_SECRET>"
```

## Важное

Worker принимает только сообщения из `TELEGRAM_RECAP_CHAT_ID`. Публикация происходит только по явной команде `/publish`. Обычная отправка фото/текста ничего публично не меняет.

# Telegram-бот для добавления работ

Бот принимает фотографию с подписью, сохраняет изображение в `assets/images/`, добавляет работу в `content/series.json` и создаёт commit в GitHub. После commit Netlify автоматически обновляет сайт.

## Формат сообщения

Отправь боту одну фотографию и добавь подпись:

```text
Название: Утренний кофе
Серия: Городские зарисовки
Год: 2026
Материалы: смешанная техника
Размер: А3
Описание: Короткое описание
Статус: доступна
Цена: по запросу
Главная: нет
```

Обязательны только `Название` и `Серия`. Название серии должно совпадать с существующей серией на сайте.

Команды:

- `/start` или `/help` — показать шаблон;
- `/id` — показать Telegram ID пользователя.

## Переменные Netlify

В `Project configuration → Environment variables` нужно добавить:

- `TELEGRAM_BOT_TOKEN` — токен от BotFather;
- `TELEGRAM_ADMIN_ID` — Telegram ID владельца;
- `TELEGRAM_WEBHOOK_SECRET` — случайная секретная строка;
- `TELEGRAM_SETUP_SECRET` — другая случайная секретная строка;
- `GITHUB_TOKEN` — fine-grained GitHub token с доступом только к `Sone4ka007/Soniae.art` и разрешением `Contents: Read and write`.

После сохранения переменных нужно запустить новый deploy.

## Подключение webhook

Открой в браузере:

```text
https://АДРЕС-САЙТА/.netlify/functions/telegram-setup?secret=TELEGRAM_SETUP_SECRET
```

При успешной настройке появится JSON с `"ok": true` и адресом webhook.

Секретные значения нельзя публиковать в GitHub или пересылать посторонним.
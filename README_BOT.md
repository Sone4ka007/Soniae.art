# Telegram-бот для добавления работ

Сайт уже читает каталог из `content/works.json`. Бот добавляет изображение и новую запись в этот файл через GitHub API.

## Формат сообщения

Отправь боту фотографию с подписью:

```
#work
Название: Утренний кофе
Серия: Городские зарисовки
Год: 2026
Материалы: смешанная техника
Размер: А3
Описание: Короткое описание
Статус: available
Цена: по запросу
```

## Что настроить в Netlify

Environment variables:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_ID`
- `GITHUB_TOKEN`
- `GITHUB_REPOSITORY` — в формате `owner/repository`
- `GITHUB_BRANCH` — обычно `main`

После публикации установить webhook:

```
https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://<ДОМЕН>/.netlify/functions/telegram-bot
```

Токен GitHub должен иметь право записи в Contents выбранного репозитория.

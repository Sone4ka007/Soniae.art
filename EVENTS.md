# Events aggregator

Source of truth: `content/events.json`.

Only records with `"status": "approved"` are shown publicly. Past dates are hidden automatically in the browser.

## Event schema

```json
{
  "id": "moscow-2026-09-23-example",
  "status": "new",
  "city": "moscow",
  "date": "2026-09-23",
  "time": "19:00",
  "title": "Название события",
  "venue": "Площадка",
  "address": "Адрес",
  "price": 0,
  "price_text": "Бесплатно",
  "registration": true,
  "categories": ["lecture", "photo"],
  "description": "Короткое описание",
  "url": "https://primary-source.example/event",
  "source": "Название первичного источника",
  "checked_at": "2026-09-20"
}
```

Allowed status values:
- `new` — collected automatically, not reviewed
- `check` — needs manual verification
- `approved` — editor approved, appears on site
- `rejected` — excluded

Publication rule: an event must not become `approved` unless its exact date and year are confirmed on an active primary source. Registration/ticket availability should be checked separately.

Editorial exclusions currently planned for the collector:
- exclude events with Alim Velitov
- exclude plein airs unless the event is by Alexey Geld
- never auto-delete ambiguous borderline events; mark them `check`

## Post-event archive

Attendance and post-event publishing are separate from moderation. Automatic collectors must never set these fields.

Optional fields on an existing event record:

```json
{
  "attended": true,
  "recap_status": "draft",
  "recap_title": "Что осталось после лекции",
  "recap_notes": "Конспект, личные заметки или короткий текст.",
  "recap_press_release_url": "https://...",
  "recap_links": "https://...\nhttps://...",
  "recap_photo_urls": "/assets/events/recaps/example-01.jpg\nhttps://...",
  "recap_updated_at": "2026-09-23"
}
```

Rules:
- `attended` is set manually by the editor only.
- `recap_status` is `draft` or `published`.
- the public “ПОСЛЕ СОБЫТИЙ” tab shows only records with `status=approved`, `attended=true`, and `recap_status=published`;
- draft recap fields are preserved by collector/merge runs and remain private;
- multiple links/photo URLs can be entered as newline-separated values in Google Sheet.

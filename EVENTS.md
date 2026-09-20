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

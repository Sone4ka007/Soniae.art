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

## Sketch places directory

The «Наброски» tab reads `content/sketch-places.json`, independently of the automated events pipeline. Places do not expire and are filtered by city and price. Only approved records appear. Add records to the `places` array:

```json
{
  "id": "unique-place-id",
  "status": "approved",
  "title": "Название",
  "city": "spb",
  "venue": "Площадка",
  "address": "Адрес",
  "schedule": "Расписание встреч — у организатора",
  "description": "Формат встреч и что рисуют",
  "price_type": "unknown",
  "price_text": "Стоимость уточняйте у организатора",
  "registration": true,
  "url": "https://example.org/"
}
```

Use `moscow` or `spb` for city and `free`, `paid` or `unknown` for price_type. Omit registration if unknown. Keep organizer links current.

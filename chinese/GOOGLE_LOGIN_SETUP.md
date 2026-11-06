# Chinese Lab — настройка входа через Google

**Статус:** код готов, но реальный вход не работает, пока не создан и не подключён Supabase-проект. Без конфигурации тренажёр продолжает работать как раньше, с локальным прогрессом.

## 1. Supabase Free

1. Создай проект в https://supabase.com/dashboard.
2. Открой **SQL Editor**, выполни `chinese/supabase/schema.sql`. Таблица `public.chinese_lab_progress` защищена RLS: каждый вошедший пользователь может читать и изменять только свои данные.
3. В **Authentication → URL Configuration** установи Site URL `https://sonyae.art/chinese/` и добавь Redirect URL `https://sonyae.art/chinese/`.

## 2. Google Cloud OAuth

1. В https://console.cloud.google.com/auth/branding настрой экран согласия приложения **Chinese Lab** и аудиторию (для тестирования — test users).
2. В **Google Auth Platform → Clients** создай OAuth Client **Web application**.
3. В **Authorized JavaScript origins** укажи **`https://sonyae.art`** (без `/chinese/`).
4. В **Authorized redirect URIs** укажи callback Supabase **`https://PROJECT_REF.supabase.co/auth/v1/callback`**, скопированный из настроек Google provider в Supabase. Это **не** адрес `sonyae.art/chinese/`.
5. В **Supabase → Authentication → Providers → Google** включи провайдер, вставь **Client ID** и **Client Secret**. Секрет хранится **только** внутри настроек Supabase, никогда не публикуется в GitHub.

## 3. Подключение сайта

Открой `chinese/config/supabase.js` и укажи:

```javascript
window.CHINESE_LAB_SUPABASE = {
  url: 'https://PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_...' // либо legacy anon key
};
```

Project URL и **publishable/anon key** — публичные значения, могут находиться в статическом коде при включённом RLS. **Не вставляй service_role, secret key, Google Client Secret, personal access token**. Когда оба значения заполнены, на сайте появится кнопка **ВОЙТИ ЧЕРЕЗ GOOGLE**.

## 4. Как работает прогресс

- До входа: прежний ключ `sonya-chinese-lab-progress-v1` для гостевого профиля.
- После входа: локальные данные каждого Google-аккаунта сохраняются отдельно в ключе `sonya-chinese-lab-progress-v1-user-<uuid>`.
- При первом входе можно явно привязать прежний гостевой прогресс; автоматического перезаписывания нет.
- Когда облачный и локальный профили отличаются, пользователь выбирает источник. Можно заранее скачать обе версии в формате, совместимом с обычным импортом JSON.
- Изменения сначала сохраняются локально, потом отправляются в Supabase. При сбоях или конфликте ревизий синхронизация останавливается без потери локальных данных.
- **Ограничение начальной версии:** автоматическая синхронизация проверяет конфликты при записи, но не обновляет экран мгновенно с другого устройства. При параллельной работе на двух устройствах потребуется выбрать одну версию.
- Выход из аккаунта возвращает гостевой профиль, не удаляя пользовательский локальный и облачный прогресс.

## 5. Проверка перед публичным выпуском

1. Открой страницу в чистом браузере. Войди через Google, проверь возврат на `https://sonyae.art/chinese/`.
2. Пройди упражнение, проверь свою запись в Supabase и открой сайт на другом устройстве.
3. Проверь миграцию гостевого прогресса, выбор облачной версии, выход и повторный вход.
4. Проверь ограничения RLS с **двумя разными Google-аккаунтами** — данные другого аккаунта недоступны.
5. Проверь работу без интернета и восстановление из JSON-файла. Проверь внешние ресурсы в CSP, если заголовки сайта будут ужесточаться.

Документация: 
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/database/postgres/row-level-security

# Secure Google Sheet sync

The moderation spreadsheet is private. GitHub Actions sync through a Google service account.

Spreadsheet ID:

`1CCwWqojYzfTHWZ2ewH_F6S0hnrboum3HH4TtbLRqrcA`

## One-time setup

1. In Google Cloud create a project and enable **Google Sheets API**.
2. Create a service account and a JSON key.
3. Share the moderation spreadsheet with the service account email as **Editor**.
4. In GitHub repository settings add:
   - Actions variable `EVENTS_SHEET_ID` = `1CCwWqojYzfTHWZ2ewH_F6S0hnrboum3HH4TtbLRqrcA`
   - Actions secret `GOOGLE_SERVICE_ACCOUNT_JSON` = the complete JSON key contents.
5. Run **Events sheet sync** with direction `push` once.

After that:
- collector adds candidates to `content/events.json`;
- `push` copies the database into Google Sheet;
- editor changes `status`, `editor_note`, `checked_at`, `review_reason`, `price_text`, `registration`, or `categories`;
- scheduled `pull` brings those editor fields back to GitHub;
- the public site only renders `approved`.

Never commit the service-account JSON key to the repository.

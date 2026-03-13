# Job Capture — Chrome Extension

Manually capture job postings (title, company, URL, timestamp) from any job board and append them directly to a Google Sheet with one click.

---

## Folder Structure

```
job-capture-extension/
├── manifest.json          # Chrome Extension MV3 manifest
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic (extract, save, settings)
├── popup.css              # Popup styles
├── content.js             # Injected page scraper
├── appsscript.gs          # Google Apps Script (deploy separately)
├── generate-icons.js      # Optional: regenerate icons with Node + canvas
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## How It Works

```
You (click extension)
  → popup.html / popup.js
    → content.js  (extracts title, company, URL from page DOM)
  → popup shows extracted values
  → you click "Save to Sheet"
    → POST JSON → Google Apps Script Web App
      → Apps Script appends row to Google Sheet
```

No credentials are stored. The only persistent setting is the Apps Script URL, saved in `chrome.storage.sync`.

---

## PART 1 — Deploy Google Apps Script

1. Open [https://script.google.com](https://script.google.com) and sign in.
2. Click **New project**.
3. Delete the default `myFunction` code.
4. Paste the entire contents of `appsscript.gs` into the editor.
5. Click **Save** (Ctrl+S / Cmd+S). Give the project a name (e.g., "Job Capture").
6. Click **Deploy → New deployment**.
7. Click the gear icon next to "Select type" and choose **Web app**.
8. Set:
   - **Description**: `v1` (or anything)
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
9. Click **Deploy**.
10. When prompted, click **Authorize access** and follow the OAuth flow.
11. Copy the **Web App URL** — it looks like:
    ```
    https://script.google.com/macros/s/AKfycb…/exec
    ```

> **Important:** Every time you edit the Apps Script, you must create a **new deployment** (Deploy → New deployment) to make the changes live. Re-deploying to the same version will not update the running code.

---

## PART 2 — Configure the Extension

The Apps Script URL is set inside the extension popup — no code editing required.

1. Open the extension popup (click the toolbar icon).
2. Click the **gear icon (⚙)** in the top-right corner.
3. Paste your Web App URL into the input field.
4. Click **Save URL**.

The URL is stored in `chrome.storage.sync` and persists across browser sessions. You can update it at any time by repeating these steps.

---

## PART 3 — Install the Extension

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `job-capture-extension/` folder.
5. The "Job Capture" extension will appear in the list and in your toolbar.

> Pin the extension to your toolbar: click the puzzle icon → pin Job Capture.

---

## PART 4 — Usage

1. Navigate to a job posting page (LinkedIn, Greenhouse, Lever, Indeed, or any site).
2. Click the **Job Capture** toolbar icon.
3. Click **Extract Job Info** — the role, company, URL, and timestamp will appear.
4. Review the extracted values. If anything looks wrong, you can navigate to a different job page and extract again.
5. Click **Save to Sheet**.
6. You should see "Saved successfully!" and a new row will appear in your Google Sheet.

---

## Supported Job Boards

| Platform | Title selector | Company selector |
|---|---|---|
| LinkedIn | `h1` in unified top card | Company name link |
| Greenhouse | `h1.app-title` / `#header h1` | `.company-name` / URL slug |
| Lever | `.posting-headline h2` | URL path segment |
| Workday | `[data-automation-id]` | Sub-domain |
| Indeed | `h1.jobsearch-JobInfoHeader-title` | `[data-company-name]` |
| Generic | First `h1` / `[class*=title]` | Second `<title>` segment |

---

## Troubleshooting

**"Could not read this page"**
- Make sure the page is fully loaded before clicking Extract.
- Some pages (PDFs, `chrome://` pages) cannot be accessed by extensions.
- Try refreshing the tab and extracting again.

**Role or Company shows "(not found)"**
- The site uses a non-standard layout. You can manually edit the field values in your Sheet after saving.
- Open an issue or submit a PR with the correct CSS selectors for that site.

**"No Apps Script URL configured"**
- Click the gear icon and paste your Web App URL, then click Save URL.

**"Server error 401 / 403"**
- Re-check that the deployment is set to **"Anyone"** (not "Anyone with Google account").
- Try re-deploying as a new deployment and updating the URL in the extension settings.

**"Network error: Failed to fetch"**
- The Apps Script URL might have changed (each new deployment gets a new URL).
- Update the URL in the extension gear settings.

**Data not appearing in the Sheet**
- Open [https://script.google.com](https://script.google.com), open your project, go to **Executions** to see logs and errors.
- Make sure the `SPREADSHEET_ID` in `appsscript.gs` matches your sheet's ID.
- Make sure `SHEET_NAME` matches the tab name in your spreadsheet (default: `Sheet1`).

---

## Google Sheet Columns

| Column | Description |
|---|---|
| A — Timestamp | ISO 8601 datetime (UTC) |
| B — Role | Job title extracted from page |
| C — Company | Company name extracted from page |
| D — URL | Full URL of the job posting |

The header row is added automatically on the first save.

---

## Security Notes

- No API keys, tokens, or credentials are stored anywhere in the extension.
- The only external request made is a POST to your own Google Apps Script URL.
- The extension only runs when you manually click it — no background activity, no automatic scraping.
- The Apps Script runs under your Google account with access to only the specific spreadsheet.

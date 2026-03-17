# Job Capture — Claude Context

## Project
Chrome Extension (MV3) that extracts job postings and finds LinkedIn connections at target companies via Google search, then saves everything to Google Sheets.

**Repo:** https://github.com/Chandrapraban/Job-Capture

---

## User
- **Name:** Chandra (Chandrapraban)
- **Status:** Duke Engineering Management graduate student, actively job searching
- **Goal:** Log job applications to Google Sheets + auto-find people to reach out to at each company

---

## Architecture

### Files
| File | Purpose |
|---|---|
| `manifest.json` | MV3, permissions: activeTab, scripting, storage, tabs; host_permissions: google.com |
| `content.js` | Injected into job posting page — extracts role, company, description, URL |
| `popup.html/js/css` | Extension UI |
| `background.js` | Service worker — handles `FIND_ALUMNI` message, opens Google search tabs in background |
| `google-alumni.js` | Content script injected into Google results — scrapes LinkedIn `/in/` profile links |
| `appsscript.gs` | Google Apps Script backend — appends rows to Google Sheet |

### Settings (stored in chrome.storage.sync)
`scriptUrl`, `secretToken`, `sheetUrl`, `sheetName`

---

## User Flow
1. Navigate to a job posting
2. Click **Extract Job Info** → extracts job data AND auto-triggers alumni search
3. Alumni results appear in popup with connect notes and "Copy Note" buttons
4. Click **Save to Sheet** → POSTs everything to Apps Script

### If company not detected
A text input + **Search** button appears next to the Company field — user types company manually and triggers alumni search.

---

## Alumni Search (`background.js`)
Two-pass strategy, stops at 10 unique results, deduped by `profileUrl`:
1. `site:linkedin.com/in "[company]" "[role]"` — role-relevant people first
2. `site:linkedin.com/in "[company]"` — fills remaining slots up to 10

Each pass fetches 20 results from Google (`&num=20`). Passes through `google-alumni.js` which:
- Scrapes LinkedIn profile links from Google result cards
- Checks `isCurrentEmployee` — keeps result unless snippet explicitly says "Former/Previously/ex-[company]"
- Sets `isDukeAlum = true` if "duke" appears in snippet or title

---

## Connection Note Generation (`popup.js → generateNote`)
Infers role category from job title:
- Product → "Product", Program → "Program", Operations/Ops → "Operations"
- Engineer/Software/Developer → "Engineering", Data/Analytics → "Data & Analytics"
- Design/UX → "Design", Marketing, Finance, Supply Chain, Strategy, Consulting, Sales
- Fallback: uses raw role title

**Duke connection note:**
> "Hi [First], I'm Chandra, a Duke Engineering Management graduate student exploring [category] roles at [company]. As a fellow Blue Devil, I'd love to connect and learn more about your experience there, and would appreciate any guidance you might be open to sharing."

**Non-Duke note:**
> "Hi [First], I'm Chandra, a Duke Engineering Management graduate student exploring [category] roles at [company]. I'd love to connect and learn more about your experience on the team, and would appreciate any guidance or insights you might be open to sharing — including any referral opportunities if you feel it's a good fit."

---

## Google Sheet Structure (24 columns)
| Col | Content |
|---|---|
| A | Role |
| B | Company |
| C | URL |
| D | Job Description |
| E–F | Alum 1 LinkedIn URL + Connect Note |
| G–H | Alum 2 LinkedIn URL + Connect Note |
| ... | (same pattern) |
| W–X | Alum 10 LinkedIn URL + Connect Note |

Header row is auto-written if missing (checks if A1 = "Role").

---

## Apps Script (`appsscript.gs`)
- `SPREADSHEET_ID` and `SECRET_TOKEN` are hardcoded in the file
- POST body sent as `text/plain` with `no-cors` (to avoid Google Apps Script CORS redirect issue) — response is opaque but data goes through
- **Every code change requires a NEW deployment** — re-deploying same version does not update live code

---

## Deployment
### Extension changes only
→ `chrome://extensions` → reload Job Capture

### Apps Script changes
1. script.google.com → open Job Capture project → paste updated code
2. Deploy → New deployment → Web app → Execute as: Me, Anyone → Deploy
3. Copy new URL → extension ⚙ Settings → paste → Save Settings

---

## Known Issues / Notes
- Google DOM selectors in `google-alumni.js` may need updating if Google changes layout
- `isDukeAlum` detection is heuristic (checks for "duke" in snippet/title text from Google)
- `no-cors` means save confirmation is optimistic — user should verify in sheet
- Alumni search opens background tabs briefly — user must be signed into Google

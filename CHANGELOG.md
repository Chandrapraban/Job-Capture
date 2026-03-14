# Changelog

## v2.1.0 — Alumni Search + Sheet Redesign

### New files
- `background.js` — MV3 service worker; handles `FIND_ALUMNI` message, opens Google search tabs in background (active: false), injects scraper, closes tab, returns results
- `google-alumni.js` — content script injected into Google results page; scrapes LinkedIn `/in/` profile links, names, snippets; filters for current employees by checking company name in snippet

### manifest.json
- Added `tabs` permission
- Added `host_permissions`: `https://www.google.com/*`
- Registered `background.js` as service worker
- Version bumped to 2.1.0

### popup.html / popup.js / popup.css
- Removed separate "Find Duke Alumni" button — alumni search now triggers automatically after extraction
- Alumni results shown in popup with name, Duke badge (if applicable), connect note, "Copy Note" button, "View Profile" link
- Alumni section resets on each new extraction

### Alumni search strategy (priority order, stops at 10 unique results)
1. `site:linkedin.com/in "Duke University" "[company]" "[role]"` — Duke alums relevant to role
2. `site:linkedin.com/in "Duke University" "[company]"` — Duke alums at company
3. `site:linkedin.com/in "[company]" "[role]"` — anyone at company relevant to role
4. `site:linkedin.com/in "[company]"` — anyone at company (broad fallback)
- Deduplicates by LinkedIn profile URL across all passes
- Filters for current employees: result snippet must contain the company name

### Note generation
- Infers role category from job title: Product / Program / Operations / Engineering / Data & Analytics / Design / Marketing / Finance / Supply Chain / Strategy / Consulting / Sales
- **Duke connection:** "Hi [First], I'm Chandra, a Duke Engineering Management graduate student exploring [category] roles at [company]. As a fellow Blue Devil, I'd love to connect..."
- **Non-Duke:** same intro, adds referral opportunity mention at the end

### appsscript.gs
- Removed header-check guard — always appends
- Expanded from 5 to 10 alum pairs (20 columns)
- Alum columns now store LinkedIn profile URL (not name) + connect note
- Sheet columns: Role, Company, URL, Job Description, Alum 1 URL, Alum 1 Note, ... Alum 10 URL, Alum 10 Note

### TODO
- Manual company input fallback when extraction fails to detect company

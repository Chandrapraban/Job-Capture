"use strict";

// ── DOM ───────────────────────────────────────────────────────────────────────
const fieldRole        = document.getElementById("field-role");
const fieldCompany     = document.getElementById("field-company");
const fieldUrl         = document.getElementById("field-url");
const fieldTimestamp   = document.getElementById("field-timestamp");
const fieldDescription = document.getElementById("field-description");
const btnExtract       = document.getElementById("btn-extract");
const btnSave          = document.getElementById("btn-save");
const btnOpenSheet     = document.getElementById("btn-open-sheet");
const statusEl         = document.getElementById("status");

const alumniSection        = document.getElementById("alumni-section");
const alumniCompanyEl      = document.getElementById("alumni-company-name");
const alumniList           = document.getElementById("alumni-list");
const inputCompanyOverride = document.getElementById("input-company-override");
const btnSearchCompany     = document.getElementById("btn-search-company");

const btnSettingsToggle = document.getElementById("btn-settings-toggle");
const settingsPanel     = document.getElementById("settings-panel");
const inputScriptUrl    = document.getElementById("input-script-url");
const inputToken        = document.getElementById("input-token");
const inputSheetUrl     = document.getElementById("input-sheet-url");
const inputSheetName    = document.getElementById("input-sheet-name");
const btnSaveSettings   = document.getElementById("btn-save-settings");
const settingsStatus    = document.getElementById("settings-status");

// ── State ─────────────────────────────────────────────────────────────────────
let extracted   = null;
let foundAlumni = [];
let scriptUrl   = "";
let secretToken = "";
let sheetUrl    = "";
let sheetName   = "Sheet1";

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const s = await chrome.storage.sync.get(["scriptUrl", "secretToken", "sheetUrl", "sheetName"]);
  scriptUrl   = s.scriptUrl   || "";
  secretToken = s.secretToken || "";
  sheetUrl    = s.sheetUrl    || "";
  sheetName   = s.sheetName   || "Sheet1";

  inputScriptUrl.value = scriptUrl;
  inputToken.value     = secretToken;
  inputSheetUrl.value  = sheetUrl;
  inputSheetName.value = sheetName;

  btnOpenSheet.disabled = !sheetUrl;

  btnSettingsToggle.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
  });

  btnSaveSettings.addEventListener("click", saveSettings);
  btnExtract.addEventListener("click", handleExtract);
  btnSave.addEventListener("click", handleSave);
  btnOpenSheet.addEventListener("click", () => {
    if (sheetUrl) chrome.tabs.create({ url: sheetUrl });
  });
  btnSearchCompany.addEventListener("click", () => {
    const company = inputCompanyOverride.value.trim();
    if (!company) return;
    if (extracted) extracted.company = company;
    fieldCompany.textContent = company;
    inputCompanyOverride.classList.add("hidden");
    btnSearchCompany.classList.add("hidden");
    fieldCompany.classList.remove("hidden");
    alumniSection.classList.add("hidden");
    showStatus("Finding alumni at " + company + "…", "loading");
    searchAlumni(company);
  });
});

// ── Settings ──────────────────────────────────────────────────────────────────
async function saveSettings() {
  const url   = inputScriptUrl.value.trim();
  const token = inputToken.value.trim();
  const sheet = inputSheetUrl.value.trim();
  const tab   = inputSheetName.value.trim() || "Sheet1";

  if (!url) return showInlineStatus("Enter the Apps Script URL.", "error");
  if (!url.startsWith("https://script.google.com/"))
    return showInlineStatus("URL must start with https://script.google.com/", "error");
  if (!token) return showInlineStatus("Enter a secret token.", "error");

  await chrome.storage.sync.set({ scriptUrl: url, secretToken: token, sheetUrl: sheet, sheetName: tab });
  scriptUrl = url; secretToken = token; sheetUrl = sheet; sheetName = tab;
  btnOpenSheet.disabled = !sheetUrl;

  showInlineStatus("Settings saved.", "success");
  setTimeout(() => {
    settingsPanel.classList.add("hidden");
    settingsStatus.className = "inline-status hidden";
  }, 1200);
}

// ── Extract ───────────────────────────────────────────────────────────────────
async function handleExtract() {
  extracted = null;
  foundAlumni = [];
  alumniSection.classList.add("hidden");
  inputCompanyOverride.classList.add("hidden");
  btnSearchCompany.classList.add("hidden");
  fieldCompany.classList.remove("hidden");
  btnSave.disabled = true;
  resetFields();
  showStatus("Extracting…", "loading");
  btnExtract.disabled = true;

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    showStatus("Cannot access the current tab.", "error");
    btnExtract.disabled = false;
    return;
  }

  // Inject content script fresh each time
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch { /* already injected */ }

  chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB_INFO" }, (response) => {
    btnExtract.disabled = false;

    if (chrome.runtime.lastError || !response) {
      showStatus("Could not read this page. Make sure you are on a job posting.", "error");
      return;
    }
    if (!response.success) {
      showStatus("Extraction error: " + response.error, "error");
      return;
    }

    extracted = response.data;
    fieldRole.textContent        = extracted.role        || "(not found)";
    fieldUrl.textContent         = extracted.url         || "(not found)";
    fieldUrl.title               = extracted.url         || "";
    fieldTimestamp.textContent   = fmtTime(extracted.timestamp);
    fieldDescription.textContent = extracted.description || "(not found)";
    btnSave.disabled = false;

    if (extracted.company) {
      fieldCompany.textContent = extracted.company;
      fieldCompany.classList.remove("hidden");
      inputCompanyOverride.classList.add("hidden");
      btnSearchCompany.classList.add("hidden");
      showStatus("Finding Duke alumni at " + extracted.company + "…", "loading");
      searchAlumni(extracted.company);
    } else {
      fieldCompany.textContent = "(not found)";
      inputCompanyOverride.value = "";
      inputCompanyOverride.classList.remove("hidden");
      btnSearchCompany.classList.remove("hidden");
      showStatus("Company not detected — enter it manually and click Search.", "info");
    }
  });
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function handleSave() {
  if (!extracted) return;

  if (!scriptUrl || !secretToken) {
    showStatus("Open settings (⚙) and fill in the URL and token.", "error");
    return;
  }

  btnSave.disabled = true;
  btnExtract.disabled = true;
  showStatus("Saving…", "loading");

  try {
    // Use no-cors + text/plain to avoid the Google Apps Script redirect issue.
    // With no-cors the response is opaque (unreadable) but the POST goes through correctly.
    await fetch(scriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        token:       secretToken,
        sheetName:   sheetName || "Sheet1",
        timestamp:   extracted.timestamp,
        role:        extracted.role,
        company:     extracted.company,
        url:         extracted.url,
        description: extracted.description || "",
        alumni:      foundAlumni.slice(0, 10).map(p => ({
          profileUrl: p.profileUrl,
          note:       generateNote(p, extracted.company, extracted.role),
        })),
      }),
    });

    // With no-cors we cannot read the response — if fetch didn't throw, the request was sent.
    showStatus("Sent! Check your Google Sheet to confirm.", "success");
    btnSave.disabled = true;
  } catch (err) {
    showStatus("Network error: " + err.message, "error");
    btnSave.disabled = false;
  } finally {
    btnExtract.disabled = false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function resetFields() {
  fieldRole.textContent = fieldCompany.textContent = fieldUrl.textContent =
    fieldTimestamp.textContent = fieldDescription.textContent = "—";
  fieldUrl.title = "";
}

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = "status " + type;
}

function showInlineStatus(msg, type) {
  settingsStatus.textContent = msg;
  settingsStatus.className = "inline-status " + type;
}

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

// ── Alumni Search ──────────────────────────────────────────────────────────────
function searchAlumni(company) {
  if (!company) {
    showStatus("Job extracted. No company found to search alumni.", "info");
    return;
  }

  chrome.runtime.sendMessage({ type: "FIND_ALUMNI", company, role: extracted ? extracted.role : "" }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      showStatus("Job extracted. Alumni search failed — make sure you're signed into Google.", "info");
      return;
    }
    if (!response.people || response.people.length === 0) {
      showStatus("Job extracted. No alumni found on Google.", "info");
      return;
    }

    foundAlumni = response.people;
    displayAlumni(response.people, company);
    showStatus(
      response.dukeSearch ? "Ready — Duke alumni found. Save to Sheet when done." : "Ready — limited Duke results, showing general. Save to Sheet when done.",
      "success"
    );
  });
}

function displayAlumni(people, company) {
  alumniCompanyEl.textContent = company;
  alumniList.innerHTML = "";

  for (const person of people) {
    const note = generateNote(person, company, extracted ? extracted.role : "");
    const item = document.createElement("div");
    item.className = "alumni-item";

    const badge = person.isDukeAlum
      ? '<span class="duke-badge">Duke</span>'
      : "";

    item.innerHTML =
      '<div class="alumni-name">' + escHtml(person.name) + badge + "</div>" +
      (person.headlineHint
        ? '<div class="alumni-headline">' + escHtml(person.headlineHint) + "</div>"
        : "") +
      '<div class="alumni-note">' + escHtml(note) + "</div>" +
      '<div class="alumni-actions">' +
        '<a class="alumni-link" href="' + escHtml(person.profileUrl) + '" target="_blank">View Profile</a>' +
        '<button class="btn-copy-note" data-note="' + escHtml(note) + '">Copy Note</button>' +
      "</div>";

    alumniList.appendChild(item);
  }

  alumniList.querySelectorAll(".btn-copy-note").forEach(btn => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.note).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy Note"; }, 1600);
      });
    });
  });

  alumniSection.classList.remove("hidden");
}

function inferCategory(role) {
  const r = (role || "").toLowerCase();
  if (r.includes("product"))                              return "Product";
  if (r.includes("program"))                             return "Program";
  if (r.includes("operations") || r.includes(" ops"))   return "Operations";
  if (r.includes("project"))                             return "Project Management";
  if (r.includes("engineer") || r.includes("software") || r.includes("developer")) return "Engineering";
  if (r.includes("data") || r.includes("analytics") || r.includes("analyst"))      return "Data & Analytics";
  if (r.includes("design") || r.includes("ux"))         return "Design";
  if (r.includes("marketing"))                           return "Marketing";
  if (r.includes("finance") || r.includes("financial")) return "Finance";
  if (r.includes("supply chain") || r.includes("logistics")) return "Supply Chain";
  if (r.includes("strategy"))                            return "Strategy";
  if (r.includes("consult"))                             return "Consulting";
  if (r.includes("sales"))                               return "Sales";
  return role || "management";
}

function generateNote(person, company, role) {
  const first    = person.name.split(" ")[0];
  const category = inferCategory(role);

  if (person.isDukeAlum) {
    return (
      "Hi " + first + ", I\u2019m Chandra, a Duke Engineering Management graduate student " +
      "exploring " + category + " roles at " + company + ". As a fellow Blue Devil, " +
      "I\u2019d love to connect and learn more about your experience there, and would appreciate " +
      "any guidance you might be open to sharing."
    );
  }
  return (
    "Hi " + first + ", I\u2019m Chandra, a Duke Engineering Management graduate student " +
    "exploring " + category + " roles at " + company + ". I\u2019d love to connect " +
    "and learn more about your experience on the team, and would appreciate any guidance or " +
    "insights you might be open to sharing \u2014 including any referral opportunities if you feel it\u2019s a good fit."
  );
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

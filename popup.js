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
    fieldCompany.textContent     = extracted.company     || "(not found)";
    fieldUrl.textContent         = extracted.url         || "(not found)";
    fieldUrl.title               = extracted.url         || "";
    fieldTimestamp.textContent   = fmtTime(extracted.timestamp);
    fieldDescription.textContent = extracted.description || "(not found)";
    btnSave.disabled = false;
    showStatus("Done. Review then click Save to Sheet.", "info");
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

/**
 * popup.js
 * Handles all popup UI logic:
 *  - Loads / saves the Apps Script URL from chrome.storage.sync
 *  - Sends EXTRACT_JOB_INFO message to the content script
 *  - POSTs extracted data to the configured Apps Script endpoint
 */

"use strict";

// ─── DOM refs ────────────────────────────────────────────────────────────────
const fieldRole        = document.getElementById("field-role");
const fieldCompany     = document.getElementById("field-company");
const fieldUrl         = document.getElementById("field-url");
const fieldTimestamp   = document.getElementById("field-timestamp");
const fieldDescription = document.getElementById("field-description");
const btnExtract       = document.getElementById("btn-extract");
const btnSave          = document.getElementById("btn-save");
const statusEl         = document.getElementById("status");

// Settings panel
const btnSettingsToggle = document.getElementById("btn-settings-toggle");
const settingsPanel     = document.getElementById("settings-panel");
const inputScriptUrl    = document.getElementById("input-script-url");
const inputToken        = document.getElementById("input-token");
const inputSheetUrl     = document.getElementById("input-sheet-url");
const inputSheetName    = document.getElementById("input-sheet-name");
const btnSaveSettings   = document.getElementById("btn-save-settings");
const settingsStatus    = document.getElementById("settings-status");
const btnOpenSheet      = document.getElementById("btn-open-sheet");

// ─── State ───────────────────────────────────────────────────────────────────
let extractedData = null;   // { role, company, url, timestamp }
let scriptUrl     = "";     // Apps Script Web App URL
let secretToken   = "";     // Shared secret sent with every POST
let sheetUrl      = "";     // Google Sheet URL for "Open Sheet" button
let sheetName     = "";     // Sheet tab name to write to (e.g. "Sheet1")

// ─── Startup ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadScriptUrl();
  attachListeners();
});

// ─── Storage helpers ─────────────────────────────────────────────────────────
async function loadScriptUrl() {
  const result = await chrome.storage.sync.get(["scriptUrl", "secretToken", "sheetUrl", "sheetName"]);
  scriptUrl   = result.scriptUrl   || "";
  secretToken = result.secretToken || "";
  sheetUrl    = result.sheetUrl    || "";
  sheetName   = result.sheetName   || "Sheet1";
  if (inputScriptUrl)  inputScriptUrl.value  = scriptUrl;
  if (inputToken)      inputToken.value      = secretToken;
  if (inputSheetUrl)   inputSheetUrl.value   = sheetUrl;
  if (inputSheetName)  inputSheetName.value  = sheetName;
  updateOpenSheetButton();
}

async function persistSettings(url, token, sheet, tabName) {
  await chrome.storage.sync.set({ scriptUrl: url, secretToken: token, sheetUrl: sheet, sheetName: tabName });
  scriptUrl   = url;
  secretToken = token;
  sheetUrl    = sheet;
  sheetName   = tabName;
  updateOpenSheetButton();
}

function updateOpenSheetButton() {
  if (btnOpenSheet) btnOpenSheet.disabled = !sheetUrl;
}

// ─── Event listeners ─────────────────────────────────────────────────────────
function attachListeners() {
  btnExtract.addEventListener("click", handleExtract);
  btnSave.addEventListener("click", handleSave);

  if (btnSettingsToggle) {
    btnSettingsToggle.addEventListener("click", () => {
      const isHidden = settingsPanel.classList.contains("hidden");
      settingsPanel.classList.toggle("hidden", !isHidden);
      btnSettingsToggle.setAttribute("aria-expanded", String(isHidden));
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", handleSaveSettings);
  }

  if (btnOpenSheet) {
    btnOpenSheet.addEventListener("click", () => {
      if (sheetUrl) chrome.tabs.create({ url: sheetUrl });
    });
  }
}

// ─── Extract handler ─────────────────────────────────────────────────────────
async function handleExtract() {
  clearStatus();
  btnExtract.disabled = true;
  btnSave.disabled = true;
  extractedData = null;
  resetFields();

  showStatus("Extracting…", "loading");

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    showStatus("Could not access the current tab.", "error");
    btnExtract.disabled = false;
    return;
  }

  // Inject content script on demand (handles pages opened before extension install)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch {
    // Script may already be present — safe to ignore injection error
  }

  chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB_INFO" }, (response) => {
    btnExtract.disabled = false;

    if (chrome.runtime.lastError || !response) {
      showStatus(
        "Could not read this page. Make sure you are on a job posting and try again.",
        "error"
      );
      return;
    }

    if (!response.success) {
      showStatus(`Extraction failed: ${response.error}`, "error");
      return;
    }

    extractedData = response.data;
    populateFields(extractedData);
    btnSave.disabled = false;
    showStatus("Extraction complete. Review the fields then click Save.", "info");
  });
}

// ─── Save handler ────────────────────────────────────────────────────────────
async function handleSave() {
  if (!extractedData) return;

  if (!scriptUrl || !secretToken) {
    showStatus(
      "Apps Script URL or secret token not configured. Click the gear icon to set them.",
      "error"
    );
    return;
  }

  btnSave.disabled = true;
  btnExtract.disabled = true;
  showStatus("Saving to Google Sheets…", "loading");

  try {
    const response = await sendToSheet(extractedData);

    if (response.ok) {
      showStatus("Saved successfully!", "success");
      btnSave.disabled = true; // prevent duplicate saves
    } else {
      const text = await response.text();
      showStatus(`Server error (${response.status}): ${text.slice(0, 120)}`, "error");
      btnSave.disabled = false;
    }
  } catch (err) {
    showStatus(`Network error: ${err.message}`, "error");
    btnSave.disabled = false;
  } finally {
    btnExtract.disabled = false;
  }
}

// ─── Settings handler ─────────────────────────────────────────────────────────
async function handleSaveSettings() {
  const url     = inputScriptUrl.value.trim();
  const token   = inputToken.value.trim();
  const sheet   = inputSheetUrl.value.trim();
  const tabName = inputSheetName.value.trim() || "Sheet1";

  if (!url) {
    showSettingsStatus("Please enter the Apps Script URL.", "error");
    return;
  }

  if (!url.startsWith("https://script.google.com/")) {
    showSettingsStatus("URL must start with https://script.google.com/", "error");
    return;
  }

  if (!token) {
    showSettingsStatus("Please enter a secret token.", "error");
    return;
  }

  if (sheet && !sheet.startsWith("https://docs.google.com/spreadsheets/")) {
    showSettingsStatus("Sheet URL must be a Google Sheets link.", "error");
    return;
  }

  await persistSettings(url, token, sheet, tabName);
  showSettingsStatus("Settings saved.", "success");
  setTimeout(() => {
    settingsPanel.classList.add("hidden");
    btnSettingsToggle.setAttribute("aria-expanded", "false");
    clearSettingsStatus();
  }, 1200);
}

// ─── Network ──────────────────────────────────────────────────────────────────
/**
 * POST JSON payload to the configured Apps Script endpoint.
 * Uses no-cors is NOT used here because we need to read the response.
 * Apps Script Web App must return CORS headers (it does when deployed as "Anyone").
 */
async function sendToSheet(data) {
  return fetch(scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token:       secretToken,
      sheetName:   sheetName || "Sheet1",
      timestamp:   data.timestamp,
      role:        data.role,
      company:     data.company,
      url:         data.url,
      description: data.description || "",
    }),
    redirect: "follow",
  });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function populateFields({ role, company, url, timestamp, description }) {
  fieldRole.textContent        = role        || "(not found)";
  fieldCompany.textContent     = company     || "(not found)";
  fieldUrl.textContent         = url         || "(not found)";
  fieldUrl.title               = url         || "";
  fieldTimestamp.textContent   = formatTimestamp(timestamp);
  fieldDescription.textContent = description || "(not found)";
}

function resetFields() {
  fieldRole.textContent        = "—";
  fieldCompany.textContent     = "—";
  fieldUrl.textContent         = "—";
  fieldUrl.title               = "";
  fieldTimestamp.textContent   = "—";
  fieldDescription.textContent = "—";
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "status hidden";
}

function showSettingsStatus(message, type) {
  settingsStatus.textContent = message;
  settingsStatus.className = `settings-status ${type}`;
}

function clearSettingsStatus() {
  settingsStatus.textContent = "";
  settingsStatus.className = "settings-status hidden";
}

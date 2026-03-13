/**
 * Google Apps Script — Job Capture Web App
 *
 * Deploy as a Web App:
 *   Execute as: Me
 *   Who has access: Anyone   ← required so the extension can POST without OAuth
 *
 * Security: every request must include a matching SECRET_TOKEN in the JSON body.
 * Set the same token in the Chrome extension's gear settings panel.
 * Anyone without this token who discovers the URL gets an Unauthorized error.
 *
 * Sheet columns: Timestamp | Role | Company | URL | Job Description
 */

var SPREADSHEET_ID = "17OujHeuDdQ7uJclntJBs2RNbI1yghz5t-CbcEQhiPvU";
var SHEET_NAME     = "Sheet1";  // Change if your sheet tab has a different name

// Set this to any long random string, then paste the same value
// into the Chrome extension's gear settings → Secret Token field.
var SECRET_TOKEN = "gvwhiD-cRXu7m5g0e7uQ58tVN-Q4U4Jw";

/**
 * Handle POST requests from the Chrome extension.
 *
 * Expected JSON body:
 *   { "token": "…", "timestamp": "…", "role": "…", "company": "…", "url": "…", "description": "…" }
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    // ── Token check ──────────────────────────────────────────────────────────
    if (!payload.token || payload.token !== SECRET_TOKEN) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var timestamp   = payload.timestamp   || new Date().toISOString();
    var role        = payload.role        || "";
    var company     = payload.company     || "";
    var url         = payload.url         || "";
    var description = payload.description || "";
    var sheetName   = payload.sheetName   || SHEET_NAME;

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName) || ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    // Add header row if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Role", "Company", "URL", "Job Description"]);
      var headerRange = sheet.getRange(1, 1, 1, 5);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#2c3e7a");
      headerRange.setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([timestamp, role, company, url, description]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests — status ping only, no data exposed.
 */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "Job Capture App Script is running." }))
    .setMimeType(ContentService.MimeType.JSON);
}

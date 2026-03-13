/**
 * Google Apps Script — Job Capture Web App
 * Deploy as: Web App | Execute as: Me | Who has access: Anyone
 *
 * The extension posts JSON as text/plain (to avoid CORS redirect issues).
 * This script parses it, checks the token, and appends a row.
 */

var SPREADSHEET_ID = "17OujHeuDdQ7uJclntJBs2RNbI1yghz5t-CbcEQhiPvU";
var SECRET_TOKEN   = "gvwhiD-cRXu7m5g0e7uQ58tVN-Q4U4Jw";

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    if (!payload.token || payload.token !== SECRET_TOKEN) {
      return respond({ success: false, error: "Unauthorized" });
    }

    var sheetName   = payload.sheetName   || "Sheet1";
    var timestamp   = payload.timestamp   || new Date().toISOString();
    var role        = payload.role        || "";
    var company     = payload.company     || "";
    var url         = payload.url         || "";
    var description = payload.description || "";

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Role", "Company", "URL", "Job Description"]);
      var hdr = sheet.getRange(1, 1, 1, 5);
      hdr.setFontWeight("bold");
      hdr.setBackground("#2c3e7a");
      hdr.setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([timestamp, role, company, url, description]);

    return respond({ success: true });

  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

function doGet() {
  return respond({ status: "Job Capture is running." });
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

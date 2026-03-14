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

    var alumni = payload.alumni || [];  // array of up to 10 {profileUrl, note}

    // Write header row if missing
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== "Role") {
      var headers = [
        "Role", "Company", "URL", "Job Description",
        "Alum 1", "Alum 1 - Connect Note",
        "Alum 2", "Alum 2 - Connect Note",
        "Alum 3", "Alum 3 - Connect Note",
        "Alum 4", "Alum 4 - Connect Note",
        "Alum 5", "Alum 5 - Connect Note",
        "Alum 6", "Alum 6 - Connect Note",
        "Alum 7", "Alum 7 - Connect Note",
        "Alum 8", "Alum 8 - Connect Note",
        "Alum 9", "Alum 9 - Connect Note",
        "Alum 10", "Alum 10 - Connect Note"
      ];
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
      } else {
        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
      var hdr = sheet.getRange(1, 1, 1, 24);
      hdr.setFontWeight("bold");
      hdr.setBackground("#2c3e7a");
      hdr.setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    // Pad alumni array to exactly 10 entries
    while (alumni.length < 10) alumni.push({ profileUrl: "", note: "" });

    // Always just append — one row per job
    sheet.appendRow([
      role, company, url, description,
      alumni[0].profileUrl || "", alumni[0].note || "",
      alumni[1].profileUrl || "", alumni[1].note || "",
      alumni[2].profileUrl || "", alumni[2].note || "",
      alumni[3].profileUrl || "", alumni[3].note || "",
      alumni[4].profileUrl || "", alumni[4].note || "",
      alumni[5].profileUrl || "", alumni[5].note || "",
      alumni[6].profileUrl || "", alumni[6].note || "",
      alumni[7].profileUrl || "", alumni[7].note || "",
      alumni[8].profileUrl || "", alumni[8].note || "",
      alumni[9].profileUrl || "", alumni[9].note || ""
    ]);

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

const SPREADSHEET_ID = "1nKedb6JGWsrFsXy9CVmXH2dfs57xDseXZgNW3609boA";
const CODES_SHEET_NAME = "Published Codes";
const CUSTOM_BLOCKS_SHEET_NAME = "Published Custom Blocks";
const HEADERS = ["id", "type", "name", "description", "author", "createdAt", "payload"];

function setupExploreSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const codes = getOrCreateSheet_(ss, CODES_SHEET_NAME);
  const custom = getOrCreateSheet_(ss, CUSTOM_BLOCKS_SHEET_NAME);
  ensureHeaders_(codes);
  ensureHeaders_(custom);
  return "Setup complete: " + CODES_SHEET_NAME + " and " + CUSTOM_BLOCKS_SHEET_NAME;
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  try {
    const sheets = setupAndGetSheets_();
    if (params.action !== "list") {
      return output_({
        ok: true,
        message: "C-Studio Explore backend is running.",
        sheets: [CODES_SHEET_NAME, CUSTOM_BLOCKS_SHEET_NAME]
      }, params.callback);
    }

    let items = [];
    sheets.forEach(sheet => {
      const values = sheet.getDataRange().getValues();
      if (values.length < 2) return;
      const headers = values.shift().map(String);
      values.filter(row => row.some(cell => cell !== "")).forEach(row => {
        const item = {};
        headers.forEach((header, i) => item[header] = row[i]);
        let payload = item.payload;
        try {
          if (typeof payload === "string") payload = JSON.parse(payload);
        } catch (_) {}
        if (!item.id || !["code", "custom"].includes(String(item.type))) return;
        items.push({
          id: String(item.id),
          type: String(item.type),
          name: String(item.name || "Untitled"),
          description: String(item.description || ""),
          author: String(item.author || ""),
          createdAt: item.createdAt instanceof Date
            ? item.createdAt.toISOString()
            : String(item.createdAt || ""),
          payload: payload
        });
      });
    });
    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return output_({ ok: true, items: items }, params.callback);
  } catch (err) {
    return output_({ ok: false, error: String(err.message || err) }, params.callback);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e && e.postData && e.postData.contents || "{}");
    if (data.action !== "publish") throw new Error("Unsupported action.");
    if (!["code", "custom"].includes(data.type)) throw new Error("Type must be code or custom.");
    if (!String(data.name || "").trim()) throw new Error("A published name is required.");
    if (!data.payload || typeof data.payload !== "object") throw new Error("A valid item payload is required.");

    const serialized = JSON.stringify(data.payload);
    if (serialized.length > 450000) throw new Error("This item is too large to publish.");

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const targetName = data.type === "code" ? CODES_SHEET_NAME : CUSTOM_BLOCKS_SHEET_NAME;
    const sheet = getOrCreateSheet_(ss, targetName);
    ensureHeaders_(sheet);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const record = {
      id: Utilities.getUuid(),
      type: data.type,
      name: String(data.name).trim().slice(0, 120),
      description: String(data.description || "").trim().slice(0, 500),
      author: String(data.author || "C-Studio user").trim().slice(0, 80),
      createdAt: new Date().toISOString(),
      payload: serialized
    };
    sheet.appendRow(headers.map(header => record[header] === undefined ? "" : record[header]));
    return output_({ ok: true, id: record.id, message: "Published successfully." });
  } catch (err) {
    return output_({ ok: false, error: String(err.message || err) });
  }
}

function setupAndGetSheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const codes = getOrCreateSheet_(ss, CODES_SHEET_NAME);
  const custom = getOrCreateSheet_(ss, CUSTOM_BLOCKS_SHEET_NAME);
  ensureHeaders_(codes);
  ensureHeaders_(custom);
  return [codes, custom];
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }
  const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const missing = HEADERS.filter(header => !current.includes(header));
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  sheet.setFrozenRows(1);
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][\w.$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

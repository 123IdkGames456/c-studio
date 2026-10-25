const SPREADSHEET_ID = "1nKedb6JGWsrFsXy9CVmXH2dfs57xDseXZgNW3609boA";
const CODES_SHEET_NAME = "Published Codes";
const CUSTOM_BLOCKS_SHEET_NAME = "Published Custom Blocks";
const HEADERS = ["id", "type", "name", "description", "author", "createdAt", "payload", "passwordSalt", "passwordHash", "passwordUpdatedAt"];

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
    if (params.action === "verify") {
      const id = String(params.id || "");
      const password = String(params.password || "");
      if (!id || !password) throw new Error("A listing ID and owner password are required.");
      let found = null;
      sheets.some(sheet => {
        const values = sheet.getDataRange().getValues();
        if (values.length < 2) return false;
        const headers = values[0].map(String);
        const idIndex = headers.indexOf("id");
        const saltIndex = headers.indexOf("passwordSalt");
        const hashIndex = headers.indexOf("passwordHash");
        for (let r = 1; r < values.length; r++) {
          if (String(values[r][idIndex]) === id) {
            const salt = String(values[r][saltIndex] || "");
            const storedHash = String(values[r][hashIndex] || "");
            found = !!salt && !!storedHash && passwordHash_(salt, password) === storedHash;
            return true;
          }
        }
        return false;
      });
      if (found === null) throw new Error("This published item was not found. Refresh Explore and try again.");
      return output_({ ok: true, valid: found, error: found ? "" : "Incorrect owner password. Enter the exact password used when this item was published." }, params.callback);
    }

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
          passwordUpdatedAt: item.passwordUpdatedAt instanceof Date
            ? item.passwordUpdatedAt.toISOString()
            : String(item.passwordUpdatedAt || ""),
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
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (data.action === "manage") {
      const id = String(data.id || "");
      const password = String(data.password || "");
      const manageAction = String(data.manageAction || "");
      if (!id || !password) throw new Error("A listing ID and owner password are required.");
      if (!["rename", "delete", "changePassword"].includes(manageAction)) throw new Error("Unsupported management action.");
      const sheets = setupAndGetSheets_();
      let foundSheet = null, foundRow = -1, headers = null, row = null;
      sheets.some(sheet => {
        const values = sheet.getDataRange().getValues();
        if (values.length < 2) return false;
        const hs = values[0].map(String), idIndex = hs.indexOf("id");
        for (let r = 1; r < values.length; r++) {
          if (String(values[r][idIndex]) === id) {
            foundSheet = sheet; foundRow = r + 1; headers = hs; row = values[r]; return true;
          }
        }
        return false;
      });
      if (!foundSheet) throw new Error("Published item was not found. It may already have been removed.");
      const salt = String(row[headers.indexOf("passwordSalt")] || "");
      const storedHash = String(row[headers.indexOf("passwordHash")] || "");
      if (!salt || !storedHash || passwordHash_(salt, password) !== storedHash) throw new Error("Incorrect owner password.");
      if (manageAction === "delete") {
        foundSheet.deleteRow(foundRow);
        return output_({ ok: true, message: "Listing removed. Existing local copies are unaffected." });
      }
      if (manageAction === "changePassword") {
        const newPassword = String(data.newPassword || "");
        if (newPassword.length < 6) throw new Error("New owner password must be at least 6 characters.");
        const newSalt = Utilities.getUuid();
        foundSheet.getRange(foundRow, headers.indexOf("passwordSalt") + 1).setValue(newSalt);
        foundSheet.getRange(foundRow, headers.indexOf("passwordHash") + 1).setValue(passwordHash_(newSalt, newPassword));
        foundSheet.getRange(foundRow, headers.indexOf("passwordUpdatedAt") + 1).setValue(new Date().toISOString());
        return output_({ ok: true, message: "Owner password changed." });
      }
      const newName = String(data.name || "").trim();
      if (!newName) throw new Error("A new public name is required.");
      foundSheet.getRange(foundRow, headers.indexOf("name") + 1).setValue(newName.slice(0, 120));
      return output_({ ok: true, message: "Public listing renamed." });
    }

    if (data.action !== "publish") throw new Error("Unsupported action.");
    if (!["code", "custom"].includes(data.type)) throw new Error("Type must be code or custom.");
    if (!String(data.name || "").trim()) throw new Error("A published name is required.");
    if (String(data.password || "").length < 6) throw new Error("Owner password must be at least 6 characters.");
    if (!data.payload || typeof data.payload !== "object") throw new Error("A valid item payload is required.");

    const serialized = JSON.stringify(data.payload);
    if (serialized.length > 450000) throw new Error("This item is too large to publish.");

    const targetName = data.type === "code" ? CODES_SHEET_NAME : CUSTOM_BLOCKS_SHEET_NAME;
    const sheet = getOrCreateSheet_(ss, targetName);
    ensureHeaders_(sheet);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const salt = Utilities.getUuid();
    const record = {
      id: Utilities.getUuid(),
      type: data.type,
      name: String(data.name).trim().slice(0, 120),
      description: String(data.description || "").trim().slice(0, 500),
      author: String(data.author || "C-Studio user").trim().slice(0, 80),
      createdAt: new Date().toISOString(),
      passwordUpdatedAt: new Date().toISOString(),
      payload: serialized,
      passwordSalt: salt,
      passwordHash: passwordHash_(salt, String(data.password))
    };
    sheet.appendRow(headers.map(header => record[header] === undefined ? "" : record[header]));
    return output_({ ok: true, id: record.id, message: "Published successfully." });
  } catch (err) {
    return output_({ ok: false, error: String(err.message || err) });
  }
}

function passwordHash_(salt, password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ":" + password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(byte => {
    const value = (byte + 256) % 256;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
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

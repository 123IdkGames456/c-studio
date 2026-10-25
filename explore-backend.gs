const SPREADSHEET_ID = "1nKedb6JGWsrFsXy9CVmXH2dfs57xDseXZgNW3609boA";
const CODES_SHEET_NAME = "Published Codes";
const CUSTOM_BLOCKS_SHEET_NAME = "Published Custom Blocks";
const PAYLOAD_PARTS = ["payload1", "payload2", "payload3", "payload4", "payload5"];
const PAYLOAD_CHUNK_SIZE = 45000;
const HEADERS = ["id", "type", "name", "description", "author", "createdAt", ...PAYLOAD_PARTS, "passwordSalt", "passwordHash", "passwordUpdatedAt"];

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
      return output_({ ok: true, message: "C-Studio Explore backend is running.", sheets: [CODES_SHEET_NAME, CUSTOM_BLOCKS_SHEET_NAME] }, params.callback);
    }

    let items = [];
    sheets.forEach(sheet => {
      const values = sheet.getDataRange().getValues();
      if (values.length < 2) return;
      const headers = values.shift().map(String);
      values.filter(row => row.some(cell => cell !== "")).forEach(row => {
        const item = {};
        headers.forEach((header, i) => item[header] = row[i]);
        const payload = readPayload_(item);
        try { item.payload = JSON.parse(payload); } catch (_) { item.payload = payload; }
        if (!item.id || !["code", "custom"].includes(String(item.type))) return;
        items.push({
          id: String(item.id),
          type: String(item.type),
          name: String(item.name || "Untitled"),
          description: String(item.description || ""),
          author: String(item.author || ""),
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt || ""),
          passwordUpdatedAt: item.passwordUpdatedAt instanceof Date ? item.passwordUpdatedAt.toISOString() : String(item.passwordUpdatedAt || ""),
          payload: item.payload
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
        if (newPassword.length < 1) throw new Error("New owner password must contain at least 1 character.");
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
    if (String(data.password || "").length < 1) throw new Error("Owner password must contain at least 1 character.");
    if (!data.payload || typeof data.payload !== "object") throw new Error("A valid item payload is required.");

    const serialized = JSON.stringify(data.payload);
    if (serialized.length > PAYLOAD_PARTS.length * PAYLOAD_CHUNK_SIZE) {
      throw new Error("This item is too large to publish. The five payload cells support up to " + (PAYLOAD_PARTS.length * PAYLOAD_CHUNK_SIZE).toLocaleString() + " characters.");
    }

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
      passwordSalt: salt,
      passwordHash: passwordHash_(salt, String(data.password))
    };
    PAYLOAD_PARTS.forEach((key, index) => record[key] = serialized.slice(index * PAYLOAD_CHUNK_SIZE, (index + 1) * PAYLOAD_CHUNK_SIZE));
    sheet.appendRow(headers.map(header => record[header] === undefined ? "" : record[header]));
    return output_({ ok: true, id: record.id, message: "Published successfully." });
  } catch (err) {
    return output_({ ok: false, error: String(err.message || err) });
  }
}

function passwordHash_(salt, password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ":" + password, Utilities.Charset.UTF_8);
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
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow === 0 || lastColumn === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  const oldValues = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const oldHeaders = oldValues[0].map(value => String(value || "").trim());
  const headers = [...HEADERS, ...oldHeaders.filter(header => header && !HEADERS.includes(header))];
  const rows = [headers];

  for (let r = 1; r < oldValues.length; r++) {
    const oldRow = oldValues[r];
    const obj = {};
    oldHeaders.forEach((header, i) => {
      if (header) obj[header] = oldRow[i];
    });

    const payload = readPayload_(obj);
    const row = { ...obj };
    if (!row.id) row.id = Utilities.getUuid();
    if (!row.type) row.type = sheet.getName() === CUSTOM_BLOCKS_SHEET_NAME ? "custom" : "code";
    if (!row.name) row.name = "Recovered item";
    if (row.description === undefined || row.description === null) row.description = "";
    if (!row.author) row.author = "C-Studio user";
    if (!row.createdAt) row.createdAt = new Date().toISOString();

    PAYLOAD_PARTS.forEach((key, i) => {
      const part = payload.slice(i * PAYLOAD_CHUNK_SIZE, (i + 1) * PAYLOAD_CHUNK_SIZE);
      if (!row[key] && part) row[key] = part;
      else if (row[key] === undefined || row[key] === null) row[key] = "";
    });

    HEADERS.forEach(header => {
      if (row[header] === undefined || row[header] === null) row[header] = "";
    });
    rows.push(headers.map(header => row[header] === undefined || row[header] === null ? "" : row[header]));
  }

  const needsRewrite = oldHeaders.length !== headers.length ||
    headers.some((header, i) => oldHeaders[i] !== header) ||
    rows.length !== oldValues.length ||
    rows.some((row, r) => row.some((value, c) => String(value ?? "") !== String(oldValues[r]?.[c] ?? "")));
  if (needsRewrite) {
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), rows.length), Math.max(sheet.getLastColumn(), headers.length)).clearContent();
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
}
function readPayload_(item) {
  const parts = PAYLOAD_PARTS.map(key => String(item[key] || ""));
  if (parts.some(Boolean)) return parts.join("");
  return String(item.payload || "");
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][\w.$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

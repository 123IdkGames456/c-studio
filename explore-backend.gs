const SPREADSHEET_ID = "1nKedb6JGWsrFsXy9CVmXH2dfs57xDseXZgNW3609boA";
const SHEET_GID = 505903224;
const HEADERS = ["id", "type", "name", "description", "author", "createdAt", "payload"];

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  if (p.action !== "list") return output_({ok:true,message:"C-Studio Explore backend is running."},p.callback);
  try {
    const sheet = getSheet_();
    ensureHeaders_(sheet);
    const values = sheet.getDataRange().getValues();
    const headers = values.length ? values.shift().map(String) : HEADERS;
    const items = values.filter(row=>row.some(cell=>cell!=="")).map(row=>{
      const v={}; headers.forEach((h,i)=>v[h]=row[i]);
      let payload=v.payload;
      try { if(typeof payload==="string") payload=JSON.parse(payload); } catch (_) {}
      return {id:String(v.id||""),type:String(v.type||""),name:String(v.name||"Untitled"),description:String(v.description||""),author:String(v.author||""),createdAt:v.createdAt instanceof Date?v.createdAt.toISOString():String(v.createdAt||""),payload};
    }).filter(x=>x.id&&["code","custom"].includes(x.type));
    return output_({ok:true,items:items.reverse()},p.callback);
  } catch(err) { return output_({ok:false,error:String(err.message||err)},p.callback); }
}

function doPost(e) {
  try {
    const data=JSON.parse(e&&e.postData&&e.postData.contents||"{}");
    if(data.action!=="publish") throw new Error("Unsupported action.");
    if(!["code","custom"].includes(data.type)) throw new Error("Type must be code or custom.");
    if(!String(data.name||"").trim()) throw new Error("A published name is required.");
    if(!data.payload||typeof data.payload!=="object") throw new Error("A valid payload is required.");
    const serialized=JSON.stringify(data.payload);
    if(serialized.length>450000) throw new Error("This item is too large to publish.");
    const sheet=getSheet_(); ensureHeaders_(sheet);
    const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
    const record={id:Utilities.getUuid(),type:data.type,name:String(data.name).trim().slice(0,120),description:String(data.description||"").trim().slice(0,500),author:String(data.author||"C-Studio user").trim().slice(0,80),createdAt:new Date().toISOString(),payload:serialized};
    sheet.appendRow(headers.map(h=>record[h]===undefined?"":record[h]));
    return output_({ok:true,id:record.id});
  } catch(err) { return output_({ok:false,error:String(err.message||err)}); }
}

function getSheet_() {
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet=ss.getSheets().find(s=>s.getSheetId()===SHEET_GID);
  if(!sheet) throw new Error("Could not find spreadsheet tab gid "+SHEET_GID);
  return sheet;
}

function ensureHeaders_(sheet) {
  if(sheet.getLastRow()===0||sheet.getLastColumn()===0) {
    sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]); return;
  }
  const current=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const missing=HEADERS.filter(h=>!current.includes(h));
  if(missing.length) sheet.getRange(1,current.length+1,1,missing.length).setValues([missing]);
}

function output_(data,callback) {
  const json=JSON.stringify(data);
  if(callback&&/^[A-Za-z_$][\w.$]*$/.test(callback)) return ContentService.createTextOutput(callback+"("+json+");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

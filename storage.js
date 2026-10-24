window.BlueprintStorage = (() => {
const KEY="ikirumi-unity-csharp-blueprints-v1";
function snapshot(state){return JSON.stringify({...state,version:1,savedAt:new Date().toISOString()},null,2)}
function save(state){localStorage.setItem(KEY,snapshot(state));return true}
function load(){const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):null}
function download(name,text,type="text/plain"){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function safeName(s){return String(s||"BlueprintProject").replace(/[^A-Za-z0-9_-]/g,"_")||"BlueprintProject"}
return {snapshot,save,load,download,safeName};
})();
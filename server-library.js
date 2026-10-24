(() => {
  const SERVER_LIBRARY_URL = "https://script.google.com/macros/s/AKfycbxxDajYY3c8xNAIHKoL1yzKlBXn_aw7XRjrEwh8YF9TbNn4UVYf8VrC8FEJYr5UeiKbrw/exec";
  const $ = id => document.getElementById(id);
  let serverEntries = [];
  let requestNumber = 0;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function setTab(tab) {
    const explore = tab === "explore";
    $("libraryLocalView").hidden = explore;
    $("libraryExploreView").hidden = !explore;
    $("libraryLocalTab").classList.toggle("active", !explore);
    $("libraryExploreTab").classList.toggle("active", explore);
    if (explore && !serverEntries.length) loadServerEntries();
  }
  function parsePayload(entry) {
    let payload = entry.payload ?? entry.code ?? entry.content ?? "";
    if (typeof payload !== "string") payload = JSON.stringify(payload, null, 2);
    return payload;
  }
  function renderExplore() {
    const q = ($("exploreSearch").value || "").trim().toLowerCase();
    const visible = serverEntries.filter(e => (String(e.name || "") + " " + String(e.type || "") + " " + parsePayload(e)).toLowerCase().includes(q));
    $("exploreList").innerHTML = visible.length ? visible.map(e => {
      const payload = parsePayload(e);
      const isCode = String(e.type || "code").toLowerCase() === "code";
      return '<article class="library-entry server-entry"><div class="library-entry-top"><div class="server-entry-title"><strong>' + esc(e.name || "Untitled server script") + '</strong><span>' + (isCode ? "C# CODE" : "NODE PROJECT") + (e.createdAt ? " · " + esc(e.createdAt) : "") + '</span></div><span class="server-badge">SERVER</span></div><details class="server-preview"><summary>Preview ' + (isCode ? "code" : "project JSON") + '</summary><pre>' + esc(payload) + '</pre></details><div class="library-entry-actions"><button data-server-action="copy" data-index="' + serverEntries.indexOf(e) + '">Copy</button><button data-server-action="download" data-index="' + serverEntries.indexOf(e) + '">Download</button></div></article>';
    }).join("") : '<div class="library-empty">' + (serverEntries.length ? "No server scripts match your search." : "No server scripts returned yet.") + "</div>";
    if (serverEntries.length) $("exploreStatus").textContent = serverEntries.length + " server script" + (serverEntries.length === 1 ? "" : "s") + " loaded. Showing " + visible.length + ".";
  }
  function loadServerEntries() {
    const requestId = ++requestNumber;
    $("exploreStatus").textContent = "Loading scripts from the server…";
    $("refreshExplore").disabled = true;
    const callback = "__cstudioServerLibraryCallback";
    const old = document.getElementById("cstudio-server-library-request");
    if (old) old.remove();
    const timer = setTimeout(() => {
      if (requestId !== requestNumber) return;
      cleanup();
      $("exploreStatus").textContent = "Could not load server scripts. The deployed Apps Script must support ?action=list&callback=... and return the server entries as JSONP. Update and redeploy Code.gs, then press Refresh.";
      $("refreshExplore").disabled = false;
    }, 10000);
    function cleanup() { clearTimeout(timer); const script = document.getElementById("cstudio-server-library-request"); if (script) script.remove(); delete window[callback]; }
    window[callback] = data => {
      if (requestId !== requestNumber) return;
      cleanup();
      $("refreshExplore").disabled = false;
      if (!data || data.ok === false) { $("exploreStatus").textContent = data?.error || "The server did not return a valid script list."; return; }
      const items = Array.isArray(data) ? data : (data.scripts || data.entries || data.data || []);
      if (!Array.isArray(items)) { $("exploreStatus").textContent = "Unexpected server response. Expected a list of saved scripts."; return; }
      serverEntries = items.filter(e => e && ["code", "node", "json"].includes(String(e.type || "").toLowerCase()));
      renderExplore();
    };
    const script = document.createElement("script");
    script.id = "cstudio-server-library-request";
    script.src = SERVER_LIBRARY_URL + (SERVER_LIBRARY_URL.includes("?") ? "&" : "?") + "action=list&callback=" + callback + "&t=" + Date.now();
    script.onerror = () => {
      if (requestId !== requestNumber) return;
      cleanup();
      $("refreshExplore").disabled = false;
      $("exploreStatus").textContent = "Could not reach the server API. Confirm that Apps Script is deployed with a public list endpoint.";
    };
    document.head.appendChild(script);
  }
  $("libraryLocalTab")?.addEventListener("click", () => setTab("local"));
  $("libraryExploreTab")?.addEventListener("click", () => setTab("explore"));
  $("refreshExplore")?.addEventListener("click", loadServerEntries);
  $("exploreSearch")?.addEventListener("input", renderExplore);
  $("exploreList")?.addEventListener("click", async event => {
    const button = event.target.closest("button[data-server-action]");
    if (!button) return;
    const entry = serverEntries[Number(button.dataset.index)];
    if (!entry) return;
    const payload = parsePayload(entry);
    const filename = String(entry.name || "server-script").replace(/[^a-z0-9_-]+/gi, "_") || "server-script";
    if (button.dataset.serverAction === "copy") {
      try { await navigator.clipboard.writeText(payload); button.textContent = "Copied!"; setTimeout(() => { if (button.isConnected) button.textContent = "Copy"; }, 1200); }
      catch { alert("Clipboard access failed. Open Preview and copy the text manually."); }
      return;
    }
    const isCode = String(entry.type || "code").toLowerCase() === "code";
    const blob = new Blob([payload], {type: isCode ? "text/plain;charset=utf-8" : "application/json;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename + (isCode ? ".cs" : ".json"); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
(() => {
  const SERVER_LIBRARY_URL = "https://script.google.com/macros/s/AKfycbwe-rMMhIV3NG87u3UfqjXk_zbt4eT9QA_SgQZqqYCRK727OAYKh45DUQIihmxoNMCaew/exec";
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

  let pendingPublishEntry = null;
  let publishRequestId = null;
  let publishTimeout = null;
  function showPublishModal(entry) {
    pendingPublishEntry = entry;
    $("publishPassword").value = "";
    $("publishPassword").disabled = false;
    $("publishSubmit").disabled = false;
    $("publishCancel").disabled = false;
    $("publishClose").disabled = false;
    $("publishForm").hidden = false;
    $("publishLoading").hidden = true;
    $("publishStatus").className = "publish-status";
    $("publishStatus").textContent = "Enter the library password to publish this script.";
    $("publishSubtitle").textContent = "Publishing: " + String(entry.name || entry.project.projectName || "Untitled script");
    $("publishModal").hidden = false;
    setTimeout(() => $("publishPassword").focus(), 30);
  }
  function closePublishModal() {
    if (publishRequestId) return;
    $("publishModal").hidden = true;
    pendingPublishEntry = null;
  }
  function publishFailure(message, wrongPassword = false) {
    clearTimeout(publishTimeout);
    publishRequestId = null;
    $("publishLoading").hidden = true;
    $("publishForm").hidden = false;
    $("publishPassword").disabled = false;
    $("publishSubmit").disabled = false;
    $("publishCancel").disabled = false;
    $("publishClose").disabled = false;
    $("publishStatus").className = "publish-status error";
    $("publishStatus").textContent = wrongPassword ? "Incorrect password. Please try again." : message;
    if (wrongPassword) { $("publishPassword").value = ""; $("publishPassword").focus(); }
  }
  function publishSuccess() {
    clearTimeout(publishTimeout);
    publishRequestId = null;
    $("publishModal").hidden = true;
    pendingPublishEntry = null;
    $("exploreStatus").textContent = "Script published successfully. Refreshing server library…";
    loadServerEntries();
  }
  function submitPublish(password) {
    if (!pendingPublishEntry || publishRequestId) return;
    const local = pendingPublishEntry;
    const serverEntry = {
      name: String(local.name || local.project.projectName || "Untitled script"),
      type: "node",
      payload: JSON.stringify(local.project),
      createdAt: new Date().toISOString()
    };
    publishRequestId = "cstudio-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    const requestId = publishRequestId;
    $("publishForm").hidden = true;
    $("publishLoading").hidden = false;
    $("publishStatus").className = "publish-status";
    $("publishStatus").textContent = "";
    $("publishSubmit").disabled = true;
    $("publishCancel").disabled = true;
    $("publishClose").disabled = true;
    let frame = document.getElementById("cstudio-publish-frame");
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "cstudio-publish-frame";
      frame.name = "cstudio-publish-frame";
      frame.hidden = true;
      document.body.appendChild(frame);
    }
    const form = document.createElement("form");
    form.method = "POST";
    form.action = SERVER_LIBRARY_URL;
    form.target = frame.name;
    form.hidden = true;
    const fields = { action: "save", entry: JSON.stringify(serverEntry), password, requestId };
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });
    window.addEventListener("message", function onPublishMessage(event) {
      const data = event.data;
      if (event.source !== frame.contentWindow || !data || data.type !== "cstudio-publish-result" || data.requestId !== requestId) return;
      window.removeEventListener("message", onPublishMessage);
      if (data.ok === true) publishSuccess();
      else if (data.code === "WRONG_PASSWORD" || /incorrect.*password|wrong password/i.test(String(data.message || ""))) publishFailure("", true);
      else publishFailure("The password was accepted, but the server could not save the script. " + String(data.message || "Check the server sheet, permissions, and Apps Script logs."));
    });
    document.body.appendChild(form);
    form.submit();
    form.remove();
    publishTimeout = setTimeout(() => {
      if (publishRequestId !== requestId) return;
      publishFailure("No result came back from the server. Update Code.gs so its save response sends a cstudio-publish-result message, then redeploy the web app.");
    }, 18000);
  }
  window.addEventListener("cstudio:publish-script", event => {
    const local = event.detail?.entry;
    if (!local?.project) return;
    showPublishModal(local);
  });
  $("publishForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const password = $("publishPassword").value;
    if (!password) {
      $("publishStatus").className = "publish-status error";
      $("publishStatus").textContent = "Enter the library password first.";
      return;
    }
    submitPublish(password);
  });
  $("publishCancel")?.addEventListener("click", closePublishModal);
  $("publishClose")?.addEventListener("click", closePublishModal);
  $("publishModal")?.addEventListener("click", event => {
    if (event.target === $("publishModal")) closePublishModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("publishModal").hidden) closePublishModal();
  });

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
(() => {
  const SUPABASE_URL = "https://wktrywxzkmqwuowlurfq.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Lt0tnVTm1UzuRsvXe5C5fA_cwfPeljB";
  const TABLE_URL = SUPABASE_URL + "/rest/v1/cstudio_library";
  const $ = id => document.getElementById(id);
  let serverEntries = [];
  let requestNumber = 0;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const headers = extra => ({
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + SUPABASE_PUBLISHABLE_KEY,
    ...extra
  });

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

  function normalizeEntry(row) {
    return {
      ...row,
      createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : "",
      publisherName: row.username || "Unknown",
      publishedBy: row.username || "Unknown"
    };
  }

  function renderExplore() {
    const q = ($("exploreSearch").value || "").trim().toLowerCase();
    const visible = serverEntries.filter(e => (String(e.name || "") + " " + String(e.type || "") + " " + String(e.username || "") + " " + parsePayload(e)).toLowerCase().includes(q));
    $("exploreList").innerHTML = visible.length ? visible.map(e => {
      const payload = parsePayload(e);
      const isCode = String(e.type || "code").toLowerCase() === "code";
      return '<article class="library-entry server-entry"><div class="library-entry-top"><div class="server-entry-title"><strong>' + esc(e.name || "Untitled server script") + '</strong><span>' + (isCode ? "C# CODE" : "NODE PROJECT") + (e.createdAt ? " · " + esc(e.createdAt) : "") + '</span><span class="server-publisher">Published by ' + esc(e.publisherName || e.publishedBy || "Unknown") + '</span></div><span class="server-badge">SUPABASE</span></div><details class="server-preview"><summary>Preview ' + (isCode ? "code" : "project JSON") + '</summary><pre>' + esc(payload) + '</pre></details><div class="library-entry-actions"><button data-server-action="copy" data-index="' + serverEntries.indexOf(e) + '">Copy</button><button data-server-action="download" data-index="' + serverEntries.indexOf(e) + '">Download</button></div></article>';
    }).join("") : '<div class="library-empty">' + (serverEntries.length ? "No server scripts match your search." : "No community scripts have been published yet.") + "</div>";
    $("exploreStatus").textContent = serverEntries.length + " community script" + (serverEntries.length === 1 ? "" : "s") + " loaded. Showing " + visible.length + ".";
  }

  async function loadServerEntries() {
    const requestId = ++requestNumber;
    $("exploreStatus").textContent = "Loading scripts from Supabase…";
    $("refreshExplore").disabled = true;
    try {
      const response = await fetch(TABLE_URL + "?select=id,name,type,payload,created_at,username&order=created_at.desc&limit=200", {
        method: "GET",
        headers: headers({ Accept: "application/json" })
      });
      const body = await response.json().catch(() => null);
      if (requestId !== requestNumber) return;
      if (!response.ok) {
        const message = body?.message || body?.hint || body?.details || "HTTP " + response.status;
        if (response.status === 401 || response.status === 403) throw new Error("Supabase rejected the request. Check the project URL, publishable key, and public SELECT policy. " + message);
        throw new Error("Supabase could not load the library: " + message);
      }
      if (!Array.isArray(body)) throw new Error("Unexpected response from Supabase. Expected a list of scripts.");
      serverEntries = body.map(normalizeEntry).filter(e => e && ["code", "node", "json"].includes(String(e.type || "").toLowerCase()));
      renderExplore();
    } catch (error) {
      if (requestId !== requestNumber) return;
      $("exploreStatus").textContent = error?.message || "Could not connect to Supabase. Check your connection and database policies.";
      $("exploreList").innerHTML = '<div class="library-empty">Library unavailable. Press Refresh to try again.</div>';
    } finally {
      if (requestId === requestNumber) $("refreshExplore").disabled = false;
    }
  }

  let pendingPublishEntry = null;
  let publishRequestId = null;
  let publishTimeout = null;

  function showPublishModal(entry) {
    pendingPublishEntry = entry;
    $("publishLoading").hidden = true;
    $("publishStatus").className = "publish-status";
    $("publishStatus").textContent = "Choose a username to show in Explore, then publish.";
    $("publishSubtitle").textContent = "Publishing: " + String(entry.name || entry.project.projectName || "Untitled script");
    $("publishModal").hidden = false;
    $("publishUsernameField").hidden = false;
    $("publishUsername").value = "";
    $("publishSubmit").hidden = false;
  }

  function closePublishModal() {
    if (publishRequestId) return;
    $("publishModal").hidden = true;
    pendingPublishEntry = null;
  }

  function publishFailure(message) {
    clearTimeout(publishTimeout);
    publishRequestId = null;
    $("publishLoading").hidden = true;
    $("publishCancel").disabled = false;
    $("publishClose").disabled = false;
    $("publishSubmit").disabled = false;
    $("publishStatus").className = "publish-status error";
    $("publishStatus").textContent = message;
  }

  function publishSuccess() {
    clearTimeout(publishTimeout);
    publishRequestId = null;
    $("publishModal").hidden = true;
    pendingPublishEntry = null;
    $("exploreStatus").textContent = "Script published successfully. Refreshing community library…";
    loadServerEntries();
  }

  function getDeviceId() {
    let id = "";
    try { id = localStorage.getItem("cstudioDeviceId") || ""; } catch {}
    if (!id) {
      id = "cstudio-device-" + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
      try { localStorage.setItem("cstudioDeviceId", id); } catch {}
    }
    return id;
  }

  async function submitPublish() {
    if (!pendingPublishEntry || publishRequestId) return;
    const username = String($("publishUsername").value || "").trim().replace(/\s+/g, " ");
    if (!username || username.length < 2 || username.length > 24) {
      $("publishStatus").className = "publish-status error";
      $("publishStatus").textContent = "Enter a username between 2 and 24 characters.";
      $("publishUsername").focus();
      return;
    }
    const local = pendingPublishEntry;
    const payload = local.project;
    if (!payload || typeof payload !== "object") {
      publishFailure("This saved item does not contain a valid Blueprint project.");
      return;
    }
    const record = {
      name: String(local.name || local.project.projectName || "Untitled script").trim().slice(0, 120),
      type: "node",
      payload,
      username,
      device_id: getDeviceId()
    };
    if (new Blob([JSON.stringify(record.payload)]).size > 200000) {
      $("publishStatus").className = "publish-status error";
      $("publishStatus").textContent = "This project is too large to publish (maximum 200 KB).";
      return;
    }
    const requestId = "cstudio-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    publishRequestId = requestId;
    $("publishLoading").hidden = false;
    $("publishStatus").className = "publish-status";
    $("publishStatus").textContent = "Saving to Supabase…";
    $("publishCancel").disabled = true;
    $("publishClose").disabled = true;
    $("publishSubmit").disabled = true;

    publishTimeout = setTimeout(() => {
      if (publishRequestId === requestId) publishFailure("The request timed out. Check your Supabase connection and INSERT policy, then try again.");
    }, 20000);

    try {
      const response = await fetch(TABLE_URL, {
        method: "POST",
        headers: headers({
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }),
        body: JSON.stringify(record)
      });
      const body = await response.json().catch(() => null);
      if (publishRequestId !== requestId) return;
      if (!response.ok) {
        let message = body?.message || body?.hint || body?.details || "HTTP " + response.status;
        if (response.status === 401 || response.status === 403) {
          message = "Supabase blocked publishing. You need an INSERT policy for anon on cstudio_library. " + message;
        } else if (response.status === 400 || response.status === 404) {
          message = "Supabase rejected the record. Check that cstudio_library has the expected columns and that payload is jsonb. " + message;
        }
        publishFailure(message);
        return;
      }
      publishSuccess();
    } catch (error) {
      if (publishRequestId === requestId) publishFailure(error?.message || "Could not connect to Supabase. Check your internet connection.");
    }
  }

  window.addEventListener("cstudio:publish-script", event => {
    const local = event.detail?.entry;
    if (!local?.project) return;
    showPublishModal(local);
  });

  $("publishSubmit")?.addEventListener("click", () => submitPublish());
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
      try {
        await navigator.clipboard.writeText(payload);
        button.textContent = "Copied!";
        setTimeout(() => { if (button.isConnected) button.textContent = "Copy"; }, 1200);
      } catch {
        alert("Clipboard access failed. Open Preview and copy the text manually.");
      }
      return;
    }
    const isCode = String(entry.type || "code").toLowerCase() === "code";
    const blob = new Blob([payload], { type: isCode ? "text/plain;charset=utf-8" : "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + (isCode ? ".cs" : ".json");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
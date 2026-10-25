(() => {
  const SERVER_LIBRARY_URL = "https://script.google.com/macros/s/AKfycbzlHejILAweWtqJx8M9NTOQjmSmtQqblwYWxk__3c5FnED6cXywWNygtOTNeS-AIWx6iA/exec";
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
      return '<article class="library-entry server-entry"><div class="library-entry-top"><div class="server-entry-title"><strong>' + esc(e.name || "Untitled server script") + '</strong><span>' + (isCode ? "C# CODE" : "NODE PROJECT") + (e.createdAt ? " · " + esc(e.createdAt) : "") + '</span><span class="server-publisher">Published by ' + esc(e.publisherName || e.publishedBy || "Unknown") + '</span></div><span class="server-badge">SERVER</span></div><details class="server-preview"><summary>Preview ' + (isCode ? "code" : "project JSON") + '</summary><pre>' + esc(payload) + '</pre></details><div class="library-entry-actions"><button data-server-action="copy" data-index="' + serverEntries.indexOf(e) + '">Copy</button><button data-server-action="download" data-index="' + serverEntries.indexOf(e) + '">Download</button></div></article>';
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
  let signedInToken = sessionStorage.getItem("cstudioGoogleIdToken") || "";
  let signedInUser = null;
  try { signedInUser = JSON.parse(sessionStorage.getItem("cstudioGoogleUser") || "null"); } catch {}
  function showPublishModal(entry) {
    pendingPublishEntry = entry;
    $("publishLoading").hidden = true;
    $("publishStatus").className = "publish-status";
    $("publishStatus").textContent = signedInToken
      ? "Choose a username to show in Explore, then publish."
      : "Choose a username, then sign in with Google to publish.";
    $("publishSubtitle").textContent = "Publishing: " + String(entry.name || entry.project.projectName || "Untitled script");
    $("publishModal").hidden = false;
    $("publishUsernameField").hidden = false;
    $("publishUsername").value = "";
    $("publishSubmit").hidden = !signedInToken;
    $("googleSignInButton").hidden = !!signedInToken;
    $("googleSignInButton").innerHTML = "";
    if (!signedInToken && GOOGLE_CLIENT_ID === "PASTE_GOOGLE_OAUTH_CLIENT_ID_HERE") {
      $("publishStatus").textContent = "Google Sign-In needs setup: add your Google OAuth Client ID to server-library.js and Code.gs.";
    } else if (!signedInToken && window.google && google.accounts && google.accounts.id) {
      google.accounts.id.renderButton($("googleSignInButton"), {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 260
      });
    } else if (!signedInToken) {
      $("publishStatus").textContent = "Google Sign-In is loading. Close this window and try again in a moment.";
    }
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
    $("googleSignInButton").hidden = false;
    $("publishCancel").disabled = false;
    $("publishClose").disabled = false;
    $("publishStatus").className = "publish-status error";
    $("publishStatus").textContent = message;
  }
  function publishSuccess() {
    clearTimeout(publishTimeout);
    publishRequestId = null;
    $("publishModal").hidden = true;
    pendingPublishEntry = null;
    $("exploreStatus").textContent = "Script published successfully. Refreshing server library…";
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

  function submitPublish() {
    if (!pendingPublishEntry || publishRequestId || !idToken) return;
    const username = String($("publishUsername").value || "").trim().replace(/\s+/g, " ");
    if (!username || username.length < 2 || username.length > 24) {
      $("publishStatus").className = "publish-status error";
      $("publishStatus").textContent = "Enter a username between 2 and 24 characters.";
      $("publishUsername").focus();
      return;
    }
    const local = pendingPublishEntry;
    const serverEntry = {
      name: String(local.name || local.project.projectName || "Untitled script"),
      type: "node",
      payload: JSON.stringify(local.project),
      createdAt: new Date().toISOString(),
      username,
      deviceId: getDeviceId()
    };
    publishRequestId = "cstudio-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    const requestId = publishRequestId;
    $("googleSignInButton").hidden = true;
    $("publishLoading").hidden = false;
    $("publishStatus").className = "publish-status";
    $("publishStatus").textContent = "";
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
    const fields = { action: "save", entry: JSON.stringify(serverEntry), idToken, username, deviceId: serverEntry.deviceId, requestId };
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });
    window.addEventListener("message", function onPublishMessage(event) {
      const data = event.data;
      if (!data || data.type !== "cstudio-publish-result" || data.requestId !== requestId) return;
      window.removeEventListener("message", onPublishMessage);
      if (data.ok === true) publishSuccess();
      else publishFailure(String(data.message || "The server could not save the script."));
    });
    document.body.appendChild(form);
    form.submit();
    form.remove();
    publishTimeout = setTimeout(() => {
      if (publishRequestId !== requestId) return;
      publishFailure("No result came back from the server. Confirm Code.gs is updated and redeployed.");
    }, 18000);
  }

  function decodeGoogleUser(token) {
    try {
      const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(decodeURIComponent(escape(atob(part))));
      return { name: claims.name || claims.email || "Google user", email: claims.email || "" };
    } catch {
      return { name: "Google user", email: "" };
    }
  }

  function updateAccountButton() {
    const button = $("accountButton");
    if (!button) return;
    button.textContent = signedInToken ? "Log out" : "Log in";
    button.title = signedInToken && signedInUser ? "Signed in as " + signedInUser.email : "Sign in with Google";
  }

  function openAccountLogin() {
    pendingPublishEntry = null;
    $("publishLoading").hidden = true;
    $("publishSubtitle").textContent = "Sign in to C-Studio";
    $("publishStatus").className = "publish-status";
    $("publishStatus").textContent = "Sign in with Google. Your Google account verifies your identity; publishing a script also requires a username.";
    $("publishUsernameField").hidden = true;
    $("publishSubmit").hidden = true;
    $("publishModal").hidden = false;
    $("googleSignInButton").hidden = false;
    $("googleSignInButton").innerHTML = "";
    if (GOOGLE_CLIENT_ID === "PASTE_GOOGLE_OAUTH_CLIENT_ID_HERE") {
      $("publishStatus").textContent = "Google Sign-In needs setup: add your Google OAuth Client ID to server-library.js and Code.gs.";
    } else if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.renderButton($("googleSignInButton"), {
        theme: "outline", size: "large", text: "signin_with", shape: "rectangular", width: 260
      });
    } else {
      $("publishStatus").textContent = "Google Sign-In is loading. Close this window and try again in a moment.";
    }
  }

  function handleGoogleCredential(response) {
    if (!response || !response.credential) {
      publishFailure("Google Sign-In did not return a credential. Please try again.");
      return;
    }
    signedInToken = response.credential;
    signedInUser = decodeGoogleUser(signedInToken);
    try {
      sessionStorage.setItem("cstudioGoogleIdToken", signedInToken);
      sessionStorage.setItem("cstudioGoogleUser", JSON.stringify(signedInUser));
    } catch {}
    updateAccountButton();
    if (pendingPublishEntry) {
      submitPublish(signedInToken);
    } else {
      $("publishModal").hidden = true;
    }
  }

  const GOOGLE_CLIENT_ID = "PASTE_GOOGLE_OAUTH_CLIENT_ID_HERE";
  function initializeGoogleSignIn() {
    if (!window.google || !google.accounts || !google.accounts.id) return;
    if (GOOGLE_CLIENT_ID === "PASTE_GOOGLE_OAUTH_CLIENT_ID_HERE") return;
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      auto_select: false
    });
  }
  window.addEventListener("load", () => { initializeGoogleSignIn(); updateAccountButton(); });
  $("accountButton")?.addEventListener("click", () => {
    if (signedInToken) {
      signedInToken = "";
      signedInUser = null;
      try { sessionStorage.removeItem("cstudioGoogleIdToken"); sessionStorage.removeItem("cstudioGoogleUser"); } catch {}
      if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
      updateAccountButton();
    } else {
      openAccountLogin();
    }
  });
  window.addEventListener("cstudio:publish-script", event => {
    const local = event.detail?.entry;
    if (!local?.project) return;
    showPublishModal(local);
  });
  $("publishSubmit")?.addEventListener("click", () => submitPublish(signedInToken));
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
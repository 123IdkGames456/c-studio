(() => {
  const SERVER_LIBRARY_URL = "https://script.google.com/macros/s/AKfycbxxDajYY3c8xNAIHKoL1yzKlBXn_aw7XRjrEwh8YF9TbNn4UVYf8VrC8FEJYr5UeiKbrw/exec";
  const button = document.getElementById("openServerLibrary");
  if (!button) return;
  button.addEventListener("click", () => {
    const opened = window.open(SERVER_LIBRARY_URL, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = SERVER_LIBRARY_URL;
  });
})();

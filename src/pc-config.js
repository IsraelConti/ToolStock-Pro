(() => {
  let pending;
  async function getStatus() {
    const response = await fetch("/oauth/status", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo consultar el estado de Google Drive");
    return response.json();
  }

  async function getDriveAccessToken() {
    if (pending) return pending;
    pending = (async () => {
      const read = async () => {
        const response = await fetch("/oauth/access-token", { credentials: "same-origin" });
        if (response.ok) return (await response.json()).accessToken;
        let message = "Inicia sesión con Google para sincronizar";
        try { message = (await response.json()).message || message; } catch {}
        const popup = window.open("/oauth/start", "toolstock-google-auth", "popup,width=520,height=720");
        if (!popup) throw new Error(message + ". Permite la ventana de autorización.");
        const deadline = Date.now() + 120000;
        while (Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 1200));
          const next = await fetch("/oauth/access-token", { credentials: "same-origin" });
          if (next.ok) return (await next.json()).accessToken;
          if (popup.closed) throw new Error("La autorización de Google se canceló o se cerró antes de terminar");
        }
        throw new Error("La autorización de Google ha tardado demasiado");
      };
      try { return await read(); } finally { pending = null; }
    })();
    return pending;
  }

  async function logout() {
    await fetch("/oauth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
    return getStatus();
  }

  window.ToolStockPC = { getDriveAccessToken, getStatus, logout };
})();

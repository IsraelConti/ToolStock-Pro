// Android can retain an older System WebView even when the OS is supported.
// Install only the APIs used by the UI that WebView 83 does not yet provide.
(function () {
  if (typeof crypto.randomUUID !== "function") {
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      writable: true,
      value: function () {
        // Fail rather than manufacture sync IDs with Math.random or the clock.
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));
        return hex.slice(0, 4).join("") + "-" + hex.slice(4, 6).join("") + "-" +
          hex.slice(6, 8).join("") + "-" + hex.slice(8, 10).join("") + "-" + hex.slice(10).join("");
      }
    });
  }
  if (typeof Object.hasOwn !== "function") {
    Object.defineProperty(Object, "hasOwn", {
      configurable: true,
      writable: true,
      value: (object, key) => Object.prototype.hasOwnProperty.call(object, key)
    });
  }
  for (const type of [Element, Document, DocumentFragment]) {
    if (typeof type.prototype.replaceChildren !== "function") {
      Object.defineProperty(type.prototype, "replaceChildren", {
        configurable: true,
        writable: true,
        value: function (...nodes) {
          const fragment = document.createDocumentFragment();
          fragment.append(...nodes);
          this.textContent = "";
          this.appendChild(fragment);
        }
      });
    }
  }
})();

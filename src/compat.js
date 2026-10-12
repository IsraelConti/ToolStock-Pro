// Android 10 devices can still have an older WebView. Keep local file imports
// and record identifiers usable without requiring an immediate WebView update.
if (!crypto.randomUUID) {
  crypto.randomUUID = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, x => x.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  };
}
for (const [method, readerMethod] of [["text", "readAsText"], ["arrayBuffer", "readAsArrayBuffer"]]) {
  if (!Blob.prototype[method]) {
    Blob.prototype[method] = function () {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader[readerMethod](this);
      });
    };
  }
}

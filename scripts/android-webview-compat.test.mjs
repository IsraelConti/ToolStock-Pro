import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("android/webview-compat.js", "utf8");
const context = vm.createContext({ crypto: { getRandomValues: bytes => webcrypto.getRandomValues(bytes) } });
vm.runInContext(`
  Object.hasOwn = undefined;
  Math.random = () => { throw new Error("Insecure random source"); };
  class Node {
    constructor() { this.children = []; }
    set textContent(value) { this.children = value ? [String(value)] : []; }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(fragment) { this.append(...fragment.children); }
  }
  class Element extends Node {}
  class Document extends Node {}
  class DocumentFragment extends Node {}
  const document = new Document();
  document.createDocumentFragment = () => new DocumentFragment();
`, context);
vm.runInContext(source, context);

const ids = Array.from({ length: 1000 }, () => context.crypto.randomUUID());
assert.ok(ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
assert.equal(new Set(ids).size, ids.length, "Sync IDs must not repeat across new records");
assert.equal(vm.runInContext('Object.hasOwn(Object.create({inherited:1}), "inherited")', context), false);
assert.equal(vm.runInContext('Object.hasOwn({hasOwnProperty:2}, "hasOwnProperty")', context), true);
assert.equal(vm.runInContext('Object.hasOwn(Object.assign(Object.create(null), {id:1}), "id")', context), true);
assert.equal(vm.runInContext(`(() => {
  for (const Type of [Element, Document, DocumentFragment]) {
    const node = new Type(), child = new Element();
    node.append("old"); node.replaceChildren("new", child);
    if (node.children.length !== 2 || node.children[0] !== "new" || node.children[1] !== child) return false;
    node.replaceChildren(); if (node.children.length) return false;
  }
  return true;
})()`, context), true);

// Rerunning the bootstrap must preserve the selected implementations.
const uuid = context.crypto.randomUUID;
vm.runInContext(source, context);
assert.equal(context.crypto.randomUUID, uuid);
const originalGetRandomValues = context.crypto.getRandomValues;
context.crypto.getRandomValues = undefined;
assert.throws(() => context.crypto.randomUUID(), /getRandomValues/);
context.crypto.getRandomValues = originalGetRandomValues;
const nativeUuid = () => "native UUID";
context.crypto.randomUUID = nativeUuid;
vm.runInContext(source, context);
assert.equal(context.crypto.randomUUID, nativeUuid);
console.log("Android WebView compatibility: secure UUIDs, missing DOM APIs, own-property checks and native preservation passed.");

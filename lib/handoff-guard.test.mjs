// Unit tests for the same-origin check on the hand-off POST. Run: npm run test:handoff
import assert from "node:assert/strict";
import { isSameOriginPost } from "./handoff-guard.ts";

const h = (o) => ({ get: (k) => o[k.toLowerCase()] ?? null });

assert.equal(isSameOriginPost(h({ "sec-fetch-site": "same-origin" })), true);
assert.equal(isSameOriginPost(h({ "sec-fetch-site": "cross-site", origin: "https://le-nid.app", host: "le-nid.app" })), false, "Sec-Fetch-Site wins");
assert.equal(isSameOriginPost(h({ "sec-fetch-site": "same-site" })), false);
assert.equal(isSameOriginPost(h({ "sec-fetch-site": "none" })), false);
assert.equal(isSameOriginPost(h({ origin: "https://le-nid.app", host: "le-nid.app" })), true);
assert.equal(isSameOriginPost(h({ origin: "https://le-nid.app", "x-forwarded-host": "le-nid.app", host: "internal:3000" })), true);
assert.equal(isSameOriginPost(h({ origin: "https://evil.example", host: "le-nid.app" })), false);
assert.equal(isSameOriginPost(h({ origin: "https://le-nid.app.evil.example", host: "le-nid.app" })), false);
assert.equal(isSameOriginPost(h({ origin: "null", host: "le-nid.app" })), false);
assert.equal(isSameOriginPost(h({ host: "le-nid.app" })), false, "no Origin and no Sec-Fetch-Site: refuse");
assert.equal(isSameOriginPost(h({})), false);
console.log("handoff-guard: ok");

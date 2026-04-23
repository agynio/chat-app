"use strict";
(() => {
  // src/sw.ts
  var isRecord = (value) => {
    return Boolean(value) && typeof value === "object";
  };
  var parseSetTokenMessage = (value) => {
    if (value.type !== "SET_TOKEN") return null;
    const token = typeof value.token === "string" ? value.token.trim() : "";
    const origin = typeof value.mediaProxyOrigin === "string" ? value.mediaProxyOrigin.trim() : "";
    if (!token || !origin) return null;
    let normalizedOrigin = "";
    try {
      normalizedOrigin = new URL(origin).origin;
    } catch (_error) {
      return null;
    }
    return { type: "SET_TOKEN", token, mediaProxyOrigin: normalizedOrigin };
  };
  var parseClearTokenMessage = (value) => {
    if (value.type !== "CLEAR_TOKEN") return null;
    return { type: "CLEAR_TOKEN" };
  };
  var parseMediaProxyMessage = (value) => {
    if (!isRecord(value)) return null;
    return parseSetTokenMessage(value) ?? parseClearTokenMessage(value);
  };
  var accessToken = null;
  var mediaProxyOrigin = null;
  var handleMessage = (message) => {
    if (message.type === "CLEAR_TOKEN") {
      accessToken = null;
      mediaProxyOrigin = null;
      return;
    }
    accessToken = message.token;
    mediaProxyOrigin = message.mediaProxyOrigin;
  };
  var shouldProxyRequest = (request) => {
    if (!mediaProxyOrigin) return false;
    try {
      return new URL(request.url).origin === mediaProxyOrigin;
    } catch (_error) {
      return false;
    }
  };
  var buildAuthorizedRequest = (request, token) => {
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return new Request(request, {
      headers,
      mode: "cors",
      credentials: request.credentials
    });
  };
  var buildUnauthorizedResponse = () => new Response("Unauthorized", {
    status: 401,
    statusText: "Unauthorized",
    headers: { "Content-Type": "text/plain" }
  });
  self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
  });
  self.addEventListener("message", (event) => {
    const message = parseMediaProxyMessage(event.data);
    if (message) {
      handleMessage(message);
    }
  });
  self.addEventListener("fetch", (event) => {
    if (!shouldProxyRequest(event.request)) return;
    if (!accessToken) {
      event.respondWith(buildUnauthorizedResponse());
      return;
    }
    const authorizedRequest = buildAuthorizedRequest(event.request, accessToken);
    event.respondWith(fetch(authorizedRequest));
  });
})();

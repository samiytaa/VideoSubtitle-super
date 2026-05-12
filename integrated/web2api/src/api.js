export async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(payload.error || JSON.stringify(payload));
  }

  return payload;
}

export async function proxyJson(path, options = {}) {
  const query = options.query ? `?${new URLSearchParams(options.query)}` : "";
  return requestJson(`/proxy${path}${query}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      "x-proxy-account-id": options.accountId || ""
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}

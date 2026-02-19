function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function resolveApiBaseUrl(envUrl?: string): string {
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      const isEnvLocalhost = isLocalhost(parsed.hostname);
      const isRuntimeLocalhost = isLocalhost(window.location.hostname);

      if (isEnvLocalhost && !isRuntimeLocalhost) {
        parsed.hostname = window.location.hostname;
      }

      return parsed.toString().replace(/\/$/, "");
    } catch {
      return envUrl.replace(/\/$/, "");
    }
  }

  return `http://${window.location.hostname}:1234`;
}

export function resolveWsUrl(envUrl?: string): string {
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      const isEnvLocalhost = isLocalhost(parsed.hostname);
      const isRuntimeLocalhost = isLocalhost(window.location.hostname);

      if (isEnvLocalhost && !isRuntimeLocalhost) {
        parsed.hostname = window.location.hostname;
      }

      if (window.location.protocol === "https:" && parsed.protocol === "ws:") {
        parsed.protocol = "wss:";
      }

      return parsed.toString();
    } catch {
      return envUrl;
    }
  }

  return `ws://${window.location.hostname}:1234`;
}

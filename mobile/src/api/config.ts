const localDevelopmentHosts = new Set(['10.0.2.2', 'localhost', '127.0.0.1']);

export function getApiBaseUrl() {
  const rawUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!rawUrl) {
    throw new Error('Configura EXPO_PUBLIC_API_BASE_URL para conectar con el servidor.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('La URL del servidor no es válida.');
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('La URL del servidor contiene datos no permitidos.');
  }

  const isLocalHost = localDevelopmentHosts.has(parsed.hostname.toLowerCase());
  const isAllowedLocalHttp = __DEV__ && parsed.protocol === 'http:' && isLocalHost;
  if (parsed.protocol !== 'https:' && !isAllowedLocalHttp) {
    throw new Error('El servidor debe usar HTTPS. HTTP solo se permite con el emulador durante desarrollo.');
  }
  if (!__DEV__ && isLocalHost) {
    throw new Error('La app publicada requiere una URL HTTPS pública.');
  }

  return parsed.toString().replace(/\/$/, '');
}

/** Call a same-origin Next.js API route; an explicit API origin may be configured for deployment. */
export function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '');
  return fetch(configuredBase ? `${configuredBase}${path}` : path, init);
}

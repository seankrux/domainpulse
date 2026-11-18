/** Public-Internet transport for Workers; callers validate every DNS/redirect hop. */
export const isWorkerRuntime = (): boolean => process.env.DOMAINPULSE_WORKER === 'true';

export async function workerRequest(
  url: string,
  options: { method: 'HEAD' | 'GET'; userAgent: string; timeoutMs: number; maxBodyBytes?: number },
): Promise<{ status: number; headers: Record<string, string>; body: string; location?: string }> {
  const response = await fetch(url, {
    method: options.method,
    redirect: 'manual',
    headers: { 'User-Agent': options.userAgent },
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  const headers = Object.fromEntries(response.headers.entries());
  let body = '';
  if (response.body && options.maxBodyBytes) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const available = Math.max(0, options.maxBodyBytes - bytes);
        const bounded = chunk.value.subarray(0, available);
        body += decoder.decode(bounded, { stream: true });
        bytes += chunk.value.byteLength;
        if (bytes >= options.maxBodyBytes) break;
      }
      body += decoder.decode();
    } finally {
      await reader.cancel();
    }
  } else {
    await response.body?.cancel();
  }
  return { status: response.status, headers, body, location: response.headers.get('location') ?? undefined };
}

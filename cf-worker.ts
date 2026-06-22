export interface Env {
  ASSETS: Fetcher;
}

// Serve the Vite-built SPA. Fall back to index.html for client-side routes.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      const response = await env.ASSETS.fetch(request);
      // If CF returns 404 for a path (client-side route), serve index.html
      if (response.status === 404 && !url.pathname.startsWith('/api/') && !url.pathname.includes('.')) {
        return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
      }
      return response;
    } catch {
      return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }
  },
};

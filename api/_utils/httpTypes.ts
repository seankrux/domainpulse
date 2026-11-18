/** Transport contract shared by the Worker adapter and Node API handlers. */
export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined> & { origin?: string; authorization?: string };
  query: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  socket: { remoteAddress?: string };
}

export interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): this;
  json(value: unknown): this;
  end(): this;
}

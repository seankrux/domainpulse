import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PROXY_PORT || 3001;

app.use(cors());
app.use(express.json());

interface CheckResult {
  status: 'ALIVE' | 'DOWN' | 'ERROR';
  statusCode: number;
  latency: number;
  message?: string;
}

app.get('/api/check', async (req, res) => {
  const url = req.query.url as string;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const startTime = Date.now();
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'DomainPulse/1.0 (Domain Monitor)'
      }
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    const result: CheckResult = {
      status: response.ok ? 'ALIVE' : 'DOWN',
      statusCode: response.status,
      latency
    };

    res.json(result);
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Determine error type
    let statusCode = 0;
    if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      statusCode = 408;
    } else if (errorMessage.includes('ENOTFOUND')) {
      statusCode = 0; // DNS failure
    } else if (errorMessage.includes('ECONNREFUSED')) {
      statusCode = 0; // Connection refused
    } else if (errorMessage.includes('abort')) {
      statusCode = 408; // Request timeout
    }

    res.json({
      status: 'DOWN' as const,
      statusCode,
      latency,
      message: errorMessage
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});

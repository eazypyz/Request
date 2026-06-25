/**
 * HTTP Request Repeater - Node.js Express Proxy Server
 * =====================================================
 * Alternative backend proxy using Node.js and Express.
 * Useful for local development or self-hosted deployment.
 * 
 * Usage:
 *   npm install express cors
 *   node proxy/server.js
 * 
 * Then set the proxy URL in Settings to: http://localhost:3000/proxy
 */

const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

app.post('/proxy', async (req, res) => {
  try {
    const { url: targetUrl, method = 'GET', headers = {}, body: reqBody } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url field' });
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: headers,
    };

    if (reqBody && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      fetchOptions.body = reqBody;
    }

    const response = await fetch(targetUrl, fetchOptions);
    const responseBody = await response.text();

    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const cookies = {};
    const setCookies = response.headers.getSetCookie?.() || [];
    setCookies.forEach(c => {
      const [name, ...rest] = c.split(';')[0].split('=');
      if (name) cookies[name.trim()] = rest.join('=').trim();
    });

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      cookies: cookies,
      url: targetUrl,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'http-repeater-proxy' });
});

app.listen(PORT, () => {
  console.log(`HTTP Repeater Proxy running on http://localhost:${PORT}`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/proxy`);
});

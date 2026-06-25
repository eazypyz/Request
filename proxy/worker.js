/**
 * HTTP Request Repeater - Cloudflare Worker Proxy
 * ================================================
 * Deploy this to Cloudflare Workers to bypass CORS restrictions.
 * This proxy forwards requests to any target URL and returns the response.
 * 
 * Deployment:
 * 1. Go to https://workers.cloudflare.com/
 * 2. Create a new Worker
 * 3. Paste this code
 * 4. Save and deploy
 * 5. Copy the Worker URL and paste it in Settings > Proxy URL
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST to /proxy
    const url = new URL(request.url);
    if (url.pathname !== '/proxy' || request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST /proxy' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const body = await request.json();
      const { url: targetUrl, method = 'GET', headers = {}, body: reqBody } = body;

      if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing url field' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Build fetch options
      const fetchOptions = {
        method: method.toUpperCase(),
        headers: headers,
      };

      if (reqBody && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        fetchOptions.body = reqBody;
      }

      // Forward the request
      const response = await fetch(targetUrl, fetchOptions);
      const responseBody = await response.text();

      // Extract response headers
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Extract cookies from Set-Cookie
      const cookies = {};
      const setCookies = response.headers.getSetCookie?.() || [];
      setCookies.forEach(c => {
        const [name, ...rest] = c.split(';')[0].split('=');
        if (name) cookies[name.trim()] = rest.join('=').trim();
      });

      const result = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        cookies: cookies,
        url: targetUrl,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};

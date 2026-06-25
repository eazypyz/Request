/**
 * HTTP Request Repeater - Utility Functions
 * ============================================
 * Pure helper functions for parsing, formatting, and converting HTTP data.
 */

/**
 * Parse a raw HTTP request string into structured object
 * @param {string} raw - Raw HTTP request text
 * @returns {object|null} Parsed request or null if invalid
 */
export function parseHttpRequest(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const lines = raw.split('\n');
  const firstLine = lines[0].trim();

  // Match: METHOD path HTTP/version
  const match = firstLine.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE)\s+(\S+)\s+HTTP\/[\d.]+$/i);
  if (!match) return null;

  const method = match[1].toUpperCase();
  const path = match[2];

  // Parse headers
  const headers = {};
  let i = 1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') break; // Empty line = end of headers
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      headers[key] = val;
    }
  }

  // Body is everything after the empty line
  const body = lines.slice(i + 1).join('\n').replace(/\n$/, '');

  // Construct full URL
  let url = path;
  if (!url.startsWith('http')) {
    const host = headers['Host'] || headers['host'];
    if (!host) return null;
    // Default to HTTPS if no protocol specified
    url = `https://${host}${path}`;
  }

  return { method, url, path, headers, body, raw };
}

/**
 * Format a raw HTTP request (reorder headers, pretty-print JSON body)
 * @param {string} raw - Raw HTTP request
 * @returns {string} Formatted request
 */
export function formatHttpRequest(raw) {
  const parsed = parseHttpRequest(raw);
  if (!parsed) return raw;

  let formatted = `${parsed.method} ${parsed.path} HTTP/1.1\n`;

  // Reorder headers: Host first, then alphabetically
  const headerKeys = Object.keys(parsed.headers);
  const hostIdx = headerKeys.findIndex(k => k.toLowerCase() === 'host');
  if (hostIdx > 0) {
    const [host] = headerKeys.splice(hostIdx, 1);
    headerKeys.unshift(host);
  }

  for (const key of headerKeys) {
    formatted += `${key}: ${parsed.headers[key]}\n`;
  }

  // Pretty print JSON body if applicable
  if (parsed.body) {
    const ct = (parsed.headers['Content-Type'] || parsed.headers['content-type'] || '').toLowerCase();
    if (ct.includes('json')) {
      try {
        const json = JSON.parse(parsed.body);
        formatted += `\n${JSON.stringify(json, null, 2)}`;
      } catch {
        formatted += `\n${parsed.body}`;
      }
    } else {
      formatted += `\n${parsed.body}`;
    }
  }

  return formatted;
}

/**
 * Parse a cURL command into request components
 * @param {string} curl - cURL command string
 * @returns {object} Parsed request data
 */
export function parseCurl(curl) {
  const result = { method: 'GET', url: '', headers: {}, body: '' };
  if (!curl) return result;

  // Normalize: remove line continuations and extra spaces
  let cmd = curl.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Extract URL (handle quotes)
  const urlPatterns = [
    /['"](https?:\/\/[^'"]+)['"]/,
    /\s(https?:\/\/\S+)(?:\s|$)/,
    /\s'(https?:\/\/[^']+)'/,
    /\s"(https?:\/\/[^"]+)"/,
  ];
  for (const pattern of urlPatterns) {
    const m = cmd.match(pattern);
    if (m) {
      result.url = m[1].replace(/['"]/g, '');
      break;
    }
  }

  // Extract method
  const methodMatch = cmd.match(/--request\s+(['"]?)(\w+)\1|-X\s+(['"]?)(\w+)\3/);
  if (methodMatch) {
    result.method = (methodMatch[2] || methodMatch[4]).toUpperCase();
  }

  // Extract headers
  const headerRegex = /-H\s+(['"])((?:\\.|[^\\])*?)\1/g;
  let hm;
  while ((hm = headerRegex.exec(cmd)) !== null) {
    const header = hm[2];
    const idx = header.indexOf(':');
    if (idx > 0) {
      const key = header.slice(0, idx).trim();
      const val = header.slice(idx + 1).trim();
      result.headers[key] = val;
    }
  }

  // Extract body
  const bodyPatterns = [
    /--data(?:-raw)?\s+(['"])((?:\\.|[^\\])*?)\1/,
    /--data-binary\s+(['"])((?:\\.|[^\\])*?)\1/,
    /--data\s+@?(['"])((?:\\.|[^\\])*?)\1/,
  ];
  for (const pattern of bodyPatterns) {
    const bm = cmd.match(pattern);
    if (bm) {
      result.body = bm[2] || '';
      if (result.method === 'GET') result.method = 'POST';
      break;
    }
  }

  return result;
}

/**
 * Convert parsed request to cURL command
 * @param {object} request - Parsed request object
 * @returns {string} cURL command
 */
export function toCurl(request) {
  if (!request || !request.url) return '';
  let curl = `curl -X ${request.method} '${request.url}'`;
  for (const [k, v] of Object.entries(request.headers)) {
    curl += ` -H '${k}: ${v}'`;
  }
  if (request.body) {
    const escaped = request.body.replace(/'/g, "'\''");
    curl += ` --data-raw '${escaped}'`;
  }
  return curl;
}

/**
 * Pretty print JSON string with indentation
 * @param {string} str - JSON string
 * @returns {string} Pretty printed JSON
 */
export function prettyPrintJSON(str) {
  try {
    const obj = JSON.parse(str);
    return JSON.stringify(obj, null, 2);
  } catch {
    return str;
  }
}

/**
 * Apply syntax highlighting to JSON string (returns HTML)
 * @param {string} json - JSON string
 * @returns {string} HTML with syntax highlighting
 */
export function syntaxHighlightJSON(json) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

/**
 * Pretty print XML string with indentation
 * @param {string} xml - XML string
 * @returns {string} Formatted XML
 */
export function prettyPrintXML(xml) {
  if (!xml) return xml;
  let formatted = '';
  let indent = 0;
  const nodes = xml.replace(/>\s*</g, '><').split(/(<[^>]+>)/g).filter(n => n.trim());
  nodes.forEach(node => {
    if (node.match(/^<\/\w/)) indent = Math.max(0, indent - 1);
    formatted += '  '.repeat(indent) + node + '\n';
    if (node.match(/^<\w[^>]*[^/]>.*$/)) indent++;
  });
  return formatted || xml;
}

/**
 * Escape HTML special characters
 * @param {string} text - Raw text
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatBytes(bytes) {
  if (bytes === 0 || bytes == null) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
export function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

/**
 * Detect content type from response body and headers
 * @param {string} body - Response body
 * @param {string} contentType - Content-Type header
 * @returns {string} Detected type: json, xml, html, text
 */
export function detectContentType(body, contentType = '') {
  const ct = contentType.toLowerCase();
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('html')) return 'html';
  // Try to detect from body
  if (body && body.trim().startsWith('<')) {
    if (body.trim().startsWith('<?xml')) return 'xml';
    return 'html';
  }
  if (body && (body.trim().startsWith('{') || body.trim().startsWith('['))) {
    try {
      JSON.parse(body);
      return 'json';
    } catch { /* not json */ }
  }
  return 'text';
}

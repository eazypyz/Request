/**
 * HTTP Request Repeater - Main Application
 * =========================================
 * Core application logic: tab management, request sending, response handling,
 * import/export, history, and UI interactions.
 */

import { HttpEditor } from './editor.js';
import {
  parseHttpRequest, formatHttpRequest, parseCurl, toCurl,
  prettyPrintJSON, syntaxHighlightJSON, prettyPrintXML, escapeHtml,
  formatBytes, copyToClipboard, detectContentType
} from './utils.js';

// ==================== CONFIG ====================
const DEFAULT_REQUEST = `GET https://httpbin.org/get HTTP/1.1
Host: httpbin.org
User-Agent: HTTP-Repeater/1.0
Accept: */*
Connection: close
`;

const DEFAULT_PROXY = '';
const DEFAULT_TIMEOUT = 30000;

// ==================== STATE ====================
const state = {
  tabs: [],
  activeTabId: null,
  history: [],
  settings: {
    proxyUrl: DEFAULT_PROXY,
    timeout: DEFAULT_TIMEOUT,
  },
  editors: new Map(), // tabId -> HttpEditor
  isSending: false,
  mobilePanel: 'request', // 'request' | 'response'
  resizerDragging: false,
  resizerStartY: 0,
  resizerStartHeight: 0,
};

// ==================== DOM REFS ====================
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  tabsContainer: $('tabsContainer'),
  btnNewTab: $('btnNewTab'),
  btnSend: $('btnSend'),
  btnDuplicate: $('btnDuplicate'),
  btnClear: $('btnClear'),
  btnCompare: $('btnCompare'),
  btnHistory: $('btnHistory'),
  btnImport: $('btnImport'),
  btnExport: $('btnExport'),
  btnSettings: $('btnSettings'),
  btnFormat: $('btnFormat'),
  requestPanel: $('requestPanel'),
  responsePanel: $('responsePanel'),
  resizer: $('resizer'),
  mainContainer: $('mainContainer'),
  responseMeta: $('responseMeta'),
  respRaw: $('respRaw'),
  respPreview: $('respPreview'),
  respHeaders: $('respHeaders'),
  respCookies: $('respCookies'),
  loading: $('loading'),
  mobileTabs: $('mobileTabs'),
  // Modals
  historyModal: $('historyModal'),
  importModal: $('importModal'),
  exportModal: $('exportModal'),
  settingsModal: $('settingsModal'),
  compareModal: $('compareModal'),
  // Modal content
  historyList: $('historyList'),
  curlInput: $('curlInput'),
  btnImportCurl: $('btnImportCurl'),
  btnExportCurl: $('btnExportCurl'),
  btnExportJson: $('btnExportJson'),
  proxyUrl: $('proxyUrl'),
  timeoutSetting: $('timeoutSetting'),
  btnSaveSettings: $('btnSaveSettings'),
  compareOld: $('compareOld'),
  compareNew: $('compareNew'),
  compareOldMeta: $('compareOldMeta'),
  compareNewMeta: $('compareNewMeta'),
};

// ==================== INIT ====================
function init() {
  loadSettings();
  loadHistory();

  // Create first tab if none exists
  if (state.tabs.length === 0) {
    createTab('Request 1', DEFAULT_REQUEST);
  }

  bindEvents();
  updateUI();
  renderTabs();

  // Check for mobile
  checkMobileLayout();
  window.addEventListener('resize', checkMobileLayout);
}

// ==================== TAB MANAGEMENT ====================
function createTab(name, content = '') {
  const id = Date.now() + Math.random().toString(36).slice(2, 8);
  const tab = {
    id,
    name: name || `Request ${state.tabs.length + 1}`,
    content: content || '',
    response: null,
    previousResponse: null,
  };
  state.tabs.push(tab);
  switchToTab(id);
  return tab;
}

function switchToTab(id) {
  // Save current editor content before switching
  if (state.activeTabId && state.editors.has(state.activeTabId)) {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (tab) {
      tab.content = state.editors.get(state.activeTabId).getValue();
    }
  }

  state.activeTabId = id;
  const tab = state.tabs.find(t => t.id === id);

  // Destroy old editor if exists
  const editorContainer = document.getElementById('requestEditor');
  editorContainer.innerHTML = '';

  // Create new editor
  const editor = new HttpEditor(editorContainer, {
    value: tab.content,
    onChange: (val) => {
      tab.content = val;
    },
    onKeydown: (e) => handleEditorKeydown(e),
  });
  state.editors.set(id, editor);

  renderTabs();
  renderResponse(tab.response);
  updateCompareButton();
}

function closeTab(id, event) {
  if (event) event.stopPropagation();
  const idx = state.tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  state.tabs.splice(idx, 1);
  state.editors.delete(id);

  if (state.activeTabId === id) {
    if (state.tabs.length > 0) {
      switchToTab(state.tabs[Math.min(idx, state.tabs.length - 1)].id);
    } else {
      createTab('Request 1', DEFAULT_REQUEST);
    }
  } else {
    renderTabs();
  }
}

function duplicateTab() {
  const current = state.tabs.find(t => t.id === state.activeTabId);
  if (!current) return;
  const newTab = createTab(`${current.name} (Copy)`, current.content);
  newTab.response = current.response ? JSON.parse(JSON.stringify(current.response)) : null;
  newTab.previousResponse = current.previousResponse ? JSON.parse(JSON.stringify(current.previousResponse)) : null;
}

function renderTabs() {
  els.tabsContainer.innerHTML = '';
  state.tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = `tab ${tab.id === state.activeTabId ? 'active' : ''}`;
    el.innerHTML = `
      <span class="tab-name">${escapeHtml(tab.name)}</span>
      <button class="tab-close" title="Close (Ctrl+W)">&times;</button>
    `;
    el.addEventListener('click', (e) => {
      if (!e.target.classList.contains('tab-close')) {
        switchToTab(tab.id);
      }
    });
    el.querySelector('.tab-close').addEventListener('click', (e) => closeTab(tab.id, e));
    els.tabsContainer.appendChild(el);
  });
}

// ==================== REQUEST SENDING ====================
async function sendRequest() {
  if (state.isSending) return;

  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab) return;

  const raw = state.editors.get(tab.id)?.getValue() || tab.content;
  const parsed = parseHttpRequest(raw);

  if (!parsed) {
    showResponseError('Invalid HTTP request format. First line must be: METHOD path HTTP/version');
    return;
  }

  state.isSending = true;
  els.loading.classList.add('active');
  els.btnSend.disabled = true;

  const startTime = performance.now();

  try {
    let response;

    if (state.settings.proxyUrl) {
      // Use proxy to bypass CORS
      response = await fetchProxy(parsed, raw, startTime);
    } else {
      // Direct fetch (will fail for cross-origin without proxy)
      response = await fetchDirect(parsed, startTime);
    }

    // Save previous response for comparison
    tab.previousResponse = tab.response ? JSON.parse(JSON.stringify(tab.response)) : null;
    tab.response = response;

    // Add to history
    addToHistory(parsed, response);

    renderResponse(response);
    updateCompareButton();

  } catch (err) {
    showResponseError(err.message || 'Request failed');
  } finally {
    state.isSending = false;
    els.loading.classList.remove('active');
    els.btnSend.disabled = false;
  }
}

async function fetchProxy(parsed, raw, startTime) {
  const res = await fetch(state.settings.proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: parsed.url,
      method: parsed.method,
      headers: parsed.headers,
      body: parsed.body,
      raw: raw,
    }),
    signal: AbortSignal.timeout(state.settings.timeout),
  });

  const data = await res.json();
  const endTime = performance.now();

  return {
    status: data.status || 0,
    statusText: data.statusText || '',
    headers: data.headers || {},
    body: data.body || '',
    cookies: data.cookies || {},
    time: Math.round(endTime - startTime),
    size: new Blob([data.body || '']).size,
    raw: data,
  };
}

async function fetchDirect(parsed, startTime) {
  const fetchHeaders = new Headers();
  for (const [k, v] of Object.entries(parsed.headers)) {
    if (k.toLowerCase() === 'host') continue; // Host is set automatically
    fetchHeaders.set(k, v);
  }

  const res = await fetch(parsed.url, {
    method: parsed.method,
    headers: fetchHeaders,
    body: parsed.body || undefined,
    signal: AbortSignal.timeout(state.settings.timeout),
  });

  const body = await res.text();
  const endTime = performance.now();

  // Extract cookies from Set-Cookie headers
  const cookies = {};
  const setCookie = res.headers.getSetCookie?.() || [];
  setCookie.forEach(c => {
    const [name, ...rest] = c.split(';')[0].split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  });

  // Convert headers to plain object
  const headers = {};
  res.headers.forEach((v, k) => { headers[k] = v; });

  return {
    status: res.status,
    statusText: res.statusText,
    headers,
    body,
    cookies,
    time: Math.round(endTime - startTime),
    size: new Blob([body]).size,
    raw: { status: res.status, statusText: res.statusText },
  };
}

function showResponseError(message) {
  const errorResponse = {
    status: 0,
    statusText: 'Error',
    headers: {},
    body: message,
    cookies: {},
    time: 0,
    size: 0,
    isError: true,
  };
  renderResponse(errorResponse);
}

// ==================== RESPONSE RENDERING ====================
function renderResponse(response) {
  if (!response) {
    els.responseMeta.innerHTML = '';
    els.respRaw.innerHTML = '<pre class="viewer-pre">Send a request to see the response...</pre>';
    els.respPreview.innerHTML = '';
    els.respHeaders.innerHTML = '';
    els.respCookies.innerHTML = '';
    return;
  }

  // Status meta
  const statusClass = response.isError ? 'status-error' :
    response.status >= 200 && response.status < 300 ? 'status-success' :
    response.status >= 300 && response.status < 400 ? 'status-redirect' :
    response.status >= 400 ? 'status-error' : 'status-info';

  els.responseMeta.innerHTML = `
    <span class="${statusClass}">${response.status} ${response.statusText}</span>
    <span>⏱ ${response.time}ms</span>
    <span>📦 ${formatBytes(response.size)}</span>
  `;

  // Raw tab
  const ct = response.headers['content-type'] || response.headers['Content-Type'] || '';
  const detected = detectContentType(response.body, ct);

  if (detected === 'json') {
    els.respRaw.innerHTML = `<pre class="viewer-pre">${syntaxHighlightJSON(prettyPrintJSON(response.body))}</pre>`;
  } else if (detected === 'xml') {
    els.respRaw.innerHTML = `<pre class="viewer-pre">${escapeHtml(prettyPrintXML(response.body))}</pre>`;
  } else {
    els.respRaw.innerHTML = `<pre class="viewer-pre">${escapeHtml(response.body)}</pre>`;
  }

  // Preview tab
  if (detected === 'html') {
    els.respPreview.innerHTML = `<iframe class="preview-iframe" sandbox="allow-scripts" srcdoc="${escapeHtml(response.body)}"></iframe>`;
  } else if (detected === 'json') {
    try {
      const obj = JSON.parse(response.body);
      els.respPreview.innerHTML = `<pre class="viewer-pre">${syntaxHighlightJSON(JSON.stringify(obj, null, 2))}</pre>`;
    } catch {
      els.respPreview.innerHTML = `<pre class="viewer-pre">${escapeHtml(response.body)}</pre>`;
    }
  } else {
    els.respPreview.innerHTML = `<pre class="viewer-pre">${escapeHtml(response.body)}</pre>`;
  }

  // Headers tab
  const headersHtml = Object.entries(response.headers).map(([k, v]) => `
    <tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>
  `).join('');
  els.respHeaders.innerHTML = headersHtml
    ? `<table class="headers-table">${headersHtml}</table>`
    : '<p class="empty-state">No headers</p>';

  // Cookies tab
  const cookiesEntries = Object.entries(response.cookies || {});
  const cookiesHtml = cookiesEntries.map(([k, v]) => `
    <tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>
  `).join('');
  els.respCookies.innerHTML = cookiesHtml
    ? `<table class="headers-table">${cookiesHtml}</table>`
    : '<p class="empty-state">No cookies</p>';
}

// ==================== HISTORY ====================
function addToHistory(parsed, response) {
  const entry = {
    id: Date.now(),
    method: parsed.method,
    url: parsed.url,
    status: response.status,
    statusText: response.statusText,
    time: response.time,
    size: response.size,
    timestamp: new Date().toISOString(),
    request: parsed,
    response,
  };
  state.history.unshift(entry);
  if (state.history.length > 100) state.history.pop();
  saveHistory();
}

function renderHistory() {
  if (state.history.length === 0) {
    els.historyList.innerHTML = '<p class="empty-state">No history yet. Send a request to build history.</p>';
    return;
  }

  els.historyList.innerHTML = state.history.map(h => {
    const statusClass = h.status >= 200 && h.status < 300 ? 'status-success' :
      h.status >= 300 && h.status < 400 ? 'status-redirect' :
      h.status >= 400 ? 'status-error' : 'status-info';
    const time = new Date(h.timestamp).toLocaleTimeString();
    return `
      <div class="history-item" data-id="${h.id}">
        <div>
          <span class="method method-${h.method}">${h.method}</span>
          <span class="history-url">${escapeHtml(h.url)}</span>
        </div>
        <div class="history-meta">
          <span class="${statusClass}">${h.status} ${h.statusText}</span>
          <span>⏱ ${h.time}ms</span>
          <span>📦 ${formatBytes(h.size)}</span>
          <span>🕐 ${time}</span>
        </div>
      </div>
    `;
  }).join('');

  els.historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const entry = state.history.find(h => h.id === parseInt(el.dataset.id));
      if (entry) loadHistoryEntry(entry);
    });
  });
}

function loadHistoryEntry(entry) {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab) return;

  const raw = entry.request.raw || formatRawRequest(entry.request);
  tab.content = raw;
  tab.response = entry.response;

  const editor = state.editors.get(tab.id);
  if (editor) editor.setValue(raw);

  renderResponse(entry.response);
  updateCompareButton();
  closeModal(els.historyModal);
}

function formatRawRequest(req) {
  let raw = `${req.method} ${req.path || req.url} HTTP/1.1\n`;
  for (const [k, v] of Object.entries(req.headers)) {
    raw += `${k}: ${v}\n`;
  }
  if (req.body) raw += `\n${req.body}`;
  return raw;
}

// ==================== IMPORT / EXPORT ====================
function importCurl() {
  const curl = els.curlInput.value.trim();
  if (!curl) return;

  const parsed = parseCurl(curl);
  if (!parsed.url) {
    alert('Could not parse cURL command. Please check the format.');
    return;
  }

  let raw = `${parsed.method} ${parsed.url} HTTP/1.1\n`;
  for (const [k, v] of Object.entries(parsed.headers)) {
    raw += `${k}: ${v}\n`;
  }
  if (parsed.body) {
    raw += `Content-Length: ${new Blob([parsed.body]).size}\n`;
    raw += `\n${parsed.body}`;
  }

  createTab('Imported cURL', raw);
  els.curlInput.value = '';
  closeModal(els.importModal);
}

function exportCurl() {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab) return;
  const raw = state.editors.get(tab.id)?.getValue() || tab.content;
  const parsed = parseHttpRequest(raw);
  if (!parsed) {
    alert('Invalid request format');
    return;
  }
  const curl = toCurl(parsed);
  copyToClipboard(curl);
  alert('cURL command copied to clipboard!');
  closeModal(els.exportModal);
}

function exportJson() {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab) return;
  const raw = state.editors.get(tab.id)?.getValue() || tab.content;
  const parsed = parseHttpRequest(raw);
  if (!parsed) {
    alert('Invalid request format');
    return;
  }

  const data = {
    name: tab.name,
    method: parsed.method,
    url: parsed.url,
    headers: parsed.headers,
    body: parsed.body,
    timestamp: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tab.name.replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeModal(els.exportModal);
}

// ==================== COMPARE ====================
function updateCompareButton() {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  const hasBoth = tab && tab.previousResponse && tab.response;
  els.btnCompare.style.display = hasBoth ? 'inline-flex' : 'none';
}

function showCompare() {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab || !tab.previousResponse || !tab.response) return;

  const oldR = tab.previousResponse;
  const newR = tab.response;

  els.compareOldMeta.textContent = `${oldR.status} ${oldR.statusText} · ${oldR.time}ms`;
  els.compareNewMeta.textContent = `${newR.status} ${newR.statusText} · ${newR.time}ms`;

  els.compareOld.textContent = oldR.body || '(empty)';
  els.compareNew.textContent = newR.body || '(empty)';

  openModal(els.compareModal);
}

// ==================== SETTINGS ====================
function loadSettings() {
  try {
    const saved = localStorage.getItem('httpRepeaterSettings');
    if (saved) {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
    }
  } catch { /* ignore */ }

  els.proxyUrl.value = state.settings.proxyUrl;
  els.timeoutSetting.value = state.settings.timeout;
}

function saveSettings() {
  state.settings.proxyUrl = els.proxyUrl.value.trim();
  state.settings.timeout = parseInt(els.timeoutSetting.value) || 30000;
  localStorage.setItem('httpRepeaterSettings', JSON.stringify(state.settings));
  closeModal(els.settingsModal);
}

function loadHistory() {
  try {
    const saved = localStorage.getItem('httpRepeaterHistory');
    if (saved) {
      state.history = JSON.parse(saved);
    }
  } catch { /* ignore */ }
}

function saveHistory() {
  try {
    localStorage.setItem('httpRepeaterHistory', JSON.stringify(state.history.slice(0, 100)));
  } catch { /* ignore */ }
}

// ==================== MODALS ====================
function openModal(modal) {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function closeAllModals() {
  $$('.modal').forEach(m => m.classList.remove('active'));
  document.body.style.overflow = '';
}

// ==================== FORMAT ====================
function formatCurrent() {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab) return;
  const editor = state.editors.get(tab.id);
  if (!editor) return;
  const formatted = formatHttpRequest(editor.getValue());
  if (formatted !== editor.getValue()) {
    editor.setValue(formatted);
  }
}

// ==================== CLEAR ====================
function clearCurrent() {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (!tab) return;
  const editor = state.editors.get(tab.id);
  if (editor) editor.setValue('');
  tab.content = '';
  tab.response = null;
  tab.previousResponse = null;
  renderResponse(null);
  updateCompareButton();
}

// ==================== RESIZER ====================
function initResizer() {
  els.resizer.addEventListener('mousedown', (e) => {
    state.resizerDragging = true;
    state.resizerStartY = e.clientY;
    state.resizerStartHeight = els.requestPanel.offsetHeight;
    els.resizer.classList.add('resizing');
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!state.resizerDragging) return;
    const delta = e.clientY - state.resizerStartY;
    const total = els.mainContainer.offsetHeight - 10; // minus resizer
    const newH = Math.max(100, Math.min(total - 100, state.resizerStartHeight + delta));
    els.requestPanel.style.height = `${newH}px`;
    els.requestPanel.style.flex = 'none';
  });

  document.addEventListener('mouseup', () => {
    if (state.resizerDragging) {
      state.resizerDragging = false;
      els.resizer.classList.remove('resizing');
      document.body.style.cursor = '';
    }
  });

  // Touch support for resizer
  els.resizer.addEventListener('touchstart', (e) => {
    state.resizerDragging = true;
    state.resizerStartY = e.touches[0].clientY;
    state.resizerStartHeight = els.requestPanel.offsetHeight;
    els.resizer.classList.add('resizing');
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!state.resizerDragging) return;
    e.preventDefault();
    const delta = e.touches[0].clientY - state.resizerStartY;
    const total = els.mainContainer.offsetHeight - 10;
    const newH = Math.max(100, Math.min(total - 100, state.resizerStartHeight + delta));
    els.requestPanel.style.height = `${newH}px`;
    els.requestPanel.style.flex = 'none';
  }, { passive: false });

  document.addEventListener('touchend', () => {
    state.resizerDragging = false;
    els.resizer.classList.remove('resizing');
  });
}

// ==================== MOBILE PANELS ====================
function checkMobileLayout() {
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    // Reset mobile styles on desktop
    els.requestPanel.style = '';
    els.responsePanel.style = '';
    els.requestPanel.classList.remove('hidden-mobile');
    els.responsePanel.classList.remove('active-mobile');
  }
}

function switchMobilePanel(panel) {
  state.mobilePanel = panel;

  if (panel === 'request') {
    els.requestPanel.classList.remove('hidden-mobile');
    els.responsePanel.classList.remove('active-mobile');
  } else {
    els.requestPanel.classList.add('hidden-mobile');
    els.responsePanel.classList.add('active-mobile');
  }

  els.mobileTabs.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === panel);
  });
}

// ==================== KEYBOARD SHORTCUTS ====================
function handleEditorKeydown(e) {
  // Ctrl+Enter: Send
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    sendRequest();
    return;
  }

  // Let other shortcuts pass through to global handler
}

function handleGlobalKeydown(e) {
  // Ctrl+Enter: Send (global)
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    sendRequest();
    return;
  }

  // Ctrl+T: New Tab
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    createTab();
    return;
  }

  // Ctrl+W: Close Tab
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault();
    closeTab(state.activeTabId);
    return;
  }

  // Escape: Close modals
  if (e.key === 'Escape') {
    closeAllModals();
    return;
  }
}

// ==================== EVENT BINDING ====================
function bindEvents() {
  // Toolbar
  els.btnNewTab.addEventListener('click', () => createTab());
  els.btnSend.addEventListener('click', sendRequest);
  els.btnDuplicate.addEventListener('click', duplicateTab);
  els.btnClear.addEventListener('click', clearCurrent);
  els.btnCompare.addEventListener('click', showCompare);
  els.btnHistory.addEventListener('click', () => { renderHistory(); openModal(els.historyModal); });
  els.btnImport.addEventListener('click', () => openModal(els.importModal));
  els.btnExport.addEventListener('click', () => openModal(els.exportModal));
  els.btnSettings.addEventListener('click', () => openModal(els.settingsModal));
  els.btnFormat.addEventListener('click', formatCurrent);

  // Modal actions
  els.btnImportCurl.addEventListener('click', importCurl);
  els.btnExportCurl.addEventListener('click', exportCurl);
  els.btnExportJson.addEventListener('click', exportJson);
  els.btnSaveSettings.addEventListener('click', saveSettings);

  // Response tabs
  $$('.resp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.resp-tab-btn').forEach(b => b.classList.remove('active'));
      $$('.response-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      $(`resp${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`).classList.add('active');
    });
  });

  // Mobile tabs
  els.mobileTabs.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMobilePanel(btn.dataset.panel));
  });

  // Modal close buttons
  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) closeModal(modal);
    });
  });

  // Close modal on backdrop click
  $$('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleGlobalKeydown);

  // Resizer
  initResizer();
}

// ==================== UI UPDATES ====================
function updateUI() {
  // Any periodic UI updates can go here
}

// ==================== STARTUP ====================
document.addEventListener('DOMContentLoaded', init);

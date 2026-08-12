import { normalizePossiblyMojibakeText, normalizePossiblyMojibakeValue } from './textEncoding';

// Debounce 401 redirects to avoid duplicate navigation.
let isRedirecting = false;

const DEFAULT_TIMEOUT = 300000;

function readAccessTokenFromStorage() {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
}

function appendParams(url, params) {
  if (!params || typeof params !== 'object') {
    return url;
  }

  const base = window.location.origin || 'http://localhost';
  const parsed = new URL(url, base);

  Object.entries(params).forEach(([key, value]) => {
    if (value == null) {
      return;
    }
    parsed.searchParams.set(key, String(value));
  });

  return parsed.pathname + parsed.search + parsed.hash;
}

function createTimeoutSignal(timeout) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, timeout);

  return {
    signal: controller.signal,
    clear: () => {
      window.clearTimeout(timer);
    },
  };
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return normalizePossiblyMojibakeValue(await response.json());
    } catch {
      return {};
    }
  }

  const text = normalizePossiblyMojibakeText(await response.text());
  if (!text) {
    return {};
  }

  try {
    return normalizePossiblyMojibakeValue(JSON.parse(text));
  } catch {
    return { message: text };
  }
}

function maybeRedirect401(status, config = {}) {
  if (status !== 401) {
    return false;
  }

  const doNotRedirect = config.doNotRedirect || false;
  if (doNotRedirect || ['/login'].includes(window.location.pathname)) {
    return false;
  }

  if (!isRedirecting) {
    isRedirecting = true;
    localStorage.clear();
    window.location.href = '/login';
    // Reset flag right after redirect trigger.
    isRedirecting = false;
  }

  return true;
}

function hasApiEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }

  return 'code' in payload || 'data' in payload || 'message' in payload;
}

function isSuccessApiCode(code) {
  if (code == null || code === '') {
    return true;
  }

  const normalized = String(code).trim().toLowerCase();
  return normalized === '0' || normalized === '200' || normalized === 'success' || normalized === 'ok';
}

function unwrapApiResponse(payload) {
  if (!hasApiEnvelope(payload)) {
    return payload;
  }

  if (!isSuccessApiCode(payload.code)) {
    throw JSON.stringify(payload);
  }

  if ('data' in payload) {
    return payload.data;
  }

  return payload;
}

function normalizeHeaders(config = {}) {
  const headers = { ...(config.headers || {}) };
  const token = readAccessTokenFromStorage();

  if (config.type !== 'formdata') {
    headers['Content-Type'] = 'application/json';
  }

  if (!config.skipAuth && token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function normalizeBody(method, data, config = {}) {
  if (method === 'GET' || method === 'HEAD') {
    return undefined;
  }

  if (config.type === 'formdata') {
    return data;
  }

  if (data == null) {
    return undefined;
  }

  return JSON.stringify(data);
}

async function send(config = {}) {
  const method = String(config.method || 'GET').toUpperCase();
  const timeout = Number.isFinite(config.timeout) ? config.timeout : DEFAULT_TIMEOUT;
  const url = appendParams(config.url || '/', config.params);
  const headers = normalizeHeaders(config);
  const body = normalizeBody(method, config.data, config);
  const { signal, clear } = createTimeoutSignal(timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal,
      credentials: 'same-origin',
    });
    const responseData = await parseResponseBody(response);

    if (maybeRedirect401(response.status, config)) {
      return;
    }

    if (!response.ok) {
      throw JSON.stringify(responseData || { message: 'request failed' });
    }

    return unwrapApiResponse(responseData);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw JSON.stringify({ message: 'request timeout' });
    }

    if (typeof error === 'string') {
      throw error;
    }

    if (error instanceof Error) {
      throw JSON.stringify({ message: error.message || 'network error' });
    }

    throw JSON.stringify(error || { message: 'unknown error' });
  } finally {
    clear();
  }
}

// Request helper with axios-like method signatures.
const request = {
  get(url, config = {}) {
    return send({
      ...config,
      url,
      method: 'GET',
    });
  },

  post(url, data, config = {}) {
    return send({
      ...config,
      url,
      data,
      method: 'POST',
    });
  },

  put(url, data, config = {}) {
    return send({
      ...config,
      url,
      data,
      method: 'PUT',
    });
  },

  patch(url, data, config = {}) {
    return send({
      ...config,
      url,
      data,
      method: 'PATCH',
    });
  },

  delete(url, config = {}) {
    return send({
      ...config,
      url,
      method: 'DELETE',
    });
  },
};

export default request;

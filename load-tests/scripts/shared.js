import http from 'k6/http';
import { check, sleep } from 'k6';

const serviceBaseUrl = __ENV.BASE_URL || 'http://localhost:5000';
export const targetUrl = __ENV.TARGET_URL || `${serviceBaseUrl}/api/tables/availability`;
export const metricsUrl = __ENV.METRICS_URL || `${serviceBaseUrl}/metrics`;

export function checkAvailabilityResponse(response) {
  let payload;
  try {
    payload = response.json();
  } catch (_) {
    payload = null;
  }

  check(response, {
    'availability endpoint returns HTTP 200': (r) => r.status === 200,
    'response is JSON': () => payload !== null,
    'availability response has expected structure': () =>
      payload !== null &&
      payload.available === true &&
      typeof payload.message === 'string' &&
      payload.message.length > 0,
  }, { endpoint: 'table-availability' });
}

export function checkMetricsResponse(response) {
  const contentType = response.headers['Content-Type'] || '';
  const body = response.body || '';

  check(response, {
    'metrics endpoint returns HTTP 200': (r) => r.status === 200,
    'metrics response uses Prometheus text content type': () =>
      /^text\/plain(?:\s*;|$)/i.test(contentType),
    'metrics response contains Prometheus metadata': () =>
      /^# (?:HELP|TYPE) [a-zA-Z_:][a-zA-Z0-9_:]* /m.test(body),
    'metrics response contains a metric sample': () =>
      /^[a-zA-Z_:][a-zA-Z0-9_:]*(?:\{[^}]*\})? [0-9]/m.test(body),
  }, { endpoint: 'prometheus-metrics' });
}

export function getAvailability() {
  const response = http.get(targetUrl, {
    headers: { Accept: 'application/json' },
    tags: { endpoint: 'table-availability' },
    timeout: __ENV.REQUEST_TIMEOUT || '10s',
  });
  checkAvailabilityResponse(response);
  sleep(0.5);
}

export function getMetrics() {
  const response = http.get(metricsUrl, {
    headers: { Accept: 'text/plain; version=0.0.4' },
    tags: { endpoint: 'prometheus-metrics' },
    timeout: __ENV.REQUEST_TIMEOUT || '10s',
  });
  checkMetricsResponse(response);
  sleep(0.5);
}

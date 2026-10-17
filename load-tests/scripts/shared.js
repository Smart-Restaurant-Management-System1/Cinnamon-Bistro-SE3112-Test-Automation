import http from 'k6/http';
import { check, sleep } from 'k6';

export const targetUrl = __ENV.TARGET_URL || 'http://localhost:5000/api/tables/availability';

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
    'availability response is true': () => payload !== null && payload.available === true,
  });
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

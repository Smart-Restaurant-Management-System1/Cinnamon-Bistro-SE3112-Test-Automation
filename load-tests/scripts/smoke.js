import { getAvailability, getMetrics } from './shared.js';

export const options = {
  scenarios: {
    table_availability_smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '10s',
      exec: 'availabilitySmoke',
    },
    prometheus_metrics_smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '10s',
      exec: 'metricsSmoke',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    'http_req_duration{endpoint:table-availability}': ['p(95)<1000'],
    'http_req_duration{endpoint:prometheus-metrics}': ['p(95)<1000'],
    'http_reqs{endpoint:table-availability}': ['count>0'],
    'http_reqs{endpoint:prometheus-metrics}': ['count>0'],
    http_req_failed: ['rate<0.01'],
    'http_req_failed{endpoint:table-availability}': ['rate<0.01'],
    'http_req_failed{endpoint:prometheus-metrics}': ['rate<0.01'],
    checks: ['rate>0.99'],
    'checks{endpoint:table-availability}': ['rate>0.99'],
    'checks{endpoint:prometheus-metrics}': ['rate>0.99'],
  },
};

export function availabilitySmoke() {
  getAvailability();
}

export function metricsSmoke() {
  getMetrics();
}

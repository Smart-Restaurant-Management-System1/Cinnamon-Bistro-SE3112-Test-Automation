import { getAvailability } from './shared.js';

export const options = {
  scenarios: {
    baseline: { executor: 'constant-vus', vus: 2, duration: '30s' },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  getAvailability();
}

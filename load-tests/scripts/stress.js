import { getAvailability } from './shared.js';

// Run only against an isolated, explicitly approved test environment.
export const options = {
  scenarios: {
    controlled_stress: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '20s', target: 25 },
        { duration: '20s', target: 40 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  getAvailability();
}

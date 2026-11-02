// TC20 - 100 concurrent virtual users call the timetable endpoint for 2 minutes.
// Run against a running API (Docker Compose or `npm run dev`):
//   k6 run tests/load/timetable-load.k6.js
//   k6 run -e BASE_URL=http://localhost:3000 tests/load/timetable-load.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const EMAIL = __ENV.EMAIL || 'student@timora.edu';
const PASSWORD = __ENV.PASSWORD || 'Password123!';

export const options = {
  vus: 100,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<500'], // p95 below 500 ms
    http_req_failed: ['rate<0.01'] // error rate below 1 %
  }
};

export function setup() {
  const login = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' }
  });
  check(login, { 'signed in': (r) => r.status === 200 });
  return { token: login.json('token') };
}

export default function (data) {
  const timetable = http.get(`${BASE_URL}/api/timetables`, { headers: { Authorization: `Bearer ${data.token}` } });
  check(timetable, { 'timetable 200': (r) => r.status === 200 });
  sleep(1);
}

export function teardown() {
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'API and database UP': (r) => r.json('api') === 'UP' && r.json('database') === 'UP' });
}

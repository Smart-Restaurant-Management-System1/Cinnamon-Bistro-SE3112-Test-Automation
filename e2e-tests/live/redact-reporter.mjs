// Runs before HTML/JUnit reporters so diagnostic step titles cannot retain test passwords.
const values = ['E2E_LIVE_DB_PASSWORD', 'E2E_LIVE_ACCOUNT_PASSWORD', 'E2E_LIVE_WRONG_PASSWORD']
  .map(key => process.env[key]).filter(Boolean);
function clean(value) {
  return values.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), value);
}
function errors(items = []) {
  for (const item of items) {
    for (const key of ['message', 'stack', 'value', 'snippet']) {
      if (typeof item[key] === 'string') item[key] = clean(item[key]);
    }
  }
}
function steps(items = []) {
  for (const item of items) {
    item.title = clean(item.title);
    errors(item.error ? [item.error] : []);
    steps(item.steps);
  }
}
export default class RedactReporter {
  onStepEnd(_test, _result, step) { steps([step]); }
  onTestEnd(_test, result) { errors(result.errors); steps(result.steps); }
  printsToStdio() { return false; }
}

const test = require('node:test');
const assert = require('node:assert');
const { overlaps } = require('../src/utils/scheduling');

test('overlap rules', () => {
  assert.equal(overlaps('2026-11-02 09:00:00', 45, '2026-11-02 09:30:00', 45), true);
  assert.equal(overlaps('2026-11-02 09:00:00', 45, '2026-11-02 09:45:00', 45), false); // back to back is fine
  assert.equal(overlaps('2026-11-02 09:00:00', 60, '2026-11-02 08:15:00', 60), true);
  assert.equal(overlaps('2026-11-02 09:00:00', 30, '2026-11-03 09:00:00', 30), false);
});

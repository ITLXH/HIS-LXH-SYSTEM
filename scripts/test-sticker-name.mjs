import assert from 'node:assert/strict';
import { fittingNameSize } from '../src/patientStickerName.js';

assert.equal(fittingNameSize(10, 100, size => size * 5), 10);
for (const base of [9.5, 10]) {
  for (const width of [30, 65, 100]) {
    for (const length of [10, 30, 100]) {
      const measure = size => size * length;
      const result = fittingNameSize(base, width, measure);
      assert.ok(result > 0 && result <= base);
      assert.ok(measure(result) <= width);
      assert.ok(result === base || measure(result + 0.002) > width);
    }
  }
}
console.log('Name fitting preserves short names and fits long names for both card variants.');

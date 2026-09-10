import assert from 'node:assert/strict';

import { isHiddenDoctorOption, mergeDoctorOptions } from '../src/doctorOptions.js';

assert.deepEqual(
  mergeDoctorOptions(
    [{ value: 'ດຣ. ສົມສີ' }, { value: ' ດຣ. ຄຳພອນ ' }],
    ['OPD Doctor', 'ດຣ. ສົມສີ']
  ),
  ['ດຣ. ສົມສີ', 'ດຣ. ຄຳພອນ'],
  'Master Data doctors should appear first, duplicates should be removed, and generic accounts should stay hidden'
);

assert.deepEqual(
  mergeDoctorOptions([], ['OPD Doctor']),
  [],
  'Generic OPD Doctor account should never appear as a clinical doctor option'
);

assert.equal(isHiddenDoctorOption(' OPD Doctor '), true);
assert.equal(isHiddenDoctorOption('ດຣ. ສົມສີ'), false);

assert.deepEqual(
  mergeDoctorOptions([{ value: 'ດຣ. ສົມສີ' }, { value: '' }, null], []),
  ['ດຣ. ສົມສີ'],
  'Blank and malformed Master Data entries should be ignored'
);

console.log('Doctor option merge tests passed.');

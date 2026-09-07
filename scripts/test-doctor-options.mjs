import assert from 'node:assert/strict';

import { mergeDoctorOptions } from '../src/doctorOptions.js';

assert.deepEqual(
  mergeDoctorOptions(
    [{ value: 'ດຣ. ສົມສີ' }, { value: ' ດຣ. ຄຳພອນ ' }],
    ['OPD Doctor', 'ດຣ. ສົມສີ']
  ),
  ['ດຣ. ສົມສີ', 'ດຣ. ຄຳພອນ', 'OPD Doctor'],
  'Master Data doctors should appear first and duplicate user names should be removed'
);

assert.deepEqual(
  mergeDoctorOptions([], ['OPD Doctor']),
  ['OPD Doctor'],
  'Doctor users remain available when Master Data is empty'
);

assert.deepEqual(
  mergeDoctorOptions([{ value: 'ດຣ. ສົມສີ' }, { value: '' }, null], []),
  ['ດຣ. ສົມສີ'],
  'Blank and malformed Master Data entries should be ignored'
);

console.log('Doctor option merge tests passed.');

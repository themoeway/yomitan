/*
 * Copyright (C) 2023-2026  Yomitan Authors
 * Copyright (C) 2020-2022  Yomichan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {fileURLToPath} from 'node:url';
import path from 'path';
import {describe, it} from 'vitest';
import {createDictionaryArchiveData} from '../dev/dictionary-archive-util.js';
import * as dictionaryValidate from '../dev/dictionary-validate.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} dictionary
 * @param {string} [dictionaryName]
 * @returns {Promise<ArrayBuffer>}
 */
async function createTestDictionaryArchiveData(dictionary, dictionaryName) {
    const dictionaryDirectory = path.join(dirname, 'data', 'dictionaries', dictionary);
    return await createDictionaryArchiveData(dictionaryDirectory, dictionaryName);
}

describe('Dictionary validation', () => {
    const testCases = [
        {name: 'valid-dictionary1', valid: true},
        {name: 'grammar-wildcards', valid: true},
        {name: 'invalid-dictionary1', valid: false},
        {name: 'invalid-dictionary2', valid: false},
        {name: 'invalid-dictionary3', valid: false},
        {name: 'invalid-dictionary4', valid: false},
        {name: 'invalid-dictionary5', valid: false},
        {name: 'invalid-dictionary6', valid: false},
    ];
    const schemas = dictionaryValidate.getSchemas();
    describe.each(testCases)('Test dictionary $name', ({name, valid}) => {
        it(`should be ${valid ? 'valid' : 'invalid'}`, async ({expect}) => {
            const archive = await createTestDictionaryArchiveData(name);
            const promise = dictionaryValidate.validateDictionary(null, archive, schemas);
            await (
                valid ?
                expect(promise).resolves.not.toThrow() :
                expect(promise).rejects.toThrow()
            );
        });
    });
});

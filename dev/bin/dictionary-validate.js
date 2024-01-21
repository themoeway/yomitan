/*
 * Copyright (C) 2023-2024  Yomitan Authors
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

import {testDictionaryFiles} from '../dictionary-validate.js';

/** */
async function main() {
    const dictionaryFileNames = process.argv.slice(2);
    if (dictionaryFileNames.length === 0) {
        console.log([
            'Usage:',
            '  node dictionary-validate [--ajv] <dictionary-file-names>...'
        ].join('\n'));
        return;
    }

    /** @type {import('dev/schema-validate').ValidateMode} */
    let mode = null;
    if (dictionaryFileNames[0] === '--ajv') {
        mode = 'ajv';
        dictionaryFileNames.splice(0, 1);
    }

    await testDictionaryFiles(mode, dictionaryFileNames);
}

main();

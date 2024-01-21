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

import fs from 'fs';
import {performance} from 'perf_hooks';
import {parseJson} from '../../ext/js/core/json.js';
import {createJsonSchema} from '../schema-validate.js';

/** */
function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log([
            'Usage:',
            '  node schema-validate [--ajv] <schema-file-name> <data-file-names>...'
        ].join('\n'));
        return;
    }

    /** @type {import('dev/schema-validate').ValidateMode} */
    let mode = null;
    if (args[0] === '--ajv') {
        mode = 'ajv';
        args.splice(0, 1);
    }

    const schemaSource = fs.readFileSync(args[0], {encoding: 'utf8'});
    const schema = parseJson(schemaSource);

    for (const dataFileName of args.slice(1)) {
        const start = performance.now();
        try {
            console.log(`Validating ${dataFileName}...`);
            const dataSource = fs.readFileSync(dataFileName, {encoding: 'utf8'});
            const data = parseJson(dataSource);
            createJsonSchema(mode, schema).validate(data);
            const end = performance.now();
            console.log(`No issues detected (${((end - start) / 1000).toFixed(2)}s)`);
        } catch (e) {
            const end = performance.now();
            console.log(`Encountered an error (${((end - start) / 1000).toFixed(2)}s)`);
            console.warn(e);
        }
    }
}


main();

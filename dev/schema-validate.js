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

import Ajv from 'ajv';
import {readFileSync} from 'fs';
import {JsonSchema} from '../ext/js/data/json-schema.js';
import {DataError} from './data-error.js';
import {parseJson} from './json.js';

class JsonSchemaAjv {
    /**
     * @param {import('dev/schema-validate').Schema} schema
     */
    constructor(schema) {
        const ajv = new Ajv({
            meta: false,
            strictTuples: false,
            allowUnionTypes: true
        });
        const metaSchemaPath = require.resolve('ajv/dist/refs/json-schema-draft-07.json');
        /** @type {import('ajv').AnySchemaObject} */
        const metaSchema = parseJson(readFileSync(metaSchemaPath, {encoding: 'utf8'}));
        ajv.addMetaSchema(metaSchema);
        /** @type {import('ajv').ValidateFunction} */
        this._validate = ajv.compile(/** @type {import('ajv').Schema} */ (schema));
    }

    /**
     * @param {unknown} data
     * @throws {Error}
     */
    validate(data) {
        if (this._validate(data)) { return; }
        const {errors} = this._validate;
        const error = new DataError('Schema validation failed');
        error.data = parseJson(JSON.stringify(errors));
        throw error;
    }
}

/**
 * Creates a JSON Schema.
 * @param {import('dev/schema-validate').ValidateMode} mode
 * @param {import('dev/schema-validate').Schema} schema
 * @returns {JsonSchema|JsonSchemaAjv}
 */
export function createJsonSchema(mode, schema) {
    switch (mode) {
        case 'ajv': return new JsonSchemaAjv(schema);
        default: return new JsonSchema(/** @type {import('ext/json-schema').Schema} */ (schema));
    }
}

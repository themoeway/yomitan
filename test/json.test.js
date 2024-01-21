/*
 * Copyright (C) 2023-2024  Yomitan Authors
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
import {join, dirname as pathDirname} from 'path';
import {createGenerator} from 'ts-json-schema-generator';
import {fileURLToPath} from 'url';
import {describe, expect, test} from 'vitest';
import {parseJson} from '../dev/json.js';
import {getAllFiles} from '../dev/util.js';

const dirname = pathDirname(fileURLToPath(import.meta.url));
const rootDir = join(dirname, '..');

/**
 * @param {import('test/json').JsconfigType|undefined} jsconfigType
 * @returns {string}
 */
function getJsconfigPath(jsconfigType) {
    let path;
    switch (jsconfigType) {
        case 'dev': path = '../dev/jsconfig.json'; break;
        case 'test': path = '../test/jsconfig.json'; break;
        default: path = '../jsconfig.json'; break;
    }
    return join(dirname, path);
}

/**
 * @returns {Ajv}
 */
function createAjv() {
    return new Ajv({
        meta: true,
        strictTuples: false,
        allowUnionTypes: true
    });
}

/**
 * @param {string} path
 * @param {string} type
 * @param {import('test/json').JsconfigType|undefined} jsconfigType
 * @returns {import('ajv').ValidateFunction<unknown>}
 */
function createValidatorFunctionFromTypeScript(path, type, jsconfigType) {
    /** @type {import('ts-json-schema-generator/dist/src/Config').Config} */
    const config = {
        path,
        tsconfig: getJsconfigPath(jsconfigType),
        type,
        jsDoc: 'none',
        additionalProperties: false,
        minify: false,
        expose: 'none',
        strictTuples: true
    };
    const schema = createGenerator(config).createSchema(config.type);
    const ajv = createAjv();
    return ajv.compile(schema);
}

/**
 * @param {string} path
 * @returns {import('ajv').ValidateFunction<unknown>}
 */
function createValidatorFunctionFromSchemaJson(path) {
    /** @type {import('ajv').Schema} */
    const schema = parseJson(readFileSync(path, {encoding: 'utf8'}));
    const ajv = createAjv();
    return ajv.compile(schema);
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizePathDirectorySeparators(value) {
    return value.replace(/\\/g, '/');
}


describe.concurrent('JSON validation', () => {
    const ignoreDirectories = new Set([
        'builds',
        'dictionaries',
        'node_modules',
        'playwright-report',
        'playwright',
        'test-results',
        'dev/lib',
        'test/playwright'
    ]);

    const existingJsonFiles = getAllFiles(rootDir, (path, isDirectory) => {
        const fileNameNormalized = normalizePathDirectorySeparators(path);
        if (isDirectory) {
            return !ignoreDirectories.has(fileNameNormalized);
        } else {
            return /\.json$/i.test(fileNameNormalized);
        }
    });
    /** @type {Set<string>} */
    const existingJsonFileSet = new Set();
    for (const path of existingJsonFiles) {
        existingJsonFileSet.add(normalizePathDirectorySeparators(path));
    }

    const jsonFileName = 'json.json';

    /** @type {import('test/json').JsonInfo} */
    const jsonFileData = parseJson(readFileSync(join(dirname, `data/${jsonFileName}`), {encoding: 'utf8'}));

    test(`Each item in ${jsonFileName} must have a unique path`, () => {
        /** @type {Set<string>} */
        const set = new Set();
        for (const {path} of jsonFileData.files) {
            set.add(path);
        }
        expect(set.size).toBe(jsonFileData.files.length);
    });

    /** @type {Map<string, import('test/json').JsonFileInfo>} */
    const jsonFileMap = new Map();
    for (const item of jsonFileData.files) {
        jsonFileMap.set(item.path, item);
    }

    // Validate file existance
    const requiredFiles = jsonFileData.files.filter((v) => !v.ignore);
    test.each(requiredFiles)('File must exist in project: $path', ({path}) => {
        expect(existingJsonFileSet.has(path)).toBe(true);
    });

    // Validate new files
    const existingJsonFiles2 = existingJsonFiles.map((path) => ({path: normalizePathDirectorySeparators(path)}));
    test.each(existingJsonFiles2)(`File must exist in ${jsonFileName}: $path`, ({path}) => {
        expect(jsonFileMap.has(path)).toBe(true);
    });

    // Validate schemas 1
    /** @type {import('test/json').JsonFileParseInfo[]} */
    const schemaValidationTargets1 = [];
    for (const info of jsonFileData.files) {
        if (info.ignore || !existingJsonFileSet.has(info.path)) { continue; }
        schemaValidationTargets1.push(info);
    }
    test.each(schemaValidationTargets1)('Validating file against TypeScript: $path', ({path, typeFile, type, jsconfig}) => {
        const validate = createValidatorFunctionFromTypeScript(join(rootDir, typeFile), type, jsconfig);
        const data = parseJson(readFileSync(join(rootDir, path), {encoding: 'utf8'}));
        const valid = validate(data);
        const {errors} = validate;
        expect(errors).toBe(null);
        expect(valid).toBe(true);
    });

    // Validate schemas 2
    /** @type {{path: string, schema: string}[]} */
    const schemaValidationTargets2 = [];
    for (const info of jsonFileData.files) {
        if (info.ignore || !existingJsonFileSet.has(info.path)) { continue; }
        const {schema, path} = info;
        if (typeof schema !== 'string') { continue; }
        schemaValidationTargets2.push({schema, path});
    }
    test.each(schemaValidationTargets2)('Validating file against schema: $path', ({path, schema}) => {
        const validate = createValidatorFunctionFromSchemaJson(join(rootDir, schema));
        const data = parseJson(readFileSync(join(rootDir, path), {encoding: 'utf8'}));
        const valid = validate(data);
        const {errors} = validate;
        expect(errors).toBe(null);
        expect(valid).toBe(true);
    });
});

/*
 * Copyright (C) 2023  Yomitan Authors
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
import JSZip from 'jszip';
import path from 'path';
import {performance} from 'perf_hooks';
import {fileURLToPath} from 'url';
import {parseJson} from './json.js';
import {createJsonSchema} from './schema-validate.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} relativeFileName
 * @returns {import('dev/dictionary-validate').Schema}
 */
function readSchema(relativeFileName) {
    const fileName = path.join(dirname, relativeFileName);
    const source = fs.readFileSync(fileName, {encoding: 'utf8'});
    return parseJson(source);
}

/**
 * @param {import('dev/schema-validate').ValidateMode} mode
 * @param {import('jszip')} zip
 * @param {string} fileNameFormat
 * @param {import('dev/dictionary-validate').Schema} schema
 */
async function validateDictionaryBanks(mode, zip, fileNameFormat, schema) {
    let jsonSchema;
    try {
        jsonSchema = createJsonSchema(mode, schema);
    } catch (e) {
        const e2 = e instanceof Error ? e : new Error(`${e}`);
        e2.message += `\n(in file ${fileNameFormat})}`;
        throw e2;
    }
    let index = 1;
    while (true) {
        const fileName = fileNameFormat.replace(/\?/, `${index}`);

        const file = zip.files[fileName];
        if (!file) { break; }

        const data = parseJson(await file.async('string'));
        try {
            jsonSchema.validate(data);
        } catch (e) {
            const e2 = e instanceof Error ? e : new Error(`${e}`);
            e2.message += `\n(in file ${fileName})}`;
            throw e2;
        }

        ++index;
    }
}

/**
 * Validates a dictionary from its zip archive.
 * @param {import('dev/schema-validate').ValidateMode} mode
 * @param {import('jszip')} archive
 * @param {import('dev/dictionary-validate').Schemas} schemas
 */
export async function validateDictionary(mode, archive, schemas) {
    const indexFileName = 'index.json';
    const indexFile = archive.files[indexFileName];
    if (!indexFile) {
        throw new Error('No dictionary index found in archive');
    }

    /** @type {import('dictionary-data').Index} */
    const index = parseJson(await indexFile.async('string'));
    const version = index.format || index.version;

    try {
        const jsonSchema = createJsonSchema(mode, schemas.index);
        jsonSchema.validate(index);
    } catch (e) {
        const e2 = e instanceof Error ? e : new Error(`${e}`);
        e2.message += `\n(in file ${indexFileName})}`;
        throw e2;
    }

    await validateDictionaryBanks(mode, archive, 'term_bank_?.json', version === 1 ? schemas.termBankV1 : schemas.termBankV3);
    await validateDictionaryBanks(mode, archive, 'term_meta_bank_?.json', schemas.termMetaBankV3);
    await validateDictionaryBanks(mode, archive, 'kanji_bank_?.json', version === 1 ? schemas.kanjiBankV1 : schemas.kanjiBankV3);
    await validateDictionaryBanks(mode, archive, 'kanji_meta_bank_?.json', schemas.kanjiMetaBankV3);
    await validateDictionaryBanks(mode, archive, 'tag_bank_?.json', schemas.tagBankV3);
}

/**
 * Returns a Schemas object from ext/data/schemas/*.
 * @returns {import('dev/dictionary-validate').Schemas}
 */
export function getSchemas() {
    return {
        index: readSchema('../ext/data/schemas/dictionary-index-schema.json'),
        kanjiBankV1: readSchema('../ext/data/schemas/dictionary-kanji-bank-v1-schema.json'),
        kanjiBankV3: readSchema('../ext/data/schemas/dictionary-kanji-bank-v3-schema.json'),
        kanjiMetaBankV3: readSchema('../ext/data/schemas/dictionary-kanji-meta-bank-v3-schema.json'),
        tagBankV3: readSchema('../ext/data/schemas/dictionary-tag-bank-v3-schema.json'),
        termBankV1: readSchema('../ext/data/schemas/dictionary-term-bank-v1-schema.json'),
        termBankV3: readSchema('../ext/data/schemas/dictionary-term-bank-v3-schema.json'),
        termMetaBankV3: readSchema('../ext/data/schemas/dictionary-term-meta-bank-v3-schema.json')
    };
}

/**
 * Validates dictionary files and logs the results to the console.
 * @param {import('dev/schema-validate').ValidateMode} mode
 * @param {string[]} dictionaryFileNames
 */
export async function testDictionaryFiles(mode, dictionaryFileNames) {
    const schemas = getSchemas();

    for (const dictionaryFileName of dictionaryFileNames) {
        const start = performance.now();
        try {
            console.log(`Validating ${dictionaryFileName}...`);
            const source = fs.readFileSync(dictionaryFileName);
            const archive = await JSZip.loadAsync(source);
            await validateDictionary(mode, archive, schemas);
            const end = performance.now();
            console.log(`No issues detected (${((end - start) / 1000).toFixed(2)}s)`);
        } catch (e) {
            const end = performance.now();
            console.log(`Encountered an error (${((end - start) / 1000).toFixed(2)}s)`);
            console.warn(e);
        }
    }
}

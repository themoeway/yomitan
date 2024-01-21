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

import {IDBKeyRange, indexedDB} from 'fake-indexeddb';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'path';
import {expect, vi} from 'vitest';
import {parseJson} from '../../dev/json.js';
import {createDictionaryArchive} from '../../dev/util.js';
import {AnkiNoteDataCreator} from '../../ext/js/data/sandbox/anki-note-data-creator.js';
import {DictionaryDatabase} from '../../ext/js/dictionary/dictionary-database.js';
import {DictionaryImporter} from '../../ext/js/dictionary/dictionary-importer.js';
import {JapaneseUtil} from '../../ext/js/language/sandbox/japanese-util.js';
import {Translator} from '../../ext/js/language/translator.js';
import {chrome, fetch} from '../mocks/common.js';
import {DictionaryImporterMediaLoader} from '../mocks/dictionary-importer-media-loader.js';
import {createDomTest} from './dom-test.js';

const extDir = join(dirname(fileURLToPath(import.meta.url)), '../../ext');
const deinflectionReasonsPath = join(extDir, 'data/deinflect.json');

vi.stubGlobal('indexedDB', indexedDB);
vi.stubGlobal('IDBKeyRange', IDBKeyRange);
vi.stubGlobal('fetch', fetch);
vi.stubGlobal('chrome', chrome);

/**
 * @param {string} dictionaryDirectory
 * @param {string} dictionaryName
 * @returns {Promise<{translator: Translator, ankiNoteDataCreator: AnkiNoteDataCreator}>}
 */
async function createTranslatorContext(dictionaryDirectory, dictionaryName) {
    // Dictionary
    const testDictionary = createDictionaryArchive(dictionaryDirectory, dictionaryName);
    const testDictionaryContent = await testDictionary.generateAsync({type: 'arraybuffer'});

    // Setup database
    const dictionaryImporterMediaLoader = new DictionaryImporterMediaLoader();
    const dictionaryImporter = new DictionaryImporter(dictionaryImporterMediaLoader);
    const dictionaryDatabase = new DictionaryDatabase();
    await dictionaryDatabase.prepare();

    const {errors} = await dictionaryImporter.importDictionary(
        dictionaryDatabase,
        testDictionaryContent,
        {prefixWildcardsSupported: true}
    );

    expect(errors.length).toEqual(0);

    // Setup translator
    const japaneseUtil = new JapaneseUtil(null);
    const translator = new Translator({japaneseUtil, database: dictionaryDatabase});
    /** @type {import('deinflector').ReasonsRaw} */
    const deinflectionReasons = parseJson(readFileSync(deinflectionReasonsPath, {encoding: 'utf8'}));
    translator.prepare(deinflectionReasons);

    // Assign properties
    const ankiNoteDataCreator = new AnkiNoteDataCreator(japaneseUtil);
    return {translator, ankiNoteDataCreator};
}

/**
 * @param {string|undefined} htmlFilePath
 * @param {string} dictionaryDirectory
 * @param {string} dictionaryName
 * @returns {Promise<import('vitest').TestAPI<{window: import('jsdom').DOMWindow, translator: Translator, ankiNoteDataCreator: AnkiNoteDataCreator}>>}
 */
export async function createTranslatorTest(htmlFilePath, dictionaryDirectory, dictionaryName) {
    const test = createDomTest(htmlFilePath);
    const {translator, ankiNoteDataCreator} = await createTranslatorContext(dictionaryDirectory, dictionaryName);
    /** @type {import('vitest').TestAPI<{window: import('jsdom').DOMWindow, translator: Translator, ankiNoteDataCreator: AnkiNoteDataCreator}>} */
    const result = test.extend({
        window: async ({window}, use) => { await use(window); },
        // eslint-disable-next-line no-empty-pattern
        translator: async ({}, use) => { await use(translator); },
        ankiNoteDataCreator: async ({window}, use) => {
            // The window property needs to be referenced for it to be initialized.
            // It is needed for DOM access for structured content.
            void window;
            await use(ankiNoteDataCreator);
        }
    });
    return result;
}

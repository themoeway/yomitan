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

import {IDBFactory, IDBKeyRange} from 'fake-indexeddb';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join, dirname as pathDirname} from 'path';
import {beforeEach, describe, test, vi} from 'vitest';
import {parseJson} from '../dev/json.js';
import {createDictionaryArchive} from '../dev/util.js';
import {DictionaryDatabase} from '../ext/js/dictionary/dictionary-database.js';
import {DictionaryImporter} from '../ext/js/dictionary/dictionary-importer.js';
import {DictionaryImporterMediaLoader} from './mocks/dictionary-importer-media-loader.js';

const dirname = pathDirname(fileURLToPath(import.meta.url));

vi.stubGlobal('IDBKeyRange', IDBKeyRange);

/**
 * @param {string} dictionary
 * @param {string} [dictionaryName]
 * @returns {import('jszip')}
 */
function createTestDictionaryArchive(dictionary, dictionaryName) {
    const dictionaryDirectory = join(dirname, 'data', 'dictionaries', dictionary);
    return createDictionaryArchive(dictionaryDirectory, dictionaryName);
}

/**
 * @param {import('vitest').ExpectStatic} expect
 * @param {import('dictionary-importer').OnProgressCallback} [onProgress]
 * @returns {DictionaryImporter}
 */
function createDictionaryImporter(expect, onProgress) {
    const dictionaryImporterMediaLoader = new DictionaryImporterMediaLoader();
    return new DictionaryImporter(dictionaryImporterMediaLoader, (...args) => {
        const {stepIndex, stepCount, index, count} = args[0];
        expect.soft(stepIndex < stepCount).toBe(true);
        expect.soft(index <= count).toBe(true);
        if (typeof onProgress === 'function') {
            onProgress(...args);
        }
    });
}

/**
 * @param {import('dictionary-database').TermEntry[]} dictionaryDatabaseEntries
 * @param {string} term
 * @returns {number}
 */
function countDictionaryDatabaseEntriesWithTerm(dictionaryDatabaseEntries, term) {
    return dictionaryDatabaseEntries.reduce((i, v) => (i + (v.term === term ? 1 : 0)), 0);
}

/**
 * @param {import('dictionary-database').TermEntry[]} dictionaryDatabaseEntries
 * @param {string} reading
 * @returns {number}
 */
function countDictionaryDatabaseEntriesWithReading(dictionaryDatabaseEntries, reading) {
    return dictionaryDatabaseEntries.reduce((i, v) => (i + (v.reading === reading ? 1 : 0)), 0);
}

/**
 * @param {import('dictionary-database').TermMeta[]|import('dictionary-database').KanjiMeta[]} metas
 * @param {import('dictionary-database').TermMetaType|import('dictionary-database').KanjiMetaType} mode
 * @returns {number}
 */
function countMetasWithMode(metas, mode) {
    let i = 0;
    for (const item of metas) {
        if (item.mode === mode) { ++i; }
    }
    return i;
}

/**
 * @param {import('dictionary-database').KanjiEntry[]} kanji
 * @param {string} character
 * @returns {number}
 */
function countKanjiWithCharacter(kanji, character) {
    let i = 0;
    for (const item of kanji) {
        if (item.character === character) { ++i; }
    }
    return i;
}


/** */
describe('Database', () => {
    beforeEach(async () => {
        globalThis.indexedDB = new IDBFactory();
    });
    test('Database invalid usage', async ({expect}) => {
        // Load dictionary data
        const testDictionary = createTestDictionaryArchive('valid-dictionary1');
        const testDictionarySource = await testDictionary.generateAsync({type: 'arraybuffer'});
        /** @type {import('dictionary-data').Index} */
        const testDictionaryIndex = parseJson(await testDictionary.files['index.json'].async('string'));

        const title = testDictionaryIndex.title;
        const titles = new Map([
            [title, {priority: 0, allowSecondarySearches: false}]
        ]);

        // Setup database
        const dictionaryDatabase = new DictionaryDatabase();
        /** @type {import('dictionary-importer').ImportDetails} */
        const detaultImportDetails = {prefixWildcardsSupported: false};

        // Database not open
        await expect.soft(dictionaryDatabase.deleteDictionary(title, 1000, () => {})).rejects.toThrow('Database not open');
        await expect.soft(dictionaryDatabase.findTermsBulk(['?'], titles, 'exact')).rejects.toThrow('Database not open');
        await expect.soft(dictionaryDatabase.findTermsExactBulk([{term: '?', reading: '?'}], titles)).rejects.toThrow('Database not open');
        await expect.soft(dictionaryDatabase.findTermsBySequenceBulk([{query: 1, dictionary: title}])).rejects.toThrow('Database not open');
        await expect.soft(dictionaryDatabase.findTermMetaBulk(['?'], titles)).rejects.toThrow('Database not open');
        await expect.soft(dictionaryDatabase.findTermMetaBulk(['?'], titles)).rejects.toThrow('Database not open');
        await expect.soft(dictionaryDatabase.findKanjiBulk(['?'], titles)).rejects.toThrow('Database not open');
        await expect.soft(dictionaryDatabase.findKanjiMetaBulk(['?'], titles)).rejects.toThrow('Database not open');
        await expect.soft(dictionaryDatabase.findTagForTitle('tag', title)).rejects.toThrow('Database not open');
        await expect.soft(dictionaryDatabase.getDictionaryInfo()).rejects.toThrow('Database not open');
        await expect.soft(dictionaryDatabase.getDictionaryCounts([...titles.keys()], true)).rejects.toThrow('Database not open');
        await expect.soft(createDictionaryImporter(expect).importDictionary(dictionaryDatabase, testDictionarySource, detaultImportDetails)).rejects.toThrow('Database is not ready');

        await dictionaryDatabase.prepare();

        // Already prepared
        await expect.soft(dictionaryDatabase.prepare()).rejects.toThrow('Database already open');

        await createDictionaryImporter(expect).importDictionary(dictionaryDatabase, testDictionarySource, detaultImportDetails);

        // Dictionary already imported
        await expect.soft(createDictionaryImporter(expect).importDictionary(dictionaryDatabase, testDictionarySource, detaultImportDetails)).rejects.toThrow('Dictionary is already imported');

        await dictionaryDatabase.close();
    });
    describe('Invalid dictionaries', () => {
        const invalidDictionaries = [
            {name: 'invalid-dictionary1'},
            {name: 'invalid-dictionary2'},
            {name: 'invalid-dictionary3'},
            {name: 'invalid-dictionary4'},
            {name: 'invalid-dictionary5'},
            {name: 'invalid-dictionary6'}
        ];
        describe.each(invalidDictionaries)('Invalid dictionary: $name', ({name}) => {
            test('Has invalid data', async ({expect}) => {
                const dictionaryDatabase = new DictionaryDatabase();
                await dictionaryDatabase.prepare();

                const testDictionary = createTestDictionaryArchive(name);
                const testDictionarySource = await testDictionary.generateAsync({type: 'arraybuffer'});

                /** @type {import('dictionary-importer').ImportDetails} */
                const detaultImportDetails = {prefixWildcardsSupported: false};
                await expect.soft(createDictionaryImporter(expect).importDictionary(dictionaryDatabase, testDictionarySource, detaultImportDetails)).rejects.toThrow('Dictionary has invalid data');
                await dictionaryDatabase.close();
            });
        });
    });
    describe('Database valid usage', () => {
        const testDataFilePath = join(dirname, 'data/database-test-cases.json');
        /** @type {import('test/database').DatabaseTestData} */
        const testData = parseJson(readFileSync(testDataFilePath, {encoding: 'utf8'}));
        test('Import data and test', async ({expect}) => {
            const fakeImportDate = testData.expectedSummary.importDate;

            // Load dictionary data
            const testDictionary = createTestDictionaryArchive('valid-dictionary1');
            const testDictionarySource = await testDictionary.generateAsync({type: 'arraybuffer'});
            /** @type {import('dictionary-data').Index} */
            const testDictionaryIndex = parseJson(await testDictionary.files['index.json'].async('string'));

            const title = testDictionaryIndex.title;
            const titles = new Map([
                [title, {priority: 0, allowSecondarySearches: false}]
            ]);

            // Setup database
            const dictionaryDatabase = new DictionaryDatabase();
            await dictionaryDatabase.prepare();

            // Import data
            let progressEvent1 = false;
            const dictionaryImporter = createDictionaryImporter(expect, () => { progressEvent1 = true; });
            const {result: importDictionaryResult, errors: importDictionaryErrors} = await dictionaryImporter.importDictionary(
                dictionaryDatabase,
                testDictionarySource,
                {prefixWildcardsSupported: true}
            );
            importDictionaryResult.importDate = fakeImportDate;
            expect.soft(importDictionaryErrors).toStrictEqual([]);
            expect.soft(importDictionaryResult).toStrictEqual(testData.expectedSummary);
            expect.soft(progressEvent1).toBe(true);

            // Get info summary
            const info = await dictionaryDatabase.getDictionaryInfo();
            for (const item of info) { item.importDate = fakeImportDate; }
            expect.soft(info).toStrictEqual([testData.expectedSummary]);

            // Get counts
            const counts = await dictionaryDatabase.getDictionaryCounts(info.map((v) => v.title), true);
            expect.soft(counts).toStrictEqual(testData.expectedCounts);

            // Test findTermsBulk
            for (const {inputs, expectedResults} of testData.tests.findTermsBulk) {
                for (const {termList, matchType} of inputs) {
                    const results = await dictionaryDatabase.findTermsBulk(termList, titles, matchType);
                    expect.soft(results.length).toStrictEqual(expectedResults.total);
                    for (const [term, count] of expectedResults.terms) {
                        expect.soft(countDictionaryDatabaseEntriesWithTerm(results, term)).toStrictEqual(count);
                    }
                    for (const [reading, count] of expectedResults.readings) {
                        expect.soft(countDictionaryDatabaseEntriesWithReading(results, reading)).toStrictEqual(count);
                    }
                }
            }

            // Test findTermsExactBulk
            for (const {inputs, expectedResults} of testData.tests.findTermsExactBulk) {
                for (const {termList} of inputs) {
                    const results = await dictionaryDatabase.findTermsExactBulk(termList, titles);
                    expect.soft(results.length).toStrictEqual(expectedResults.total);
                    for (const [term, count] of expectedResults.terms) {
                        expect.soft(countDictionaryDatabaseEntriesWithTerm(results, term)).toStrictEqual(count);
                    }
                    for (const [reading, count] of expectedResults.readings) {
                        expect.soft(countDictionaryDatabaseEntriesWithReading(results, reading)).toStrictEqual(count);
                    }
                }
            }

            // Test findTermsBySequenceBulk
            for (const {inputs, expectedResults} of testData.tests.findTermsBySequenceBulk) {
                for (const {sequenceList} of inputs) {
                    const results = await dictionaryDatabase.findTermsBySequenceBulk(sequenceList.map((query) => ({query, dictionary: title})));
                    expect.soft(results.length).toStrictEqual(expectedResults.total);
                    for (const [term, count] of expectedResults.terms) {
                        expect.soft(countDictionaryDatabaseEntriesWithTerm(results, term)).toStrictEqual(count);
                    }
                    for (const [reading, count] of expectedResults.readings) {
                        expect.soft(countDictionaryDatabaseEntriesWithReading(results, reading)).toStrictEqual(count);
                    }
                }
            }

            // Test findTermMetaBulk
            for (const {inputs, expectedResults} of testData.tests.findTermMetaBulk) {
                for (const {termList} of inputs) {
                    const results = await dictionaryDatabase.findTermMetaBulk(termList, titles);
                    expect.soft(results.length).toStrictEqual(expectedResults.total);
                    for (const [mode, count] of expectedResults.modes) {
                        expect.soft(countMetasWithMode(results, mode)).toStrictEqual(count);
                    }
                }
            }

            // Test findKanjiBulk
            for (const {inputs, expectedResults} of testData.tests.findKanjiBulk) {
                for (const {kanjiList} of inputs) {
                    const results = await dictionaryDatabase.findKanjiBulk(kanjiList, titles);
                    expect.soft(results.length).toStrictEqual(expectedResults.total);
                    for (const [kanji, count] of expectedResults.kanji) {
                        expect.soft(countKanjiWithCharacter(results, kanji)).toStrictEqual(count);
                    }
                }
            }

            // Test findKanjiBulk
            for (const {inputs, expectedResults} of testData.tests.findKanjiMetaBulk) {
                for (const {kanjiList} of inputs) {
                    const results = await dictionaryDatabase.findKanjiMetaBulk(kanjiList, titles);
                    expect.soft(results.length).toStrictEqual(expectedResults.total);
                    for (const [mode, count] of expectedResults.modes) {
                        expect.soft(countMetasWithMode(results, mode)).toStrictEqual(count);
                    }
                }
            }

            // Test findTagForTitle
            for (const {inputs, expectedResults} of testData.tests.findTagForTitle) {
                for (const {name} of inputs) {
                    const result = await dictionaryDatabase.findTagForTitle(name, title);
                    expect.soft(result).toStrictEqual(expectedResults.value);
                }
            }

            // Close
            await dictionaryDatabase.close();
        });
    });
    describe('Database cleanup', () => {
        /** @type {{clearMethod: 'purge'|'delete'}[]} */
        const cleanupTestCases = [
            {clearMethod: 'purge'},
            {clearMethod: 'delete'}
        ];
        describe.each(cleanupTestCases)('Testing cleanup method $clearMethod', ({clearMethod}) => {
            test('Import data and test', async ({expect}) => {
                // Load dictionary data
                const testDictionary = createTestDictionaryArchive('valid-dictionary1');
                const testDictionarySource = await testDictionary.generateAsync({type: 'arraybuffer'});
                /** @type {import('dictionary-data').Index} */
                const testDictionaryIndex = parseJson(await testDictionary.files['index.json'].async('string'));

                // Setup database
                const dictionaryDatabase = new DictionaryDatabase();
                await dictionaryDatabase.prepare();

                // Import data
                const dictionaryImporter = createDictionaryImporter(expect);
                await dictionaryImporter.importDictionary(dictionaryDatabase, testDictionarySource, {prefixWildcardsSupported: true});

                // Clear
                switch (clearMethod) {
                    case 'purge':
                        await dictionaryDatabase.purge();
                        break;
                    case 'delete':
                        {
                            let progressEvent2 = false;
                            await dictionaryDatabase.deleteDictionary(
                                testDictionaryIndex.title,
                                1000,
                                () => { progressEvent2 = true; }
                            );
                            expect(progressEvent2).toBe(true);
                        }
                        break;
                }

                // Test empty
                const info = await dictionaryDatabase.getDictionaryInfo();
                expect.soft(info).toStrictEqual([]);

                const counts = await dictionaryDatabase.getDictionaryCounts([], true);
                /** @type {import('dictionary-database').DictionaryCounts} */
                const countsExpected = {
                    counts: [],
                    total: {kanji: 0, kanjiMeta: 0, terms: 0, termMeta: 0, tagMeta: 0, media: 0}
                };
                expect.soft(counts).toStrictEqual(countsExpected);

                // Close
                await dictionaryDatabase.close();
            });
        });
    });
});

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

import {readFileSync, writeFileSync} from 'fs';
import {fileURLToPath} from 'node:url';
import path from 'path';
import {parseJson} from '../dev/json.js';
import {createTranslatorTest} from './fixtures/translator-test.js';
import {createTestAnkiNoteData, getTemplateRenderResults} from './utilities/anki.js';
import {createFindOptions} from './utilities/translator.js';

/**
 * @param {string} fileName
 * @param {unknown} content
 */
function writeJson(fileName, content) {
    writeFileSync(fileName, JSON.stringify(content, null, 2));
}

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dictionaryName = 'Test Dictionary 2';
const test = await createTranslatorTest(void 0, path.join(dirname, 'data/dictionaries/valid-dictionary1'), dictionaryName);

test('Write dictionary data expected data', async ({translator, ankiNoteDataCreator, expect}) => {
    const testInputsFilePath = path.join(dirname, 'data/translator-test-inputs.json');
    /** @type {import('test/translator').TranslatorTestInputs} */
    const {optionsPresets, tests} = parseJson(readFileSync(testInputsFilePath, {encoding: 'utf8'}));

    const testResults1FilePath = path.join(dirname, 'data/translator-test-results.json');
    const testResults2FilePath = path.join(dirname, 'data/translator-test-results-note-data1.json');
    const testResults3FilePath = path.join(dirname, 'data/anki-note-builder-test-results.json');

    /** @type {import('test/translator').TranslatorTestResults} */
    const actualResults1 = [];
    /** @type {import('test/translator').TranslatorTestNoteDataResults} */
    const actualResults2 = [];
    /** @type {import('test/translator').AnkiNoteBuilderTestResults} */
    const actualResults3 = [];

    const template = readFileSync(path.join(dirname, '../ext/data/templates/default-anki-field-templates.handlebars'), {encoding: 'utf8'});

    for (const data of tests) {
        const {name} = data;
        switch (data.func) {
            case 'findTerms':
                {
                    const {mode, text} = data;
                    /** @type {import('translation').FindTermsOptions} */
                    const options = createFindOptions(dictionaryName, optionsPresets, data.options);
                    const {dictionaryEntries, originalTextLength} = await translator.findTerms(mode, text, options);
                    const renderResults = mode !== 'simple' ? await getTemplateRenderResults(dictionaryEntries, 'terms', mode, template, null) : null;
                    const noteDataList = mode !== 'simple' ? dictionaryEntries.map((dictionaryEntry) => createTestAnkiNoteData(ankiNoteDataCreator, dictionaryEntry, mode)) : null;
                    actualResults1.push({name, originalTextLength, dictionaryEntries});
                    actualResults2.push({name, noteDataList});
                    actualResults3.push({name, results: renderResults});
                }
                break;
            case 'findKanji':
                {
                    const {text} = data;
                    /** @type {import('translation').FindKanjiOptions} */
                    const options = createFindOptions(dictionaryName, optionsPresets, data.options);
                    const dictionaryEntries = await translator.findKanji(text, options);
                    const renderResults = await getTemplateRenderResults(dictionaryEntries, 'kanji', 'split', template, null);
                    const noteDataList = dictionaryEntries.map((dictionaryEntry) => createTestAnkiNoteData(ankiNoteDataCreator, dictionaryEntry, 'split'));
                    actualResults1.push({name, dictionaryEntries});
                    actualResults2.push({name, noteDataList});
                    actualResults3.push({name, results: renderResults});
                }
                break;
        }
    }

    expect(() => writeJson(testResults1FilePath, actualResults1)).not.toThrow();
    expect(() => writeJson(testResults2FilePath, actualResults2)).not.toThrow();
    expect(() => writeJson(testResults3FilePath, actualResults3)).not.toThrow();
});

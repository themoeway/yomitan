/*
 * Copyright (C) 2023-2026  Yomitan Authors
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

import {readFileSync} from 'fs';
import {fileURLToPath} from 'node:url';
import path from 'path';
import {bench, describe} from 'vitest';
import {parseJson} from '../dev/json.js';
import {createTranslatorContext} from '../test/fixtures/translator-test.js';
import {setupStubs} from '../test/utilities/database.js';
import {createFindKanjiOptions, createFindTermsOptions} from '../test/utilities/translator.js';

setupStubs();

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dictionaryName = 'Test Dictionary 2';
const {translator} = await createTranslatorContext(path.join(dirname, '..', 'test', 'data/dictionaries/valid-dictionary1'), dictionaryName);

describe('Translator', () => {
    const testInputsFilePath = path.join(dirname, '..', 'test', 'data/translator-test-inputs.json');
    /** @type {import('test/translator').TranslatorTestInputs} */
    const {optionsPresets, tests} = parseJson(readFileSync(testInputsFilePath, {encoding: 'utf8'}));

    const findKanjiTests = tests.filter((data) => data.options === 'kanji');
    const findTermTests = tests.filter((data) => data.options !== 'kanji');

    bench(`Translator.prototype.findTerms - (n=${findTermTests.length})`, async () => {
        for (const data of /** @type {import('test/translator').TestInputFindTerm[]} */ (findTermTests)) {
            const {mode, text} = data;
            const options = createFindTermsOptions(dictionaryName, optionsPresets, data.options);
            await translator.findTerms(mode, text, options);
        }
    });

    bench(`Translator.prototype.findTerms - grammar wildcards enabled, no patterns (n=${findTermTests.length})`, async () => {
        for (const data of /** @type {import('test/translator').TestInputFindTerm[]} */ (findTermTests)) {
            const options = createFindTermsOptions(dictionaryName, optionsPresets, data.options);
            options.enableGrammarWildcards = true;
            await translator.findTerms(data.mode, data.text, options);
        }
    });

    bench(`Translator.prototype.findKanji - (n=${findKanjiTests.length})`, async () => {
        for (const data of /** @type {import('test/translator').TestInputFindKanji[]} */ (findKanjiTests)) {
            const {text} = data;
            const options = createFindKanjiOptions(dictionaryName, optionsPresets, data.options);
            await translator.findKanji(text, options);
        }
    });
});


const grammarDictionaryName = 'Grammar Wildcards';
const {translator: grammarTranslator} = await createTranslatorContext(path.join(dirname, '..', 'test/data/dictionaries/grammar-wildcards'), grammarDictionaryName);
const grammarOptions = createFindTermsOptions(grammarDictionaryName, {}, [{type: 'terms'}]);
grammarOptions.enabledDictionaryMap.set(grammarDictionaryName, {
    index: 0,
    alias: grammarDictionaryName,
    allowSecondarySearches: false,
    partsOfSpeechFilter: true,
    useDeinflections: true,
});
const grammarInputs = ['いくら騒いでも', 'どんなに走っても間に合わない', '長い接頭辞の文法の例終わり', '前𠮷後', 'しか野菜を食べた', '前あ中い後', '何も見つからない'];
for (const enabled of [false, true]) {
    bench(`Translator.prototype.findTerms - grammar dictionary, enabled=${enabled} (n=${grammarInputs.length})`, async () => {
        for (const text of grammarInputs) {
            await grammarTranslator.findTerms('group', text, {...grammarOptions, enableGrammarWildcards: enabled});
        }
    });
}

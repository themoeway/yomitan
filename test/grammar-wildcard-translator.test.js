/*
 * Copyright (C) 2026  Yomitan Authors
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

import path from 'path';
import {afterAll, describe, expect, test, vi} from 'vitest';
import {DictionaryDatabase} from '../ext/js/dictionary/dictionary-database.js';
import {createTranslatorContext} from './fixtures/translator-test.js';
import {setupStubs} from './utilities/database.js';
import {createFindTermsOptions} from './utilities/translator.js';

setupStubs();
const dictionaryName = 'Grammar Wildcards';
const {translator} = await createTranslatorContext(path.resolve('test/data/dictionaries/grammar-wildcards'), dictionaryName);
const {translator: secondTranslator} = await createTranslatorContext(path.resolve('test/data/dictionaries/grammar-wildcards'), 'Second Grammar Dictionary');
const findTermsBulk = vi.spyOn(DictionaryDatabase.prototype, 'findTermsBulk');
afterAll(() => findTermsBulk.mockRestore());

/**
 * @param {Partial<import('translation').FindTermsOptions>} [overrides]
 * @returns {import('translation').FindTermsOptions}
 */
function options(overrides = {}) {
    const result = createFindTermsOptions(dictionaryName, {}, [{type: 'terms'}]);
    result.enabledDictionaryMap.set(dictionaryName, {
        index: 0, alias: dictionaryName, allowSecondarySearches: false, partsOfSpeechFilter: true, useDeinflections: true,
    });
    return {...result, enableGrammarWildcards: true, ...overrides};
}

/**
 * @param {import('translator').FindTermsResult} result
 * @returns {string[]}
 */
function terms(result) {
    return result.dictionaryEntries.flatMap(({headwords}) => headwords.map(({term}) => term));
}

describe('grammar wildcard dictionary lookup', () => {
    test.each(['simple', 'split', 'group', 'merge', 'term'])('matches and preserves source length in %s mode', async (mode) => {
        const result = await translator.findTerms(/** @type {import('translator').FindTermsMode} */ (mode), 'いくら騒いでも余分', options());
        expect(terms(result)).toEqual(expect.arrayContaining(['いくら～でも', '幾ら～でも', 'いくら騒いでも']));
        expect(result.originalTextLength).toBe('いくら騒いでも'.length);
        const entry = result.dictionaryEntries.find(({headwords}) => headwords.some(({term}) => term === 'いくら～でも'));
        expect(entry?.headwords[0].sources[0]).toMatchObject({originalText: 'いくら騒いでも', deinflectedText: 'いくら～でも', matchSource: 'term'});
        expect(terms(result).filter((term) => term === 'いくら～でも')).toHaveLength(1);
    });

    test.each([
        ['どんなに走っても間に合わない', 'どんなに～ても～ない'],
        ['長い接頭辞の文法の例終わり', '長い接頭辞の文法～終わり'],
        ['前𠮷後', '前～後'],
        ['前あ中い後', '前～中～後'],
        ['しか野菜を食べた', 'しか～食べる'],
    ])('finds %s through %s', async (text, pattern) => {
        expect(terms(await translator.findTerms('simple', text, options()))).toContain(pattern);
    });

    test.each([
        {
            // No matter how many hours I read difficult books after work, I cannot remember the content right away.
            matchedText: 'いくら毎晩仕事が終わってから図書館で難しい専門書を何時間も読んでも',
            continuation: '、内容をすぐには覚えられない。',
            pattern: 'いくら～でも',
        },
        {
            // No matter how carefully I explain my study plans and dreams to my parents and ask, they will not give permission.
            matchedText: 'いくら両親に留学先で学びたいことや将来の夢を詳しく説明して頼んでも',
            continuation: '、許可してもらえなかった。',
            pattern: 'いくら～でも',
        },
        {
            // Even after reading the entire textbook repeatedly and looking up every unfamiliar word, I forget it by morning.
            matchedText: 'いくら仕事から帰って夕食の片付けを済ませた後で机に向かい分からない言葉を一つずつ辞書で調べながら先生に勧められた分厚い参考書を最初のページから最後のページまで繰り返し読んでも',
            continuation: '、翌朝になると大事な内容を忘れてしまう。',
            pattern: 'いくら～でも',
        },
        {
            // Even when I get up early and run to the station, the long wait at the crossing makes me miss the first train.
            matchedText: 'どんなに毎朝早く起きて駅まで続く長い坂道を全力で走っても途中の踏切で長く待たされるので始発電車には間に合わない',
            continuation: '。',
            pattern: 'どんなに～ても～ない',
        },
    ])('matches long phrases in $matchedText', async ({matchedText, continuation, pattern}) => {
        const text = matchedText + continuation;
        const result = await translator.findTerms('simple', text, options());
        const matches = result.dictionaryEntries.filter(({headwords}) => headwords.some(({term}) => term === pattern));
        expect(matches).toHaveLength(1);
        expect(matches[0].headwords[0].sources[0]).toMatchObject({originalText: matchedText, deinflectedText: pattern});
        expect(result.originalTextLength).toBe(matchedText.length);
        expect(terms(await translator.findTerms('simple', text, options({enableGrammarWildcards: false})))).not.toContain(pattern);
        // A long gap must not turn a missing closing literal into a match.
        expect(terms(await translator.findTerms('simple', matchedText.slice(0, -1), options({deinflect: false})))).not.toContain(pattern);
    });

    test('uses normalized text and maps replacement length back to the scan', async () => {
        const result = await translator.findTerms('simple', 'X騒いでも', options({
            textReplacements: [[{pattern: /X/g, replacement: 'いくら'}]],
        }));
        expect(terms(result)).toContain('いくら～でも');
        expect(result.originalTextLength).toBe('X騒いでも'.length);
    });

    test('keeps the disabled database path and results unchanged', async () => {
        findTermsBulk.mockClear();
        const literal = await translator.findTerms('simple', 'いくら騒いでも', options({enableGrammarWildcards: void 0}));
        const calls = structuredClone(findTermsBulk.mock.calls);
        findTermsBulk.mockClear();
        const disabled = await translator.findTerms('simple', 'いくら騒いでも', options({enableGrammarWildcards: false}));
        expect(disabled).toEqual(literal);
        expect(findTermsBulk.mock.calls).toEqual(calls);
        expect(findTermsBulk.mock.calls.every((call) => call[2] === 'exact')).toBe(true);
        expect(terms(disabled)).toEqual(['いくら騒いでも']);
    });

    test('performs one extra bulk lookup only for stored pattern prefixes', async () => {
        findTermsBulk.mockClear();
        await translator.findTerms('simple', 'いくら騒いでも', options());
        const calls = findTermsBulk.mock.calls.filter((call) => call[2] === 'prefix');
        expect(calls).toHaveLength(1);
        expect(calls[0][0].every((prefix) => prefix.endsWith('～'))).toBe(true);
        expect(new Set(calls[0][0]).size).toBe(calls[0][0].length);
    });

    test('applies to all enabled dictionaries and respects disabled dictionaries', async () => {
        const opts = options();
        opts.enabledDictionaryMap.set('Second Grammar Dictionary', {...opts.enabledDictionaryMap.get(dictionaryName), index: 1, alias: 'Second Grammar Dictionary', allowSecondarySearches: false, partsOfSpeechFilter: true, useDeinflections: true});
        const result = await secondTranslator.findTerms('group', 'いくら騒いでも', opts);
        const definitions = result.dictionaryEntries.flatMap((entry) => entry.definitions);
        expect(new Set(definitions.map((definition) => definition.dictionary))).toEqual(new Set([dictionaryName, 'Second Grammar Dictionary']));
        opts.enabledDictionaryMap.delete(dictionaryName);
        const filtered = await translator.findTerms('group', 'いくら騒いでも', opts);
        expect(filtered.dictionaryEntries.flatMap((entry) => entry.definitions).every((definition) => definition.dictionary === 'Second Grammar Dictionary')).toBe(true);
    });

    test('does not activate for another language or explicit prefix/suffix searches', async () => {
        for (const overrides of [{language: 'en'}, {matchType: 'prefix'}, {matchType: 'suffix'}]) {
            const opts = options(/** @type {Partial<import('translation').FindTermsOptions>} */ (overrides));
            const enabled = await translator.findTerms('simple', 'いくら騒いでも', opts);
            const disabled = await translator.findTerms('simple', 'いくら騒いでも', {...opts, enableGrammarWildcards: false});
            expect(enabled).toEqual(disabled);
        }
    });

    test('supports literal wildcard queries even when disabled', async () => {
        expect(terms(await translator.findTerms('simple', 'いくら～でも', options({enableGrammarWildcards: false})))).toContain('いくら～でも');
    });

    test('requires a nonempty gap and does not interpret other markers', async () => {
        expect(terms(await translator.findTerms('simple', 'いくらでも', options()))).not.toContain('いくら～でも');
        const result = terms(await translator.findTerms('simple', '前あ後', options()));
        expect(result).toEqual(['前～後']);
    });

    test('does no pattern lookup for an empty dictionary selection or short input', async () => {
        for (const [text, opts] of [['前', options()], ['前あ後', options({enabledDictionaryMap: new Map()})]]) {
            findTermsBulk.mockClear();
            await translator.findTerms('simple', /** @type {string} */ (text), /** @type {import('translation').FindTermsOptions} */ (opts));
            expect(findTermsBulk.mock.calls.some((call) => call[2] === 'prefix')).toBe(false);
        }
    });

    test('sees dictionary deletion and reimport without a pattern cache or reindex', async () => {
        const name = 'Reloaded Grammar Dictionary';
        await createTranslatorContext(path.resolve('test/data/dictionaries/grammar-wildcards'), name);
        const opts = options();
        const dictionaryOptions = opts.enabledDictionaryMap.get(dictionaryName);
        opts.enabledDictionaryMap = new Map([[name, /** @type {import('translation').FindTermDictionary} */ (dictionaryOptions)]]);
        expect(terms(await translator.findTerms('simple', 'いくら騒いでも', opts))).toContain('いくら～でも');
        const database = new DictionaryDatabase();
        await database.prepare();
        try {
            await database.deleteDictionary(name, 100, () => {});
            expect(terms(await translator.findTerms('simple', 'いくら騒いでも', opts))).toEqual([]);
            await createTranslatorContext(path.resolve('test/data/dictionaries/grammar-wildcards'), name);
            expect(terms(await translator.findTerms('simple', 'いくら騒いでも', opts))).toContain('いくら～でも');
        } finally {
            await database.close();
        }
    });

    test('keeps full-query behavior when deinflection is disabled', async () => {
        expect(terms(await translator.findTerms('simple', 'いくら騒いでも余分', options({deinflect: false})))).not.toContain('いくら～でも');
        expect(terms(await translator.findTerms('simple', 'いくら騒いでも', options({deinflect: false})))).toContain('いくら～でも');
    });
});

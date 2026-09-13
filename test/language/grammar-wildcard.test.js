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

import {describe, expect, test} from 'vitest';
import {getGrammarWildcardBoundaryPositions, matchesGrammarWildcard} from '../../ext/js/language/grammar-wildcard.js';

describe('dictionary grammar wildcard matching', () => {
    test.each([
        ['いくら騒いでも', 'いくら～でも', true],
        ['いくらでも', 'いくら～でも', false],
        ['前𠮷後', '前～後', true],
        ['𠮷あ後', '𠮷～後', true],
        ['前𠮷', '前～𠮷', false],
        ['前あ中い後', '前～中～後', true],
        ['前あ中い中後', '前～中～後', true],
        ['前中い後', '前～中～後', false],
        ['前あ中後', '前～中～後', false],
        ['前あ中い違う', '前～中～後', false],
        ['前あ後余分', '前～後', false],
        ['余分前あ後', '前～後', false],
        ['前あ後', '前〜後', false],
        ['前あ後', '前~後', false],
        ['前あ後', '～後', false],
        ['前あ後', '前～', false],
        ['前あ後', '前～～後', false],
        ['', '～', false],
        ['[a]x(b).*', '[a]～(b).*', true],
        ['費用が高い。準備にも時間がかかる', '費用が～かかる', false],
        ['決して「無理だ。諦めろ」とは言わない', '決して～ない', true],
        ['決して「『無理だ。』と言え」とは言わない', '決して～ない', true],
        ['決して「無理だ。諦めろとは言わない', '決して～ない', false],
        ['決して「無理だ。』とは言わない', '決して～ない', false],
        ['決して「無理だ。『諦めろ』とは言わない', '決して～ない', false],
        ['決して「無理だ。」と言った。彼は話さない', '決して～ない', false],
        ['費用が高い」と聞いた。「時間もかかる', '費用が～かかる', false],
        ['決して「無理だ。\n諦めろ」とは言わない', '決して～ない', false],
        ['費用が予想より高く、準備にも時間がかかる', '費用が～かかる', true],
        ['費用が予想の1.5倍かかる', '費用が～かかる', true],
        ['費用が予想の１．５倍かかる', '費用が～かかる', true],
        ['費用が予想より…かかる', '費用が～かかる', true],
        ['前あ中い。後', '前～中～後', false],
        ['前あ。中い後', '前～中～後', false],
        ['前あ「中。い」後', '前～「中～」後', true],
        // Sentence checks do not infer grammar or choose the intended ending.
        ['せっかく来たのに、予約した店が閉まっていたのに', 'せっかく～のに', true],
        ['せっかく買ったものに', 'せっかく～のに', true],
        ['a'.repeat(10000), 'a～a～a～a～z', false],
    ])('%s matches %s: %s', (text, pattern, expected) => {
        expect(matchesGrammarWildcard(text, pattern.split('～'))).toBe(expected);
    });

    test.each(['。', '.', '．', '!', '?', '！', '？', '｡', '︒', '︕', '︖', '\n', '\r', '\r\n', '\u2028', '\u2029'])('does not span boundary %j', (boundary) => {
        expect(matchesGrammarWildcard(`前あ${boundary}い後`, ['前', '後'])).toBe(false);
    });

    test.each([['「', '」'], ['『', '』'], ['｢', '｣'], ['“', '”'], ['‘', '’'], ['"', '"']])('allows punctuation inside %s%s', (opening, closing) => {
        expect(matchesGrammarWildcard(`前${opening}あ。い！？${closing}後`, ['前', '後'])).toBe(true);
    });

    test('precomputed boundaries preserve UTF-16 offsets and unmatched-quote punctuation', () => {
        const text = '𠮷「中。」後。\n「未完。';
        expect(getGrammarWildcardBoundaryPositions(text).sort((a, b) => a - b)).toEqual([7, 8, 12]);
        expect(matchesGrammarWildcard(text, ['𠮷', '未完。'], getGrammarWildcardBoundaryPositions(text))).toBe(false);
    });

    test.each([['.', [0]], ['1.', [1]], ['.1', [0]]])('does not mistake an edge period in %s for a decimal point', (text, positions) => {
        expect(getGrammarWildcardBoundaryPositions(/** @type {string} */ (text))).toEqual(positions);
    });
});

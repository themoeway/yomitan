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
import {matchesGrammarWildcard} from '../../ext/js/language/grammar-wildcard.js';

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
        ['a'.repeat(10000), 'a～a～a～a～z', false],
    ])('%s matches %s: %s', (text, pattern, expected) => {
        expect(matchesGrammarWildcard(text, pattern.split('～'))).toBe(expected);
    });
});

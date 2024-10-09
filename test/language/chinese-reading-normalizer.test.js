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

import {describe, expect, test} from 'vitest';
import {normalizePinyin} from '../../ext/js/language/zh/chinese.js';

const tests = [
    ['rìwén', 'rìwén'],
    ['Rì wén', 'rìwén'],
    ['Wéi jī Bǎi kē', 'wéijībǎikē'],
    ['wán:zhěng', 'wánzhěng'],
    ['fān・yì', 'fānyì'],
    ['fān//yì', 'fānyì'],
    ['fān’yì', 'fānyì'],
    ['fān'yì', 'fānyì'],
    ['fān-yì', 'fānyì'],
];

describe('Normalize Pinyin', () => {
    test.each(tests)('%s should normalize to %s', (a, b) => {
        expect(normalizePinyin(a)).toStrictEqual(b);
    });
});

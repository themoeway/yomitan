/*
 * Copyright (C) 2024  Yomitan Authors
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

import {CJK_IDEOGRAPH_RANGES, CJK_PUNCTUATION_RANGE, FULLWIDTH_CHARACTER_RANGES, isCodePointInRanges} from '../CJK-util.js';

/** @type {import('CJK-util').CodepointRange} */
const BOPOMOFO_RANGE = [0x3100, 0x312f];
/** @type {import('CJK-util').CodepointRange} */
const BOPOMOFO_EXTENDED_RANGE = [0x31a0, 0x31bf];
/** @type {import('CJK-util').CodepointRange} */
const IDEOGRAPHIC_SYMBOLS_AND_PUNCTUATION_RANGE = [0x16fe0, 0x16fff];
/** @type {import('CJK-util').CodepointRange} */
const SMALL_FORM_RANGE = [0xfe50, 0xfe6f];
/** @type {import('CJK-util').CodepointRange} */
const VERTICAL_FORM_RANGE = [0xfe10, 0xfe1f];


/**
 * Chinese character ranges, roughly ordered in order of expected frequency.
 * @type {import('CJK-util').CodepointRange[]}
 */
const CHINESE_RANGES = [
    ...CJK_IDEOGRAPH_RANGES,
    CJK_PUNCTUATION_RANGE,

    ...FULLWIDTH_CHARACTER_RANGES,

    BOPOMOFO_RANGE,
    BOPOMOFO_EXTENDED_RANGE,
    IDEOGRAPHIC_SYMBOLS_AND_PUNCTUATION_RANGE,
    SMALL_FORM_RANGE,
    VERTICAL_FORM_RANGE,
];


/**
 * @param {string} str
 * @returns {boolean}
 */
export function isStringPartiallyChinese(str) {
    if (str.length === 0) { return false; }
    for (const c of str) {
        if (isCodePointInRanges(/** @type {number} */ (c.codePointAt(0)), CHINESE_RANGES)) {
            return true;
        }
    }
    return false;
}

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isCodePointChinese(codePoint) {
    return isCodePointInRanges(codePoint, CHINESE_RANGES);
}

/** @type {import('language').ReadingNormalizer} */
export function normalizePinyin(str) {
    return str.normalize('NFC').toLowerCase().replace(/[\s・:'’-]|\/\//g, '');
}

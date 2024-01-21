/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2022  Yomichan Authors
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

/**
 * Class containing generic string utility functions.
 */
export class StringUtil {
    /**
     * Reads code points from a string in the forward direction.
     * @param {string} text The text to read the code points from.
     * @param {number} position The index of the first character to read.
     * @param {number} count The number of code points to read.
     * @returns {string} The code points from the string.
     */
    static readCodePointsForward(text, position, count) {
        const textLength = text.length;
        let result = '';
        for (; count > 0; --count) {
            const char = text[position];
            result += char;
            if (++position >= textLength) { break; }
            const charCode = char.charCodeAt(0);
            if (charCode >= 0xd800 && charCode < 0xdc00) { // charCode is a high surrogate code
                const char2 = text[position];
                const charCode2 = char2.charCodeAt(0);
                if (charCode2 >= 0xdc00 && charCode2 < 0xe000) { // charCode2 is a low surrogate code
                    result += char2;
                    if (++position >= textLength) { break; }
                }
            }
        }
        return result;
    }

    /**
     * Reads code points from a string in the backward direction.
     * @param {string} text The text to read the code points from.
     * @param {number} position The index of the first character to read.
     * @param {number} count The number of code points to read.
     * @returns {string} The code points from the string.
     */
    static readCodePointsBackward(text, position, count) {
        let result = '';
        for (; count > 0; --count) {
            const char = text[position];
            result = char + result;
            if (--position < 0) { break; }
            const charCode = char.charCodeAt(0);
            if (charCode >= 0xdc00 && charCode < 0xe000) { // charCode is a low surrogate code
                const char2 = text[position];
                const charCode2 = char2.charCodeAt(0);
                if (charCode2 >= 0xd800 && charCode2 < 0xdc00) { // charCode2 is a high surrogate code
                    result = char2 + result;
                    if (--position < 0) { break; }
                }
            }
        }
        return result;
    }
}

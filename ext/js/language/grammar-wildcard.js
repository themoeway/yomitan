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

/**
 * Matches a dictionary pattern with one or more nonempty interior ～ gaps.
 * Literal pieces use string searches, so dictionary text cannot create regexes.
 * @param {string} text
 * @param {string[]} parts
 * @returns {boolean}
 */
export function matchesGrammarWildcard(text, parts) {
    if (parts.length < 2 || parts.some((part) => part.length === 0)) { return false; }
    if (!text.startsWith(parts[0])) { return false; }
    let end = parts[0].length;
    for (let i = 1; i < parts.length; ++i) {
        // Consume at least one code point, without splitting a surrogate pair.
        const codePoint = text.codePointAt(end);
        if (typeof codePoint === 'undefined') { return false; }
        const start = end + (codePoint > 0xffff ? 2 : 1);
        const part = parts[i];
        const index = i === parts.length - 1 ? text.length - part.length : text.indexOf(part, start);
        if (index < start || !text.startsWith(part, index)) { return false; }
        end = index + part.length;
    }
    return end === text.length;
}

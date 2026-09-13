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

const grammarQuotePairs = new Map([
    ['「', '」'], ['『', '』'], ['｢', '｣'], ['“', '”'], ['‘', '’'], ['"', '"'],
]);
const grammarQuoteEndings = new Set(grammarQuotePairs.values());
const grammarSentenceEndings = new Set('.!?。．！？｡︒︕︖');

/**
 * Finds boundaries that a wildcard gap must not cross. Only balanced quotes
 * protect sentence punctuation; explicit line breaks always remain boundaries.
 * Positions use UTF-16 offsets, like the literal string searches below.
 * @param {string} text
 * @returns {number[]}
 */
export function getGrammarWildcardBoundaryPositions(text) {
    /** @type {number[]} */
    const punctuation = [];
    /** @type {number[]} */
    const hardBoundaries = [];
    /** @type {{closing: string, punctuationCount: number}[]} */
    const quotes = [];
    for (let i = 0; i < text.length; ++i) {
        const character = text[i];
        if (character === '\n' || character === '\r' || character === '\u2028' || character === '\u2029') {
            hardBoundaries.push(i);
        } else if (quotes.length > 0 && character === quotes[quotes.length - 1].closing) {
            punctuation.length = quotes[quotes.length - 1].punctuationCount;
            quotes.pop();
        } else {
            const closing = grammarQuotePairs.get(character);
            if (typeof closing !== 'undefined') {
                quotes.push({closing, punctuationCount: punctuation.length});
            } else if (grammarQuoteEndings.has(character)) {
                // A scan may start inside dialogue, or contain mismatched quotes.
                hardBoundaries.push(i);
                quotes.length = 0;
            } else if (grammarSentenceEndings.has(character) && !(
                (character === '.' || character === '．') &&
                /[0-9０-９]/.test(text[i - 1] ?? '') && /[0-9０-９]/.test(text[i + 1] ?? '')
            )) {
                punctuation.push(i);
            }
        }
    }
    return [...punctuation, ...hardBoundaries];
}

/**
 * Matches a dictionary pattern with one or more nonempty interior ～ gaps.
 * Literal pieces use string searches, so dictionary text cannot create regexes.
 * @param {string} text
 * @param {string[]} parts
 * @param {number[]} [boundaryPositions]
 * @returns {boolean}
 */
export function matchesGrammarWildcard(text, parts, boundaryPositions) {
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
        boundaryPositions ??= getGrammarWildcardBoundaryPositions(text);
        if (boundaryPositions.some((position) => position >= end && position < index)) { return false; }
        end = index + part.length;
    }
    return end === text.length;
}

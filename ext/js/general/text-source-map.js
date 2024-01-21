/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2020-2022  Yomichan Authors
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

export class TextSourceMap {
    /**
     * @param {string} source
     * @param {number[]|null} [mapping=null]
     */
    constructor(source, mapping = null) {
        /** @type {string} */
        this._source = source;
        /** @type {?number[]} */
        this._mapping = (mapping !== null ? TextSourceMap.normalizeMapping(mapping) : null);
    }

    /** @type {string} */
    get source() {
        return this._source;
    }

    /**
     * @param {unknown} other
     * @returns {boolean}
     */
    equals(other) {
        if (this === other) {
            return true;
        }

        const source = this._source;
        if (!(other instanceof TextSourceMap && source === other.source)) {
            return false;
        }

        let mapping = this._mapping;
        let otherMapping = other.getMappingCopy();
        if (mapping === null) {
            if (otherMapping === null) {
                return true;
            }
            mapping = TextSourceMap.createMapping(source);
        } else if (otherMapping === null) {
            otherMapping = TextSourceMap.createMapping(source);
        }

        const mappingLength = mapping.length;
        if (mappingLength !== otherMapping.length) {
            return false;
        }

        for (let i = 0; i < mappingLength; ++i) {
            if (mapping[i] !== otherMapping[i]) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param {number} finalLength
     * @returns {number}
     */
    getSourceLength(finalLength) {
        const mapping = this._mapping;
        if (mapping === null) {
            return finalLength;
        }

        let sourceLength = 0;
        for (let i = 0; i < finalLength; ++i) {
            sourceLength += mapping[i];
        }
        return sourceLength;
    }

    /**
     * @param {number} index
     * @param {number} count
     */
    combine(index, count) {
        if (count <= 0) { return; }

        if (this._mapping === null) {
            this._mapping = TextSourceMap.createMapping(this._source);
        }

        let sum = this._mapping[index];
        const parts = this._mapping.splice(index + 1, count);
        for (const part of parts) {
            sum += part;
        }
        this._mapping[index] = sum;
    }

    /**
     * @param {number} index
     * @param {number[]} items
     */
    insert(index, ...items) {
        if (this._mapping === null) {
            this._mapping = TextSourceMap.createMapping(this._source);
        }

        this._mapping.splice(index, 0, ...items);
    }

    /**
     * @returns {?number[]}
     */
    getMappingCopy() {
        return this._mapping !== null ? [...this._mapping] : null;
    }

    /**
     * @param {string} text
     * @returns {number[]}
     */
    static createMapping(text) {
        return new Array(text.length).fill(1);
    }

    /**
     * @param {number[]} mapping
     * @returns {number[]}
     */
    static normalizeMapping(mapping) {
        const result = [];
        for (const value of mapping) {
            result.push(
                (typeof value === 'number' && Number.isFinite(value)) ?
                Math.floor(value) :
                0
            );
        }
        return result;
    }
}

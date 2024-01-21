/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2016-2022  Yomichan Authors
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
 * Class used to get and mutate generic properties of an object by using path strings.
 */
export class ObjectPropertyAccessor {
    /**
     * Create a new accessor for a specific object.
     * @param {unknown} target The object which the getter and mutation methods are applied to.
     */
    constructor(target) {
        /** @type {unknown} */
        this._target = target;
    }

    /**
     * Gets the value at the specified path.
     * @param {(string|number)[]} pathArray The path to the property on the target object.
     * @param {number} [pathLength] How many parts of the pathArray to use.
     *   This parameter is optional and defaults to the length of pathArray.
     * @returns {unknown} The value found at the path.
     * @throws {Error} An error is thrown if pathArray is not valid for the target object.
     */
    get(pathArray, pathLength) {
        let target = this._target;
        const ii = typeof pathLength === 'number' ? Math.min(pathArray.length, pathLength) : pathArray.length;
        for (let i = 0; i < ii; ++i) {
            const key = pathArray[i];
            if (!ObjectPropertyAccessor.hasProperty(target, key)) {
                throw new Error(`Invalid path: ${ObjectPropertyAccessor.getPathString(pathArray.slice(0, i + 1))}`);
            }
            target = /** @type {import('core').SerializableObject} */ (target)[key];
        }
        return target;
    }

    /**
     * Sets the value at the specified path.
     * @param {(string|number)[]} pathArray The path to the property on the target object.
     * @param {unknown} value The value to assign to the property.
     * @throws {Error} An error is thrown if pathArray is not valid for the target object.
     */
    set(pathArray, value) {
        const ii = pathArray.length - 1;
        if (ii < 0) { throw new Error('Invalid path'); }

        const target = this.get(pathArray, ii);
        const key = pathArray[ii];
        if (!ObjectPropertyAccessor.isValidPropertyType(target, key)) {
            throw new Error(`Invalid path: ${ObjectPropertyAccessor.getPathString(pathArray)}`);
        }

        /** @type {import('core').SerializableObject} */ (target)[key] = value;
    }

    /**
     * Deletes the property of the target object at the specified path.
     * @param {(string|number)[]}pathArray The path to the property on the target object.
     * @throws {Error} An error is thrown if pathArray is not valid for the target object.
     */
    delete(pathArray) {
        const ii = pathArray.length - 1;
        if (ii < 0) { throw new Error('Invalid path'); }

        const target = this.get(pathArray, ii);
        const key = pathArray[ii];
        if (!ObjectPropertyAccessor.isValidPropertyType(target, key)) {
            throw new Error(`Invalid path: ${ObjectPropertyAccessor.getPathString(pathArray)}`);
        }

        if (Array.isArray(target)) {
            throw new Error('Invalid type');
        }

        delete /** @type {import('core').SerializableObject} */ (target)[key];
    }

    /**
     * Swaps two properties of an object or array.
     * @param {(string|number)[]} pathArray1 The path to the first property on the target object.
     * @param {(string|number)[]} pathArray2 The path to the second property on the target object.
     * @throws An error is thrown if pathArray1 or pathArray2 is not valid for the target object,
     *   or if the swap cannot be performed.
     */
    swap(pathArray1, pathArray2) {
        const ii1 = pathArray1.length - 1;
        if (ii1 < 0) { throw new Error('Invalid path 1'); }
        const target1 = this.get(pathArray1, ii1);
        const key1 = pathArray1[ii1];
        if (!ObjectPropertyAccessor.isValidPropertyType(target1, key1)) { throw new Error(`Invalid path 1: ${ObjectPropertyAccessor.getPathString(pathArray1)}`); }

        const ii2 = pathArray2.length - 1;
        if (ii2 < 0) { throw new Error('Invalid path 2'); }
        const target2 = this.get(pathArray2, ii2);
        const key2 = pathArray2[ii2];
        if (!ObjectPropertyAccessor.isValidPropertyType(target2, key2)) { throw new Error(`Invalid path 2: ${ObjectPropertyAccessor.getPathString(pathArray2)}`); }

        const value1 = /** @type {import('core').SerializableObject} */ (target1)[key1];
        const value2 = /** @type {import('core').SerializableObject} */ (target2)[key2];

        /** @type {import('core').SerializableObject} */ (target1)[key1] = value2;
        try {
            /** @type {import('core').SerializableObject} */ (target2)[key2] = value1;
        } catch (e) {
            // Revert
            try {
                /** @type {import('core').SerializableObject} */ (target1)[key1] = value1;
            } catch (e2) {
                // NOP
            }
            throw e;
        }
    }

    /**
     * Converts a path string to a path array.
     * @param {(string|number)[]} pathArray The path array to convert.
     * @returns {string} A string representation of `pathArray`.
     * @throws {Error} An error is thrown if any item of `pathArray` is not a string or an integer.
     */
    static getPathString(pathArray) {
        const regexShort = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        let pathString = '';
        let first = true;
        for (let part of pathArray) {
            switch (typeof part) {
                case 'number':
                    if (Math.floor(part) !== part || part < 0) {
                        throw new Error('Invalid index');
                    }
                    part = `[${part}]`;
                    break;
                case 'string':
                    if (!regexShort.test(part)) {
                        const escapedPart = part.replace(/["\\]/g, '\\$&');
                        part = `["${escapedPart}"]`;
                    } else {
                        if (!first) {
                            part = `.${part}`;
                        }
                    }
                    break;
                default:
                    throw new Error(`Invalid type: ${typeof part}`);
            }
            pathString += part;
            first = false;
        }
        return pathString;
    }

    /**
     * Converts a path array to a path string. For the most part, the format of this string
     * matches Javascript's notation for property access.
     * @param {string} pathString The path string to convert.
     * @returns {(string | number)[]} An array representation of `pathString`.
     * @throws {Error} An error is thrown if `pathString` is malformed.
     */
    static getPathArray(pathString) {
        const pathArray = [];
        /** @type {import('object-property-accessor').ParsePathStringState} */
        let state = 'empty';
        let quote = 0;
        let value = '';
        let escaped = false;
        for (const c of pathString) {
            const v = /** @type {number} */ (c.codePointAt(0));
            switch (state) {
                case 'empty': // Empty
                case 'id-start': // Expecting identifier start
                    if (v === 0x5b) { // '['
                        if (state === 'id-start') {
                            throw new Error(`Unexpected character: ${c}`);
                        }
                        state = 'open-bracket';
                    } else if (
                        (v >= 0x41 && v <= 0x5a) || // ['A', 'Z']
                        (v >= 0x61 && v <= 0x7a) || // ['a', 'z']
                        v === 0x5f // '_'
                    ) {
                        state = 'id';
                        value += c;
                    } else {
                        throw new Error(`Unexpected character: ${c}`);
                    }
                    break;
                case 'id': // Identifier
                    if (
                        (v >= 0x41 && v <= 0x5a) || // ['A', 'Z']
                        (v >= 0x61 && v <= 0x7a) || // ['a', 'z']
                        (v >= 0x30 && v <= 0x39) || // ['0', '9']
                        v === 0x5f // '_'
                    ) {
                        value += c;
                    } else {
                        switch (v) {
                            case 0x5b: // '['
                                pathArray.push(value);
                                value = '';
                                state = 'open-bracket';
                                break;
                            case 0x2e: // '.'
                                pathArray.push(value);
                                value = '';
                                state = 'id-start';
                                break;
                            default:
                                throw new Error(`Unexpected character: ${c}`);
                        }
                    }
                    break;
                case 'open-bracket': // Open bracket
                    if (v === 0x22 || v === 0x27) { // '"' or '\''
                        quote = v;
                        state = 'string';
                    } else if (v >= 0x30 && v <= 0x39) { // ['0', '9']
                        state = 'number';
                        value += c;
                    } else {
                        throw new Error(`Unexpected character: ${c}`);
                    }
                    break;
                case 'string': // Quoted string
                    if (escaped) {
                        value += c;
                        escaped = false;
                    } else if (v === 0x5c) { // '\\'
                        escaped = true;
                    } else if (v !== quote) {
                        value += c;
                    } else {
                        state = 'close-bracket';
                    }
                    break;
                case 'number': // Number
                    if (v >= 0x30 && v <= 0x39) { // ['0', '9']
                        value += c;
                    } else if (v === 0x5d) { // ']'
                        pathArray.push(Number.parseInt(value, 10));
                        value = '';
                        state = 'next';
                    } else {
                        throw new Error(`Unexpected character: ${c}`);
                    }
                    break;
                case 'close-bracket': // Expecting closing bracket after quoted string
                    if (v === 0x5d) { // ']'
                        pathArray.push(value);
                        value = '';
                        state = 'next';
                    } else {
                        throw new Error(`Unexpected character: ${c}`);
                    }
                    break;
                case 'next': { // Expecting . or [
                    switch (v) {
                        case 0x5b: // '['
                            state = 'open-bracket';
                            break;
                        case 0x2e: // '.'
                            state = 'id-start';
                            break;
                        default:
                            throw new Error(`Unexpected character: ${c}`);
                    }
                    break;
                }
            }
        }
        switch (state) {
            case 'empty':
            case 'next':
                break;
            case 'id':
                pathArray.push(value);
                value = '';
                break;
            default:
                throw new Error('Path not terminated correctly');
        }
        return pathArray;
    }

    /**
     * Checks whether an object or array has the specified property.
     * @param {unknown} object The object to test.
     * @param {string|number} property The property to check for existence.
     *   This value should be a string if the object is a non-array object.
     *   For arrays, it should be an integer.
     * @returns {boolean} `true` if the property exists, otherwise `false`.
     */
    static hasProperty(object, property) {
        switch (typeof property) {
            case 'string':
                return (
                    typeof object === 'object' &&
                    object !== null &&
                    !Array.isArray(object) &&
                    Object.prototype.hasOwnProperty.call(object, property)
                );
            case 'number':
                return (
                    Array.isArray(object) &&
                    property >= 0 &&
                    property < object.length &&
                    property === Math.floor(property)
                );
            default:
                return false;
        }
    }

    /**
     * Checks whether a property is valid for the given object
     * @param {unknown} object The object to test.
     * @param {string|number} property The property to check for existence.
     * @returns {boolean} `true` if the property is correct for the given object type, otherwise `false`.
     *   For arrays, this means that the property should be a positive integer.
     *   For non-array objects, the property should be a string.
     */
    static isValidPropertyType(object, property) {
        switch (typeof property) {
            case 'string':
                return (
                    typeof object === 'object' &&
                    object !== null &&
                    !Array.isArray(object)
                );
            case 'number':
                return (
                    Array.isArray(object) &&
                    property >= 0 &&
                    property === Math.floor(property)
                );
            default:
                return false;
        }
    }
}

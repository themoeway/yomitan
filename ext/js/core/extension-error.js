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

/**
 * Custom error class for the extension which can contain extra data.
 * This works around an issue where assigning the `DOMException.data` field can fail on Firefox.
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=1776555
 */
export class ExtensionError extends Error {
    /**
     * @param {string} message
     */
    constructor(message) {
        super(message);
        /** @type {string} */
        this.name = 'ExtensionError';
        /** @type {unknown} */
        this._data = void 0;
    }

    /** @type {unknown} */
    get data() { return this._data; }
    set data(value) { this._data = value; }

    /**
     * Converts an `Error` object to a serializable JSON object.
     * @param {unknown} error An error object to convert.
     * @returns {import('core').SerializedError} A simple object which can be serialized by `JSON.stringify()`.
     */
    static serialize(error) {
        try {
            if (typeof error === 'object' && error !== null) {
                const {name, message, stack} = /** @type {import('core').SerializableObject} */ (error);
                /** @type {import('core').SerializedError1} */
                const result = {
                    name: typeof name === 'string' ? name : '',
                    message: typeof message === 'string' ? message : '',
                    stack: typeof stack === 'string' ? stack : ''
                };
                if (error instanceof ExtensionError) {
                    result.data = error.data;
                }
                return result;
            }
        } catch (e) {
            // NOP
        }
        return /** @type {import('core').SerializedError2} */ ({
            value: error,
            hasValue: true
        });
    }

    /**
     * Converts a serialized error into a standard `Error` object.
     * @param {import('core').SerializedError} serializedError A simple object which was initially generated by the `serialize` function.
     * @returns {ExtensionError} A new `Error` instance.
     */
    static deserialize(serializedError) {
        if (serializedError.hasValue) {
            const {value} = serializedError;
            return new ExtensionError(`Error of type ${typeof value}: ${value}`);
        }
        const {message, name, stack, data} = serializedError;
        const error = new ExtensionError(message);
        error.name = name;
        error.stack = stack;
        if (typeof data !== 'undefined') {
            error.data = data;
        }
        return error;
    }
}

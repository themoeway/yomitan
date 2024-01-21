/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2019-2022  Yomichan Authors
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
 * Checks whether a given value is a non-array object.
 * @param {unknown} value The value to check.
 * @returns {boolean} `true` if the value is an object and not an array, `false` otherwise.
 */
export function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Converts any string into a form that can be passed into the RegExp constructor.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
 * @param {string} string The string to convert to a valid regular expression.
 * @returns {string} The escaped string.
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reverses a string.
 * @param {string} string The string to reverse.
 * @returns {string} The returned string, which retains proper UTF-16 surrogate pair order.
 */
export function stringReverse(string) {
    return [...string].reverse().join('');
}

/**
 * Creates a deep clone of an object or value. This is similar to `parseJson(JSON.stringify(value))`.
 * @template [T=unknown]
 * @param {T} value The value to clone.
 * @returns {T} A new clone of the value.
 * @throws An error if the value is circular and cannot be cloned.
 */
export function clone(value) {
    if (value === null) { return /** @type {T} */ (null); }
    switch (typeof value) {
        case 'boolean':
        case 'number':
        case 'string':
        case 'bigint':
        case 'symbol':
        case 'undefined':
            return value;
        default:
            return cloneInternal(value, new Set());
    }
}

/**
 * @template [T=unknown]
 * @param {T} value
 * @param {Set<unknown>} visited
 * @returns {T}
 * @throws {Error}
 */
function cloneInternal(value, visited) {
    if (value === null) { return /** @type {T} */ (null); }
    switch (typeof value) {
        case 'boolean':
        case 'number':
        case 'string':
        case 'bigint':
        case 'symbol':
        case 'undefined':
            return value;
        case 'object':
            return /** @type {T} */ (
                    Array.isArray(value) ?
                    cloneArray(value, visited) :
                    cloneObject(/** @type {import('core').SerializableObject} */ (value), visited)
            );
        default:
            throw new Error(`Cannot clone object of type ${typeof value}`);
    }
}

/**
 * @param {unknown[]} value
 * @param {Set<unknown>} visited
 * @returns {unknown[]}
 * @throws {Error}
 */
function cloneArray(value, visited) {
    if (visited.has(value)) { throw new Error('Circular'); }
    try {
        visited.add(value);
        const result = [];
        for (const item of value) {
            result.push(cloneInternal(item, visited));
        }
        return result;
    } finally {
        visited.delete(value);
    }
}

/**
 * @param {import('core').SerializableObject} value
 * @param {Set<unknown>} visited
 * @returns {import('core').SerializableObject}
 * @throws {Error}
 */
function cloneObject(value, visited) {
    if (visited.has(value)) { throw new Error('Circular'); }
    try {
        visited.add(value);
        /** @type {import('core').SerializableObject} */
        const result = {};
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                result[key] = cloneInternal(value[key], visited);
            }
        }
        return result;
    } finally {
        visited.delete(value);
    }
}

/**
 * Checks if an object or value is deeply equal to another object or value.
 * @param {unknown} value1 The first value to check.
 * @param {unknown} value2 The second value to check.
 * @returns {boolean} `true` if the values are the same object, or deeply equal without cycles. `false` otherwise.
 */
export function deepEqual(value1, value2) {
    if (value1 === value2) { return true; }

    const type = typeof value1;
    if (typeof value2 !== type) { return false; }

    switch (type) {
        case 'object':
        case 'function':
            return deepEqualInternal(value1, value2, new Set());
        default:
            return false;
    }
}

/**
 * @param {unknown} value1
 * @param {unknown} value2
 * @param {Set<unknown>} visited1
 * @returns {boolean}
 */
function deepEqualInternal(value1, value2, visited1) {
    if (value1 === value2) { return true; }

    const type = typeof value1;
    if (typeof value2 !== type) { return false; }

    switch (type) {
        case 'object':
        case 'function':
        {
            if (value1 === null || value2 === null) { return false; }
            const array = Array.isArray(value1);
            if (array !== Array.isArray(value2)) { return false; }
            if (visited1.has(value1)) { return false; }
            visited1.add(value1);
            return (
                    array ?
                    areArraysEqual(/** @type {unknown[]} */ (value1), /** @type {unknown[]} */ (value2), visited1) :
                    areObjectsEqual(/** @type {import('core').UnknownObject} */ (value1), /** @type {import('core').UnknownObject} */ (value2), visited1)
            );
        }
        default:
            return false;
    }
}

/**
 * @param {import('core').UnknownObject} value1
 * @param {import('core').UnknownObject} value2
 * @param {Set<unknown>} visited1
 * @returns {boolean}
 */
function areObjectsEqual(value1, value2, visited1) {
    const keys1 = Object.keys(value1);
    const keys2 = Object.keys(value2);
    if (keys1.length !== keys2.length) { return false; }

    const keys1Set = new Set(keys1);
    for (const key of keys2) {
        if (!keys1Set.has(key) || !deepEqualInternal(value1[key], value2[key], visited1)) { return false; }
    }

    return true;
}

/**
 * @param {unknown[]} value1
 * @param {unknown[]} value2
 * @param {Set<unknown>} visited1
 * @returns {boolean}
 */
function areArraysEqual(value1, value2, visited1) {
    const length = value1.length;
    if (length !== value2.length) { return false; }

    for (let i = 0; i < length; ++i) {
        if (!deepEqualInternal(value1[i], value2[i], visited1)) { return false; }
    }

    return true;
}

/**
 * Creates a new base-16 (lower case) string of a sequence of random bytes of the given length.
 * @param {number} length The number of bytes the string represents. The returned string's length will be twice as long.
 * @returns {string} A string of random characters.
 */
export function generateId(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    let id = '';
    for (const value of array) {
        id += value.toString(16).padStart(2, '0');
    }
    return id;
}

/**
 * Creates an unresolved promise that can be resolved later, outside the promise's executor function.
 * @template [T=unknown]
 * @returns {import('core').DeferredPromiseDetails<T>} An object `{promise, resolve, reject}`, containing the promise and the resolve/reject functions.
 */
export function deferPromise() {
    /** @type {((value: T) => void)|undefined} */
    let resolve;
    /** @type {((reason?: import('core').RejectionReason) => void)|undefined} */
    let reject;
    const promise = new Promise((resolve2, reject2) => {
        resolve = resolve2;
        reject = reject2;
    });
    return {
        promise,
        resolve: /** @type {(value: T) => void} */ (resolve),
        reject: /** @type {(reason?: import('core').RejectionReason) => void} */ (reject)
    };
}

/**
 * Creates a promise that is resolved after a set delay.
 * @param {number} delay How many milliseconds until the promise should be resolved. If 0, the promise is immediately resolved.
 * @returns {Promise<void>} A promise with two additional properties: `resolve` and `reject`, which can be used to complete the promise early.
 */
export function promiseTimeout(delay) {
    return delay <= 0 ? Promise.resolve() : new Promise((resolve) => { setTimeout(resolve, delay); });
}

/**
 * Creates a promise that will resolve after the next animation frame, using `requestAnimationFrame`.
 * @param {number} [timeout] A maximum duration (in milliseconds) to wait until the promise resolves. If null or omitted, no timeout is used.
 * @returns {Promise<{time: number, timeout: boolean}>} A promise that is resolved with `{time, timeout}`, where `time` is the timestamp from `requestAnimationFrame`,
 *   and `timeout` is a boolean indicating whether the cause was a timeout or not.
 * @throws The promise throws an error if animation is not supported in this context, such as in a service worker.
 */
export function promiseAnimationFrame(timeout) {
    return new Promise((resolve, reject) => {
        if (typeof cancelAnimationFrame !== 'function' || typeof requestAnimationFrame !== 'function') {
            reject(new Error('Animation not supported in this context'));
            return;
        }

        /** @type {?import('core').Timeout} */
        let timer = null;
        /** @type {?number} */
        let frameRequest = null;
        /**
         * @param {number} time
         */
        const onFrame = (time) => {
            frameRequest = null;
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
            resolve({time, timeout: false});
        };
        const onTimeout = () => {
            timer = null;
            if (frameRequest !== null) {
                // eslint-disable-next-line no-undef
                cancelAnimationFrame(frameRequest);
                frameRequest = null;
            }
            resolve({time: performance.now(), timeout: true});
        };

        // eslint-disable-next-line no-undef
        frameRequest = requestAnimationFrame(onFrame);
        if (typeof timeout === 'number') {
            timer = setTimeout(onTimeout, timeout);
        }
    });
}

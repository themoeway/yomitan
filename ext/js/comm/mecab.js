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

import {EventListenerCollection} from '../core/event-listener-collection.js';
import {toError} from '../core/to-error.js';

/**
 * This class is used to connect Yomitan to a native component that is
 * used to parse text into individual terms.
 */
export class Mecab {
    /**
     * Creates a new instance of the class.
     */
    constructor() {
        /** @type {?chrome.runtime.Port} */
        this._port = null;
        /** @type {number} */
        this._sequence = 0;
        /** @type {Map<number, {resolve: (value: unknown) => void, reject: (reason?: unknown) => void, timer: import('core').Timeout}>} */
        this._invocations = new Map();
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {number} */
        this._timeout = 5000;
        /** @type {number} */
        this._version = 1;
        /** @type {?number} */
        this._remoteVersion = null;
        /** @type {boolean} */
        this._enabled = false;
        /** @type {?Promise<void>} */
        this._setupPortPromise = null;
    }

    /**
     * Returns whether or not the component is enabled.
     * @returns {boolean} Whether or not the object is enabled.
     */
    isEnabled() {
        return this._enabled;
    }

    /**
     * Changes whether or not the component connection is enabled.
     * @param {boolean} enabled A boolean indicating whether or not the component should be enabled.
     */
    setEnabled(enabled) {
        this._enabled = !!enabled;
        if (!this._enabled && this._port !== null) {
            this._clearPort();
        }
    }

    /**
     * Disconnects the current port, but does not disable future connections.
     */
    disconnect() {
        if (this._port !== null) {
            this._clearPort();
        }
    }

    /**
     * Returns whether or not the connection to the native application is active.
     * @returns {boolean} `true` if the connection is active, `false` otherwise.
     */
    isConnected() {
        return (this._port !== null);
    }

    /**
     * Returns whether or not any invocation is currently active.
     * @returns {boolean} `true` if an invocation is active, `false` otherwise.
     */
    isActive() {
        return (this._invocations.size > 0);
    }

    /**
     * Gets the local API version being used.
     * @returns {number} An integer representing the API version that Yomitan uses.
     */
    getLocalVersion() {
        return this._version;
    }

    /**
     * Gets the version of the MeCab component.
     * @returns {Promise<?number>} The version of the MeCab component, or `null` if the component was not found.
     */
    async getVersion() {
        try {
            await this._setupPortWrapper();
        } catch (e) {
            // NOP
        }
        return this._remoteVersion;
    }

    /**
     * Parses a string of Japanese text into arrays of lines and terms.
     *
     * Return value format:
     * ```js
     * [
     *     {
     *         name: (string),
     *         lines: [
     *             {term: (string), reading: (string), source: (string)},
     *             ...
     *         ]
     *     },
     *     ...
     * ]
     * ```
     * @param {string} text The string to parse.
     * @returns {Promise<import('mecab').ParseResult[]>} A collection of parsing results of the text.
     */
    async parseText(text) {
        await this._setupPortWrapper();
        const rawResults = await this._invoke('parse_text', {text});
        // Note: The format of rawResults is not validated
        return this._convertParseTextResults(/** @type {import('mecab').ParseResultRaw} */ (rawResults));
    }

    // Private

    /**
     * @param {unknown} message
     */
    _onMessage(message) {
        if (typeof message !== 'object' || message === null) { return; }

        const {sequence, data} = /** @type {import('core').SerializableObject} */ (message);
        if (typeof sequence !== 'number') { return; }

        const invocation = this._invocations.get(sequence);
        if (typeof invocation === 'undefined') { return; }

        const {resolve, timer} = invocation;
        clearTimeout(timer);
        resolve(data);
        this._invocations.delete(sequence);
    }

    /**
     * @returns {void}
     */
    _onDisconnect() {
        if (this._port === null) { return; }
        const e = chrome.runtime.lastError;
        const error = new Error(e ? e.message : 'MeCab disconnected');
        for (const {reject, timer} of this._invocations.values()) {
            clearTimeout(timer);
            reject(error);
        }
        this._clearPort();
    }

    /**
     * @param {string} action
     * @param {import('core').SerializableObject} params
     * @returns {Promise<unknown>}
     */
    _invoke(action, params) {
        return new Promise((resolve, reject) => {
            if (this._port === null) {
                reject(new Error('Port disconnected'));
                return;
            }

            const sequence = this._sequence++;

            const timer = setTimeout(() => {
                this._invocations.delete(sequence);
                reject(new Error(`MeCab invoke timed out after ${this._timeout}ms`));
            }, this._timeout);

            this._invocations.set(sequence, {resolve, reject, timer});

            this._port.postMessage({action, params, sequence});
        });
    }

    /**
     * @param {import('mecab').ParseResultRaw} rawResults
     * @returns {import('mecab').ParseResult[]}
     */
    _convertParseTextResults(rawResults) {
        /** @type {import('mecab').ParseResult[]} */
        const results = [];
        for (const [name, rawLines] of Object.entries(rawResults)) {
            /** @type {import('mecab').ParseFragment[][]} */
            const lines = [];
            for (const rawLine of rawLines) {
                const line = [];
                for (let {expression: term, reading, source} of rawLine) {
                    if (typeof term !== 'string') { term = ''; }
                    if (typeof reading !== 'string') { reading = ''; }
                    if (typeof source !== 'string') { source = ''; }
                    line.push({term, reading, source});
                }
                lines.push(line);
            }
            results.push({name, lines});
        }
        return results;
    }

    /**
     * @returns {Promise<void>}
     */
    async _setupPortWrapper() {
        if (!this._enabled) {
            throw new Error('MeCab not enabled');
        }
        if (this._setupPortPromise === null) {
            this._setupPortPromise = this._setupPort();
        }
        try {
            await this._setupPortPromise;
        } catch (e) {
            throw toError(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async _setupPort() {
        const port = chrome.runtime.connectNative('yomitan_mecab');
        this._eventListeners.addListener(port.onMessage, this._onMessage.bind(this));
        this._eventListeners.addListener(port.onDisconnect, this._onDisconnect.bind(this));
        this._port = port;

        try {
            const data = await this._invoke('get_version', {});
            if (typeof data !== 'object' || data === null) {
                throw new Error('Invalid version');
            }
            const {version} = /** @type {import('core').SerializableObject} */ (data);
            if (typeof version !== 'number') {
                throw new Error('Invalid version');
            }
            this._remoteVersion = version;
            if (version !== this._version) {
                throw new Error(`Unsupported MeCab native messenger version ${version}. Yomitan supports version ${this._version}.`);
            }
        } catch (e) {
            if (this._port === port) {
                this._clearPort();
            }
            throw e;
        }
    }

    /**
     * @returns {void}
     */
    _clearPort() {
        if (this._port !== null) {
            this._port.disconnect();
            this._port = null;
        }
        this._invocations.clear();
        this._eventListeners.removeAllEventListeners();
        this._sequence = 0;
        this._setupPortPromise = null;
    }
}

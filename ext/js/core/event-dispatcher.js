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
 * The following typedef is required because the JSDoc `implements` tag doesn't work with `import()`.
 * https://github.com/microsoft/TypeScript/issues/49905
 * @typedef {import('core').EventDispatcherOffGeneric} EventDispatcherOffGeneric
 */

/**
 * Base class controls basic event dispatching.
 * @template {import('core').EventSurface} TSurface
 * @implements {EventDispatcherOffGeneric}
 */
export class EventDispatcher {
    /**
     * Creates a new instance.
     */
    constructor() {
        /** @type {Map<import('core').EventNames<TSurface>, import('core').EventHandlerAny[]>} */
        this._eventMap = new Map();
    }

    /**
     * Triggers an event with the given name and specified argument.
     * @template {import('core').EventNames<TSurface>} TName
     * @param {TName} eventName The string representing the event's name.
     * @param {import('core').EventArgument<TSurface, TName>} details The argument passed to the callback functions.
     * @returns {boolean} `true` if any callbacks were registered, `false` otherwise.
     */
    trigger(eventName, details) {
        const callbacks = this._eventMap.get(eventName);
        if (typeof callbacks === 'undefined') { return false; }

        for (const callback of callbacks) {
            callback(details);
        }
        return true;
    }

    /**
     * Adds a single event listener to a specific event.
     * @template {import('core').EventNames<TSurface>} TName
     * @param {TName} eventName The string representing the event's name.
     * @param {import('core').EventHandler<TSurface, TName>} callback The event listener callback to add.
     */
    on(eventName, callback) {
        let callbacks = this._eventMap.get(eventName);
        if (typeof callbacks === 'undefined') {
            callbacks = [];
            this._eventMap.set(eventName, callbacks);
        }
        callbacks.push(callback);
    }

    /**
     * Removes a single event listener from a specific event.
     * @template {import('core').EventNames<TSurface>} TName
     * @param {TName} eventName The string representing the event's name.
     * @param {import('core').EventHandler<TSurface, TName>} callback The event listener callback to add.
     * @returns {boolean} `true` if the callback was removed, `false` otherwise.
     */
    off(eventName, callback) {
        const callbacks = this._eventMap.get(eventName);
        if (typeof callbacks === 'undefined') { return false; }

        const ii = callbacks.length;
        for (let i = 0; i < ii; ++i) {
            if (callbacks[i] === callback) {
                callbacks.splice(i, 1);
                if (callbacks.length === 0) {
                    this._eventMap.delete(eventName);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Checks if an event has any listeners.
     * @template {import('core').EventNames<TSurface>} TName
     * @param {TName} eventName The string representing the event's name.
     * @returns {boolean} `true` if the event has listeners, `false` otherwise.
     */
    hasListeners(eventName) {
        const callbacks = this._eventMap.get(eventName);
        return (typeof callbacks !== 'undefined' && callbacks.length > 0);
    }
}

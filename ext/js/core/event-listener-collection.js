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
 * Class which stores event listeners added to various objects, making it easy to remove them in bulk.
 */
export class EventListenerCollection {
    /**
     * Creates a new instance.
     */
    constructor() {
        /** @type {import('event-listener-collection').EventListenerDetails[]} */
        this._eventListeners = [];
    }

    /**
     * Returns the number of event listeners that are currently in the object.
     * @type {number}
     */
    get size() {
        return this._eventListeners.length;
    }

    /**
     * Adds an event listener using `object.addEventListener`. The listener will later be removed using `object.removeEventListener`.
     * @param {import('event-listener-collection').EventTarget} target The object to add the event listener to.
     * @param {string} type The name of the event.
     * @param {EventListener | EventListenerObject | import('event-listener-collection').EventListenerFunction} listener The callback listener.
     * @param {AddEventListenerOptions | boolean} [options] Options for the event.
     */
    addEventListener(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        this._eventListeners.push({type: 'removeEventListener', target, eventName: type, listener, options});
    }

    /**
     * Adds an event listener using `object.addListener`. The listener will later be removed using `object.removeListener`.
     * @template {import('event-listener-collection').EventListenerFunction} TCallback
     * @template [TArgs=unknown]
     * @param {import('event-listener-collection').ExtensionEvent<TCallback, TArgs>} target The object to add the event listener to.
     * @param {TCallback} callback The callback.
     * @param {TArgs[]} args The extra argument array passed to the `addListener`/`removeListener` function.
     */
    addListener(target, callback, ...args) {
        target.addListener(callback, ...args);
        this._eventListeners.push({type: 'removeListener', target, callback, args});
    }

    /**
     * Adds an event listener using `object.on`. The listener will later be removed using `object.off`.
     * @template {import('core').EventSurface} TSurface
     * @template {import('core').EventNames<TSurface>} TName
     * @param {import('./event-dispatcher.js').EventDispatcher<TSurface>} target The object to add the event listener to.
     * @param {TName} eventName The string representing the event's name.
     * @param {import('core').EventHandler<TSurface, TName>} callback The event listener callback to add.
     */
    on(target, eventName, callback) {
        target.on(eventName, callback);
        this._eventListeners.push({type: 'off', eventName, target, callback});
    }

    /**
     * Removes all event listeners added to objects for this instance and clears the internal list of event listeners.
     */
    removeAllEventListeners() {
        if (this._eventListeners.length === 0) { return; }
        for (const item of this._eventListeners) {
            switch (item.type) {
                case 'removeEventListener':
                    item.target.removeEventListener(item.eventName, item.listener, item.options);
                    break;
                case 'removeListener':
                    item.target.removeListener(item.callback, ...item.args);
                    break;
                case 'off':
                    item.target.off(item.eventName, item.callback);
                    break;
            }
        }
        this._eventListeners = [];
    }
}

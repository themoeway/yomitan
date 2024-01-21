/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2021-2022  Yomichan Authors
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

export class ElementOverflowController {
    constructor() {
        /** @type {Element[]} */
        this._elements = [];
        /** @type {?(number|import('core').Timeout)} */
        this._checkTimer = null;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {EventListenerCollection} */
        this._windowEventListeners = new EventListenerCollection();
        /** @type {Map<string, {collapsed: boolean, force: boolean}>} */
        this._dictionaries = new Map();
        /** @type {() => void} */
        this._updateBind = this._update.bind(this);
        /** @type {() => void} */
        this._onWindowResizeBind = this._onWindowResize.bind(this);
        /** @type {(event: MouseEvent) => void} */
        this._onToggleButtonClickBind = this._onToggleButtonClick.bind(this);
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    setOptions(options) {
        this._dictionaries.clear();
        for (const {name, definitionsCollapsible} of options.dictionaries) {
            let collapsible = false;
            let collapsed = false;
            let force = false;
            switch (definitionsCollapsible) {
                case 'expanded':
                    collapsible = true;
                    break;
                case 'collapsed':
                    collapsible = true;
                    collapsed = true;
                    break;
                case 'force-expanded':
                    collapsible = true;
                    force = true;
                    break;
                case 'force-collapsed':
                    collapsible = true;
                    collapsed = true;
                    force = true;
                    break;
            }
            if (!collapsible) { continue; }
            this._dictionaries.set(name, {collapsed, force});
        }
    }

    /**
     * @param {Element} entry
     */
    addElements(entry) {
        if (this._dictionaries.size === 0) { return; }

        const elements = entry.querySelectorAll('.definition-item-inner');
        for (const element of elements) {
            const {parentNode} = element;
            if (parentNode === null) { continue; }
            const {dictionary} = /** @type {HTMLElement} */ (parentNode).dataset;
            if (typeof dictionary === 'undefined') { continue; }
            const dictionaryInfo = this._dictionaries.get(dictionary);
            if (typeof dictionaryInfo === 'undefined') { continue; }

            if (dictionaryInfo.force) {
                element.classList.add('collapsible', 'collapsible-forced');
            } else {
                this._updateElement(element);
                this._elements.push(element);
            }

            if (dictionaryInfo.collapsed) {
                element.classList.add('collapsed');
            }

            const button = element.querySelector('.definition-item-expansion-button');
            if (button !== null) {
                this._eventListeners.addEventListener(button, 'click', this._onToggleButtonClickBind, false);
            }
        }

        if (this._elements.length > 0 && this._windowEventListeners.size === 0) {
            this._windowEventListeners.addEventListener(window, 'resize', this._onWindowResizeBind, false);
        }
    }

    /** */
    clearElements() {
        this._elements.length = 0;
        this._windowEventListeners.removeAllEventListeners();
    }

    // Private

    /** */
    _onWindowResize() {
        if (this._checkTimer !== null) {
            this._cancelIdleCallback(this._checkTimer);
        }
        this._checkTimer = this._requestIdleCallback(this._updateBind, 100);
    }

    /**
     * @param {MouseEvent} e
     */
    _onToggleButtonClick(e) {
        const element = /** @type {Element} */ (e.currentTarget);
        const container = element.closest('.definition-item-inner');
        if (container === null) { return; }
        container.classList.toggle('collapsed');
    }

    /** */
    _update() {
        for (const element of this._elements) {
            this._updateElement(element);
        }
    }

    /**
     * @param {Element} element
     */
    _updateElement(element) {
        const {classList} = element;
        classList.add('collapse-test');
        const collapsible = element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
        classList.toggle('collapsible', collapsible);
        classList.remove('collapse-test');
    }

    /**
     * @param {() => void} callback
     * @param {number} timeout
     * @returns {number|import('core').Timeout}
     */
    _requestIdleCallback(callback, timeout) {
        if (typeof requestIdleCallback === 'function') {
            return requestIdleCallback(callback, {timeout});
        } else {
            return setTimeout(callback, timeout);
        }
    }

    /**
     * @param {number|import('core').Timeout} handle
     */
    _cancelIdleCallback(handle) {
        if (typeof cancelIdleCallback === 'function') {
            cancelIdleCallback(/** @type {number} */ (handle));
        } else {
            clearTimeout(handle);
        }
    }
}

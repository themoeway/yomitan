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

import {EventDispatcher} from '../core/event-dispatcher.js';
import {generateId, isObject} from '../core/utilities.js';

/**
 * @augments EventDispatcher<import('display-history').Events>
 */
export class DisplayHistory extends EventDispatcher {
    /**
     * @param {{clearable?: boolean, useBrowserHistory?: boolean}} details
     */
    constructor({clearable = true, useBrowserHistory = false}) {
        super();
        /** @type {boolean} */
        this._clearable = clearable;
        /** @type {boolean} */
        this._useBrowserHistory = useBrowserHistory;
        /** @type {Map<string, import('display-history').Entry>} */
        this._historyMap = new Map();

        const historyState = history.state;
        const {id, state} = isObject(historyState) ? historyState : {id: null, state: null};
        /** @type {import('display-history').Entry} */
        this._current = this._createHistoryEntry(id, location.href, state, null, null);
    }

    /** @type {?import('display-history').EntryState} */
    get state() {
        return this._current.state;
    }

    /** @type {?import('display-history').EntryContent} */
    get content() {
        return this._current.content;
    }

    /** @type {boolean} */
    get useBrowserHistory() {
        return this._useBrowserHistory;
    }

    set useBrowserHistory(value) {
        this._useBrowserHistory = value;
    }

    /** @type {boolean} */
    get clearable() { return this._clearable; }
    set clearable(value) { this._clearable = value; }

    /** */
    prepare() {
        window.addEventListener('popstate', this._onPopState.bind(this), false);
    }

    /**
     * @returns {boolean}
     */
    hasNext() {
        return this._current.next !== null;
    }

    /**
     * @returns {boolean}
     */
    hasPrevious() {
        return this._current.previous !== null;
    }

    /** */
    clear() {
        if (!this._clearable) { return; }
        this._clear();
    }

    /**
     * @returns {boolean}
     */
    back() {
        return this._go(false);
    }

    /**
     * @returns {boolean}
     */
    forward() {
        return this._go(true);
    }

    /**
     * @param {?import('display-history').EntryState} state
     * @param {?import('display-history').EntryContent} content
     * @param {string} [url]
     */
    pushState(state, content, url) {
        if (typeof url === 'undefined') { url = location.href; }

        const entry = this._createHistoryEntry(null, url, state, content, this._current);
        this._current.next = entry;
        this._current = entry;
        this._updateHistoryFromCurrent(!this._useBrowserHistory);
    }

    /**
     * @param {?import('display-history').EntryState} state
     * @param {?import('display-history').EntryContent} content
     * @param {string} [url]
     */
    replaceState(state, content, url) {
        if (typeof url === 'undefined') { url = location.href; }

        this._current.url = url;
        this._current.state = state;
        this._current.content = content;
        this._updateHistoryFromCurrent(true);
    }

    /** */
    _onPopState() {
        this._updateStateFromHistory();
        this._triggerStateChanged(false);
    }

    /**
     * @param {boolean} forward
     * @returns {boolean}
     */
    _go(forward) {
        if (this._useBrowserHistory) {
            if (forward) {
                history.forward();
            } else {
                history.back();
            }
        } else {
            const target = forward ? this._current.next : this._current.previous;
            if (target === null) { return false; }
            this._current = target;
            this._updateHistoryFromCurrent(true);
        }

        return true;
    }

    /**
     * @param {boolean} synthetic
     */
    _triggerStateChanged(synthetic) {
        this.trigger('stateChanged', {synthetic});
    }

    /**
     * @param {boolean} replace
     */
    _updateHistoryFromCurrent(replace) {
        const {id, state, url} = this._current;
        if (replace) {
            history.replaceState({id, state}, '', url);
        } else {
            history.pushState({id, state}, '', url);
        }
        this._triggerStateChanged(true);
    }

    /** */
    _updateStateFromHistory() {
        let state = history.state;
        let id = null;
        if (isObject(state)) {
            id = state.id;
            if (typeof id === 'string') {
                const entry = this._historyMap.get(id);
                if (typeof entry !== 'undefined') {
                    // Valid
                    this._current = entry;
                    return;
                }
            }
            // Partial state recovery
            state = state.state;
        } else {
            state = null;
        }

        // Fallback
        this._current.id = (typeof id === 'string' ? id : this._generateId());
        this._current.state = state;
        this._current.content = null;
        this._clear();
    }

    /**
     * @param {unknown} id
     * @param {string} url
     * @param {?import('display-history').EntryState} state
     * @param {?import('display-history').EntryContent} content
     * @param {?import('display-history').Entry} previous
     * @returns {import('display-history').Entry}
     */
    _createHistoryEntry(id, url, state, content, previous) {
        /** @type {import('display-history').Entry} */
        const entry = {
            id: typeof id === 'string' ? id : this._generateId(),
            url,
            next: null,
            previous,
            state,
            content
        };
        this._historyMap.set(entry.id, entry);
        return entry;
    }

    /**
     * @returns {string}
     */
    _generateId() {
        return generateId(16);
    }

    /** */
    _clear() {
        this._historyMap.clear();
        this._historyMap.set(this._current.id, this._current);
        this._current.next = null;
        this._current.previous = null;
    }
}

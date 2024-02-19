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

import {EventListenerCollection} from '../core/event-listener-collection.js';

/**
 * The content manager which is used when generating HTML display content.
 */
export class DisplayContentManager {
    /**
     * Creates a new instance of the class.
     * @param {import('./display.js').Display} display The display instance that owns this object.
     */
    constructor(display) {
        /** @type {import('./display.js').Display} */
        this._display = display;
        /** @type {import('core').TokenObject} */
        this._token = {};
        /** @type {Map<import('display-content-manager').MediaCacheKey, import('dictionary-database').MediaObject<string>>} */
        this._mediaCache = new Map();
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {import('display-content-manager').LoadMediaRequest[]} */
        this._loadMediaRequests = [];
    }

    /** @type {import('display-content-manager').LoadMediaRequest[]} */
    get loadMediaRequests() {
        return this._loadMediaRequests;
    }

    /**
     * Queues loading media file from a given dictionary.
     * @param {string} path
     * @param {string} dictionary
     * @param {import('display-content-manager').OnLoadCallback} onLoad
     * @param {import('display-content-manager').OnUnloadCallback} onUnload
     */
    loadMedia(path, dictionary, onLoad, onUnload) {
        this._loadMediaRequests.push({path, dictionary, onLoad, onUnload});
    }

    /**
     * Unloads all media that has been loaded.
     */
    unloadAll() {
        for (const mediaObject of this._mediaCache.values()) {
            URL.revokeObjectURL(mediaObject.url);
        }
        this._mediaCache.clear();

        this._token = {};

        this._eventListeners.removeAllEventListeners();

        this._loadMediaRequests = [];
    }

    /**
     * Sets up attributes and events for a link element.
     * @param {HTMLAnchorElement} element The link element.
     * @param {string} href The URL.
     * @param {boolean} internal Whether or not the URL is an internal or external link.
     */
    prepareLink(element, href, internal) {
        element.href = href;
        if (!internal) {
            element.target = '_blank';
            element.rel = 'noreferrer noopener';
        }
        this._eventListeners.addEventListener(element, 'click', this._onLinkClick.bind(this));
    }

    /**
     * Execute media requests
     */
    async executeMediaRequests() {
        /** @type {Map<import('display-content-manager').MediaCacheKey, import('display-content-manager').LoadMediaRequest[]>} */
        const uncachedRequests = new Map();
        for (const request of this._loadMediaRequests) {
            const cacheKey = this._cacheKey(request.path, request.dictionary);
            const mediaObject = this._mediaCache.get(cacheKey);
            if (typeof mediaObject !== 'undefined' && mediaObject !== null) {
                await request.onLoad(mediaObject.url);
            } else {
                const cache = uncachedRequests.get(cacheKey);
                if (typeof cache === 'undefined') {
                    uncachedRequests.set(cacheKey, [request]);
                } else {
                    cache.push(request);
                }
            }
        }

        performance.mark('display-content-manager:executeMediaRequests:getMediaObjects:start');
        const mediaObjects = await this._display.application.api.getMediaObjects([...uncachedRequests.values()].map((r) => ({path: r[0].path, dictionary: r[0].dictionary})));
        performance.mark('display-content-manager:executeMediaRequests:getMediaObjects:end');
        performance.measure('display-content-manager:executeMediaRequests:getMediaObjects', 'display-content-manager:executeMediaRequests:getMediaObjects:start', 'display-content-manager:executeMediaRequests:getMediaObjects:end');
        const promises = [];
        for (const mediaObject of mediaObjects) {
            const cacheKey = this._cacheKey(mediaObject.path, mediaObject.dictionary);
            this._mediaCache.set(cacheKey, mediaObject);
            const requests = uncachedRequests.get(cacheKey);
            if (typeof requests !== 'undefined') {
                for (const request of requests) {
                    promises.push(request.onLoad(mediaObject.url));
                }
            }
        }
        performance.mark('display-content-manager:executeMediaRequests:runCallbacks:start');
        await Promise.allSettled(promises);
        performance.mark('display-content-manager:executeMediaRequests:runCallbacks:end');
        performance.measure('display-content-manager:executeMediaRequests:runCallbacks', 'display-content-manager:executeMediaRequests:runCallbacks:start', 'display-content-manager:executeMediaRequests:runCallbacks:end');
        this._loadMediaRequests = [];
    }

    /**
     *
     * @param {string} path
     * @param {string} dictionary
     * @returns {import('display-content-manager').MediaCacheKey}
     */
    _cacheKey(path, dictionary) {
        return /** @type {import('display-content-manager').MediaCacheKey} */ (path + ':::' + dictionary);
    }

    /**
     * @param {MouseEvent} e
     */
    _onLinkClick(e) {
        const {href} = /** @type {HTMLAnchorElement} */ (e.currentTarget);
        if (typeof href !== 'string') { return; }

        const baseUrl = new URL(location.href);
        const url = new URL(href, baseUrl);
        const internal = (url.protocol === baseUrl.protocol && url.host === baseUrl.host);
        if (!internal) { return; }

        e.preventDefault();

        /** @type {import('display').HistoryParams} */
        const params = {};
        for (const [key, value] of url.searchParams.entries()) {
            params[key] = value;
        }
        this._display.setContent({
            historyMode: 'new',
            focus: false,
            params,
            state: null,
            content: null
        });
    }
}

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
import {ArrayBufferUtil} from '../data/sandbox/array-buffer-util.js';
import {yomitan} from '../yomitan.js';

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
        /** @type {Map<string, Map<string, Promise<?import('display-content-manager').CachedMediaDataLoaded>>>} */
        this._mediaCache = new Map();
        /** @type {import('display-content-manager').LoadMediaDataInfo[]} */
        this._loadMediaData = [];
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
    }

    /**
     * Attempts to load the media file from a given dictionary.
     * @param {string} path The path to the media file in the dictionary.
     * @param {string} dictionary The name of the dictionary.
     * @param {import('display-content-manager').OnLoadCallback} onLoad The callback that is executed if the media was loaded successfully.
     *   No assumptions should be made about the synchronicity of this callback.
     * @param {import('display-content-manager').OnUnloadCallback} onUnload The callback that is executed when the media should be unloaded.
     */
    loadMedia(path, dictionary, onLoad, onUnload) {
        this._loadMedia(path, dictionary, onLoad, onUnload);
    }

    /**
     * Unloads all media that has been loaded.
     */
    unloadAll() {
        for (const {onUnload, loaded} of this._loadMediaData) {
            if (typeof onUnload === 'function') {
                onUnload(loaded);
            }
        }
        this._loadMediaData = [];

        for (const map of this._mediaCache.values()) {
            for (const result of map.values()) {
                this._revokeUrl(result);
            }
        }
        this._mediaCache.clear();

        this._token = {};

        this._eventListeners.removeAllEventListeners();
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
     * @param {string} path
     * @param {string} dictionary
     * @param {import('display-content-manager').OnLoadCallback} onLoad
     * @param {import('display-content-manager').OnUnloadCallback} onUnload
     */
    async _loadMedia(path, dictionary, onLoad, onUnload) {
        const token = this._token;
        const media = await this._getMedia(path, dictionary);
        if (token !== this._token || media === null) { return; }

        /** @type {import('display-content-manager').LoadMediaDataInfo} */
        const data = {onUnload, loaded: false};
        this._loadMediaData.push(data);
        onLoad(media.url);
        data.loaded = true;
    }

    /**
     * @param {string} path
     * @param {string} dictionary
     * @returns {Promise<?import('display-content-manager').CachedMediaDataLoaded>}
     */
    _getMedia(path, dictionary) {
        /** @type {Promise<?import('display-content-manager').CachedMediaDataLoaded>|undefined} */
        let promise;
        let dictionaryCache = this._mediaCache.get(dictionary);
        if (typeof dictionaryCache !== 'undefined') {
            promise = dictionaryCache.get(path);
        } else {
            dictionaryCache = new Map();
            this._mediaCache.set(dictionary, dictionaryCache);
        }

        if (typeof promise === 'undefined') {
            promise = this._getMediaData(path, dictionary);
            dictionaryCache.set(path, promise);
        }

        return promise;
    }

    /**
     * @param {string} path
     * @param {string} dictionary
     * @returns {Promise<?import('display-content-manager').CachedMediaDataLoaded>}
     */
    async _getMediaData(path, dictionary) {
        const token = this._token;
        const datas = await yomitan.api.getMedia([{path, dictionary}]);
        if (token === this._token && datas.length > 0) {
            const data = datas[0];
            const buffer = ArrayBufferUtil.base64ToArrayBuffer(data.content);
            const blob = new Blob([buffer], {type: data.mediaType});
            const url = URL.createObjectURL(blob);
            return {data, url};
        }
        return null;
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

    /**
     * @param {Promise<?import('display-content-manager').CachedMediaDataLoaded>} data
     */
    async _revokeUrl(data) {
        const result = await data;
        if (result === null) { return; }
        URL.revokeObjectURL(result.url);
    }
}

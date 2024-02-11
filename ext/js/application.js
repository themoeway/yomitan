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

import {API} from './comm/api.js';
import {CrossFrameAPI} from './comm/cross-frame-api.js';
import {createApiMap, invokeApiMapHandler} from './core/api-map.js';
import {EventDispatcher} from './core/event-dispatcher.js';
import {ExtensionError} from './core/extension-error.js';
import {Logger} from './core/logger.js';
import {deferPromise} from './core/utilities.js';
import {WebExtension} from './extension/web-extension.js';

/**
 * @returns {boolean}
 */
function checkChromeNotAvailable() {
    let hasChrome = false;
    let hasBrowser = false;
    try {
        hasChrome = (typeof chrome === 'object' && chrome !== null && typeof chrome.runtime !== 'undefined');
    } catch (e) {
        // NOP
    }
    try {
        hasBrowser = (typeof browser === 'object' && browser !== null && typeof browser.runtime !== 'undefined');
    } catch (e) {
        // NOP
    }
    return (hasBrowser && !hasChrome);
}

// Set up chrome alias if it's not available (Edge Legacy)
if (checkChromeNotAvailable()) {
    // @ts-expect-error - objects should have roughly the same interface
    // eslint-disable-next-line no-global-assign
    chrome = browser;
}

/**
 * The Yomitan class is a core component through which various APIs are handled and invoked.
 * @augments EventDispatcher<import('application').Events>
 */
export class Application extends EventDispatcher {
    /**
     * Creates a new instance. The instance should not be used until it has been fully prepare()'d.
     * @param {import('./core/logger.js').Logger} logger
     * @param {API} api
     * @param {CrossFrameAPI} crossFrameApi
     */
    constructor(logger, api, crossFrameApi) {
        super();

        /** @type {WebExtension} */
        this._webExtension = new WebExtension();

        /** @type {string} */
        this._extensionName = 'Yomitan';
        try {
            const manifest = chrome.runtime.getManifest();
            this._extensionName = `${manifest.name} v${manifest.version}`;
        } catch (e) {
            // NOP
        }

        /** @type {?string} */
        this._extensionUrlBase = null;
        try {
            this._extensionUrlBase = this._webExtension.getUrl('/');
        } catch (e) {
            // NOP
        }

        /** @type {?boolean} */
        this._isBackground = null;
        /** @type {API} */
        this._api = api;
        /** @type {CrossFrameAPI} */
        this._crossFrame = crossFrameApi;
        /** @type {boolean} */
        this._isReady = false;
        /** @type {import('./core/logger.js').Logger} */
        this._logger = logger;

        /* eslint-disable @stylistic/no-multi-spaces */
        /** @type {import('application').ApiMap} */
        this._apiMap = createApiMap([
            ['applicationIsReady',         this._onMessageIsReady.bind(this)],
            ['applicationGetUrl',          this._onMessageGetUrl.bind(this)],
            ['applicationOptionsUpdated',  this._onMessageOptionsUpdated.bind(this)],
            ['applicationDatabaseUpdated', this._onMessageDatabaseUpdated.bind(this)],
            ['applicationZoomChanged',     this._onMessageZoomChanged.bind(this)]
        ]);
        /* eslint-enable @stylistic/no-multi-spaces */
    }

    /** @type {WebExtension} */
    get webExtension() {
        return this._webExtension;
    }

    /**
     * Gets the API instance for communicating with the backend.
     * This value will be null on the background page/service worker.
     * @type {API}
     */
    get api() {
        return this._api;
    }

    /**
     * Gets the CrossFrameAPI instance for communicating with different frames.
     * This value will be null on the background page/service worker.
     * @type {CrossFrameAPI}
     */
    get crossFrame() {
        return this._crossFrame;
    }

    /** @type {import('./core/logger.js').Logger} */
    get logger() {
        return this._logger;
    }

    /**
     * Prepares the instance for use.
     */
    prepare() {
        chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
        this._logger.on('log', this._onForwardLog.bind(this));
    }

    /**
     * Sends a message to the backend indicating that the frame is ready and all script
     * setup has completed.
     */
    ready() {
        if (this._isReady) { return; }
        this._isReady = true;
        this._webExtension.sendMessagePromise({action: 'applicationReady'});
    }

    /**
     * Checks whether or not a URL is an extension URL.
     * @param {string} url The URL to check.
     * @returns {boolean} `true` if the URL is an extension URL, `false` otherwise.
     */
    isExtensionUrl(url) {
        return this._extensionUrlBase !== null && url.startsWith(this._extensionUrlBase);
    }

    /** */
    triggerStorageChanged() {
        this.trigger('storageChanged', {});
    }

    /** */
    triggerClosePopups() {
        this.trigger('closePopups', {});
    }

    /**
     * @param {(application: Application) => (Promise<void>)} mainFunction
     */
    static async main(mainFunction) {
        const logger = new Logger();
        const webExtension = new WebExtension();
        const api = new API(webExtension);
        await this.waitForBackendReady(webExtension);
        const {tabId = null, frameId = null} = await api.frameInformationGet();
        const crossFrameApi = new CrossFrameAPI(logger, api, tabId, frameId);
        crossFrameApi.prepare();
        const application = new Application(logger, api, crossFrameApi);
        application.prepare();
        try {
            await mainFunction(application);
        } catch (error) {
            logger.error(error);
        } finally {
            application.ready();
        }
    }

    /**
     * @param {WebExtension} webExtension
     */
    static async waitForBackendReady(webExtension) {
        const {promise, resolve} = /** @type {import('core').DeferredPromiseDetails<void>} */ (deferPromise());
        /** @type {import('application').ApiMap} */
        const apiMap = createApiMap([['applicationBackendReady', () => { resolve(); }]]);
        /** @type {import('extension').ChromeRuntimeOnMessageCallback<import('application').ApiMessageAny>} */
        const onMessage = ({action, params}, _sender, callback) => invokeApiMapHandler(apiMap, action, params, [], callback);
        chrome.runtime.onMessage.addListener(onMessage);
        try {
            await webExtension.sendMessagePromise({action: 'requestBackendReadySignal'});
            await promise;
        } finally {
            chrome.runtime.onMessage.removeListener(onMessage);
        }
    }

    // Private

    /**
     * @returns {string}
     */
    _getUrl() {
        return location.href;
    }

    /** @type {import('extension').ChromeRuntimeOnMessageCallback<import('application').ApiMessageAny>} */
    _onMessage({action, params}, _sender, callback) {
        return invokeApiMapHandler(this._apiMap, action, params, [], callback);
    }

    /** @type {import('application').ApiHandler<'applicationIsReady'>} */
    _onMessageIsReady() {
        return this._isReady;
    }

    /** @type {import('application').ApiHandler<'applicationGetUrl'>} */
    _onMessageGetUrl() {
        return {url: this._getUrl()};
    }

    /** @type {import('application').ApiHandler<'applicationOptionsUpdated'>} */
    _onMessageOptionsUpdated({source}) {
        if (source !== 'background') {
            this.trigger('optionsUpdated', {source});
        }
    }

    /** @type {import('application').ApiHandler<'applicationDatabaseUpdated'>} */
    _onMessageDatabaseUpdated({type, cause}) {
        this.trigger('databaseUpdated', {type, cause});
    }

    /** @type {import('application').ApiHandler<'applicationZoomChanged'>} */
    _onMessageZoomChanged({oldZoomFactor, newZoomFactor}) {
        this.trigger('zoomChanged', {oldZoomFactor, newZoomFactor});
    }

    /**
     * @param {{error: unknown, level: import('log').LogLevel, context?: import('log').LogContext}} params
     */
    async _onForwardLog({error, level, context}) {
        try {
            const api = /** @type {API} */ (this._api);
            await api.log(ExtensionError.serialize(error), level, context);
        } catch (e) {
            // NOP
        }
    }
}

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

import {generateId} from '../core/utilities.js';
import {yomitan} from '../yomitan.js';

/**
 * This class is used to return the ancestor frame IDs for the current frame.
 * This is a workaround to using the `webNavigation.getAllFrames` API, which
 * would require an additional permission that is otherwise unnecessary.
 * It is also used to track the correlation between child frame elements and their IDs.
 */
export class FrameAncestryHandler {
    /**
     * Creates a new instance.
     * @param {number} frameId The frame ID of the current frame the instance is instantiated in.
     */
    constructor(frameId) {
        /** @type {number} */
        this._frameId = frameId;
        /** @type {boolean} */
        this._isPrepared = false;
        /** @type {string} */
        this._requestMessageId = 'FrameAncestryHandler.requestFrameInfo';
        /** @type {?Promise<number[]>} */
        this._getFrameAncestryInfoPromise = null;
        /** @type {Map<number, {window: Window, frameElement: ?(undefined|Element)}>} */
        this._childFrameMap = new Map();
        /** @type {Map<string, import('frame-ancestry-handler').ResponseHandler>} */
        this._responseHandlers = new Map();
    }

    /**
     * Gets the frame ID that the instance is instantiated in.
     * @type {number}
     */
    get frameId() {
        return this._frameId;
    }

    /**
     * Initializes event event listening.
     */
    prepare() {
        if (this._isPrepared) { return; }
        window.addEventListener('message', this._onWindowMessage.bind(this), false);
        yomitan.crossFrame.registerHandlers([
            ['frameAncestryHandlerRequestFrameInfoResponse', this._onFrameAncestryHandlerRequestFrameInfoResponse.bind(this)]
        ]);
        this._isPrepared = true;
    }

    /**
     * Returns whether or not this frame is the root frame in the tab.
     * @returns {boolean} `true` if it is the root, otherwise `false`.
     */
    isRootFrame() {
        return (window === window.parent);
    }

    /**
     * Gets the frame ancestry information for the current frame. If the frame is the
     * root frame, an empty array is returned. Otherwise, an array of frame IDs is returned,
     * starting from the nearest ancestor.
     * @returns {Promise<number[]>} An array of frame IDs corresponding to the ancestors of the current frame.
     */
    async getFrameAncestryInfo() {
        if (this._getFrameAncestryInfoPromise === null) {
            this._getFrameAncestryInfoPromise = this._getFrameAncestryInfo(5000);
        }
        return await this._getFrameAncestryInfoPromise;
    }

    /**
     * Gets the frame element of a child frame given a frame ID.
     * For this function to work, the `getFrameAncestryInfo` function needs to have
     * been invoked previously.
     * @param {number} frameId The frame ID of the child frame to get.
     * @returns {?Element} The element corresponding to the frame with ID `frameId`, otherwise `null`.
     */
    getChildFrameElement(frameId) {
        const frameInfo = this._childFrameMap.get(frameId);
        if (typeof frameInfo === 'undefined') { return null; }

        let {frameElement} = frameInfo;
        if (typeof frameElement === 'undefined') {
            frameElement = this._findFrameElementWithContentWindow(frameInfo.window);
            frameInfo.frameElement = frameElement;
        }

        return frameElement;
    }

    // Private

    /**
     * @param {number} [timeout]
     * @returns {Promise<number[]>}
     */
    _getFrameAncestryInfo(timeout = 5000) {
        return new Promise((resolve, reject) => {
            const targetWindow = window.parent;
            if (window === targetWindow) {
                resolve([]);
                return;
            }

            const uniqueId = generateId(16);
            let nonce = generateId(16);
            /** @type {number[]} */
            const results = [];
            /** @type {?import('core').Timeout} */
            let timer = null;

            const cleanup = () => {
                if (timer !== null) {
                    clearTimeout(timer);
                    timer = null;
                }
                this._removeResponseHandler(uniqueId);
            };
            /** @type {import('frame-ancestry-handler').ResponseHandler} */
            const onMessage = (params) => {
                if (params.nonce !== nonce) { return null; }

                // Add result
                const {frameId, more} = params;
                results.push(frameId);
                nonce = generateId(16);

                if (!more) {
                    // Cleanup
                    cleanup();

                    // Finish
                    resolve(results);
                }
                return {nonce};
            };
            const onTimeout = () => {
                timer = null;
                cleanup();
                reject(new Error(`Request for parent frame ID timed out after ${timeout}ms`));
            };
            const resetTimeout = () => {
                if (timer !== null) { clearTimeout(timer); }
                timer = setTimeout(onTimeout, timeout);
            };

            // Start
            this._addResponseHandler(uniqueId, onMessage);
            resetTimeout();
            const frameId = this._frameId;
            this._requestFrameInfo(targetWindow, frameId, frameId, uniqueId, nonce);
        });
    }

    /**
     * @param {MessageEvent<unknown>} event
     */
    _onWindowMessage(event) {
        const source = /** @type {?Window} */ (event.source);
        if (source === null || source === window || source.parent !== window) { return; }

        const {data} = event;
        if (typeof data !== 'object' || data === null) { return; }

        const {action} = /** @type {import('core').SerializableObject} */ (data);
        if (action !== this._requestMessageId) { return; }

        const {params} = /** @type {import('core').SerializableObject} */ (data);
        if (typeof params !== 'object' || params === null) { return; }

        this._onRequestFrameInfo(/** @type {import('core').SerializableObject} */ (params), source);
    }

    /**
     * @param {import('core').SerializableObject} params
     * @param {Window} source
     */
    async _onRequestFrameInfo(params, source) {
        try {
            let {originFrameId, childFrameId, uniqueId, nonce} = params;
            if (
                typeof originFrameId !== 'number' ||
                typeof childFrameId !== 'number' ||
                !this._isNonNegativeInteger(originFrameId) ||
                typeof uniqueId !== 'string' ||
                typeof nonce !== 'string'
            ) {
                return;
            }

            const frameId = this._frameId;
            const {parent} = window;
            const more = (window !== parent);

            try {
                const response = await yomitan.crossFrame.invoke(originFrameId, 'frameAncestryHandlerRequestFrameInfoResponse', {uniqueId, frameId, nonce, more});
                if (response === null) { return; }
                const nonce2 = response.nonce;
                if (typeof nonce2 !== 'string') { return; }
                nonce = nonce2;
            } catch (e) {
                return;
            }

            if (!this._childFrameMap.has(childFrameId)) {
                this._childFrameMap.set(childFrameId, {window: source, frameElement: void 0});
            }

            if (more) {
                this._requestFrameInfo(parent, originFrameId, frameId, uniqueId, /** @type {string} */ (nonce));
            }
        } catch (e) {
            // NOP
        }
    }

    /**
     * @param {Window} targetWindow
     * @param {number} originFrameId
     * @param {number} childFrameId
     * @param {string} uniqueId
     * @param {string} nonce
     */
    _requestFrameInfo(targetWindow, originFrameId, childFrameId, uniqueId, nonce) {
        targetWindow.postMessage({
            action: this._requestMessageId,
            params: {originFrameId, childFrameId, uniqueId, nonce}
        }, '*');
    }

    /**
     * @param {number} value
     * @returns {boolean}
     */
    _isNonNegativeInteger(value) {
        return (
            Number.isFinite(value) &&
            value >= 0 &&
            Math.floor(value) === value
        );
    }

    /**
     * @param {Window} contentWindow
     * @returns {?Element}
     */
    _findFrameElementWithContentWindow(contentWindow) {
        // Check frameElement, for non-null same-origin frames
        try {
            const {frameElement} = contentWindow;
            if (frameElement !== null) { return frameElement; }
        } catch (e) {
            // NOP
        }

        // Check frames
        const frameTypes = ['iframe', 'frame', 'object'];
        for (const frameType of frameTypes) {
            for (const frame of /** @type {HTMLCollectionOf<import('extension').HtmlElementWithContentWindow>} */ (document.getElementsByTagName(frameType))) {
                if (frame.contentWindow === contentWindow) {
                    return frame;
                }
            }
        }

        // Check for shadow roots
        /** @type {Node[]} */
        const rootElements = [document.documentElement];
        while (rootElements.length > 0) {
            const rootElement = /** @type {Node} */ (rootElements.shift());
            const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT);
            while (walker.nextNode()) {
                const element = /** @type {Element} */ (walker.currentNode);

                // @ts-expect-error - this is more simple to elide any type checks or casting
                if (element.contentWindow === contentWindow) {
                    return element;
                }

                /** @type {?ShadowRoot|undefined} */
                const shadowRoot = (
                    element.shadowRoot ||
                    // @ts-expect-error - openOrClosedShadowRoot is available to Firefox 63+ for WebExtensions
                    element.openOrClosedShadowRoot
                );
                if (shadowRoot) {
                    rootElements.push(shadowRoot);
                }
            }
        }

        // Not found
        return null;
    }

    /**
     * @param {string} id
     * @param {import('frame-ancestry-handler').ResponseHandler} handler
     * @throws {Error}
     */
    _addResponseHandler(id, handler) {
        if (this._responseHandlers.has(id)) { throw new Error('Identifier already used'); }
        this._responseHandlers.set(id, handler);
    }

    /**
     * @param {string} id
     */
    _removeResponseHandler(id) {
        this._responseHandlers.delete(id);
    }

    /** @type {import('cross-frame-api').ApiHandler<'frameAncestryHandlerRequestFrameInfoResponse'>} */
    _onFrameAncestryHandlerRequestFrameInfoResponse(params) {
        const handler = this._responseHandlers.get(params.uniqueId);
        return typeof handler !== 'undefined' ? handler(params) : null;
    }
}

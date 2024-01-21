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

import {generateId} from '../core/utilities.js';
import {ExtensionError} from '../core/extension-error.js';

export class TemplateRendererProxy {
    constructor() {
        /** @type {?HTMLIFrameElement} */
        this._frame = null;
        /** @type {boolean} */
        this._frameNeedsLoad = true;
        /** @type {boolean} */
        this._frameLoading = false;
        /** @type {?Promise<void>} */
        this._frameLoadPromise = null;
        /** @type {string} */
        this._frameUrl = chrome.runtime.getURL('/template-renderer.html');
        /** @type {Set<{cancel: () => void}>} */
        this._invocations = new Set();
    }

    /**
     * @param {string} template
     * @param {import('template-renderer').PartialOrCompositeRenderData} data
     * @param {import('anki-templates').RenderMode} type
     * @returns {Promise<import('template-renderer').RenderResult>}
     */
    async render(template, data, type) {
        await this._prepareFrame();
        return await this._invoke('render', {template, data, type});
    }

    /**
     * @param {import('template-renderer').RenderMultiItem[]} items
     * @returns {Promise<import('core').Response<import('template-renderer').RenderResult>[]>}
     */
    async renderMulti(items) {
        await this._prepareFrame();
        return await this._invoke('renderMulti', {items});
    }

    /**
     * @param {import('template-renderer').CompositeRenderData} data
     * @param {import('anki-templates').RenderMode} type
     * @returns {Promise<import('anki-templates').NoteData>}
     */
    async getModifiedData(data, type) {
        await this._prepareFrame();
        return await this._invoke('getModifiedData', {data, type});
    }

    // Private

    /**
     * @returns {Promise<void>}
     */
    async _prepareFrame() {
        if (this._frame === null) {
            this._frame = document.createElement('iframe');
            this._frame.addEventListener('load', this._onFrameLoad.bind(this), false);
            const style = this._frame.style;
            style.opacity = '0';
            style.width = '0';
            style.height = '0';
            style.position = 'absolute';
            style.border = '0';
            style.margin = '0';
            style.padding = '0';
            style.pointerEvents = 'none';
        }
        if (this._frameNeedsLoad) {
            this._frameNeedsLoad = false;
            this._frameLoading = true;
            this._frameLoadPromise = this._loadFrame(this._frame, this._frameUrl)
                .finally(() => { this._frameLoading = false; });
        }
        await this._frameLoadPromise;
    }

    /**
     * @param {HTMLIFrameElement} frame
     * @param {string} url
     * @param {number} [timeout]
     * @returns {Promise<void>}
     */
    _loadFrame(frame, url, timeout = 5000) {
        return new Promise((resolve, reject) => {
            let state = 0x0; // 0x1 = frame added; 0x2 = frame loaded; 0x4 = frame ready
            const cleanup = () => {
                frame.removeEventListener('load', onLoad, false);
                window.removeEventListener('message', onWindowMessage, false);
                if (timer !== null) {
                    clearTimeout(timer);
                    timer = null;
                }
            };
            /**
             * @param {number} flags
             */
            const updateState = (flags) => {
                state |= flags;
                if (state !== 0x7) { return; }
                cleanup();
                resolve();
            };
            const onLoad = () => {
                if ((state & 0x3) !== 0x1) { return; }
                updateState(0x2);
            };
            /**
             * @param {MessageEvent<import('template-renderer-proxy').BackendMessageAny>} e
             */
            const onWindowMessage = (e) => {
                if ((state & 0x5) !== 0x1) { return; }
                const frameWindow = frame.contentWindow;
                if (frameWindow === null || frameWindow !== e.source) { return; }
                const {data} = e;
                if (!(typeof data === 'object' && data !== null && data.action === 'ready')) { return; }
                updateState(0x4);
            };

            /** @type {?number} */
            let timer = window.setTimeout(() => {
                timer = null;
                cleanup();
                reject(new Error('Timeout'));
            }, timeout);

            frame.removeAttribute('src');
            frame.removeAttribute('srcdoc');
            frame.addEventListener('load', onLoad, false);
            window.addEventListener('message', onWindowMessage, false);
            try {
                document.body.appendChild(frame);
                state = 0x1;
                const {contentDocument} = frame;
                if (contentDocument === null) { throw new Error('Failed to initialize frame URL'); }
                contentDocument.location.href = url;
            } catch (e) {
                cleanup();
                reject(e);
            }
        });
    }

    /**
     * @template {import('template-renderer-proxy').FrontendApiNames} TName
     * @param {TName} action
     * @param {import('template-renderer-proxy').FrontendApiParams<TName>} params
     * @param {?number} [timeout]
     * @returns {Promise<import('template-renderer-proxy').FrontendApiReturn<TName>>}
     */
    _invoke(action, params, timeout = null) {
        return new Promise((resolve, reject) => {
            const frameWindow = (this._frame !== null ? this._frame.contentWindow : null);
            if (frameWindow === null) {
                reject(new Error('Frame not set up'));
                return;
            }

            const id = generateId(16);
            const invocation = {
                cancel: () => {
                    cleanup();
                    reject(new Error('Terminated'));
                }
            };

            const cleanup = () => {
                this._invocations.delete(invocation);
                window.removeEventListener('message', onMessage, false);
                if (timer !== null) {
                    clearTimeout(timer);
                    timer = null;
                }
            };

            /**
             * @param {MessageEvent<import('template-renderer-proxy').BackendMessageAny>} event
             */
            const onMessage = (event) => {
                if (event.source !== frameWindow) { return; }
                const {data} = event;
                if (
                    typeof data !== 'object' ||
                    data === null ||
                    data.id !== id ||
                    data.action !== 'response'
                ) {
                    return;
                }

                // This type should probably be able to be inferred without a cast, but for some reason it isn't.
                const responseData = /** @type {import('template-renderer-proxy').BackendMessage<'response'>} */ (data);
                const response = responseData.params;
                if (typeof response !== 'object' || response === null) { return; }

                cleanup();
                const {error} = response;
                if (error) {
                    reject(ExtensionError.deserialize(error));
                } else {
                    resolve(/** @type {import('template-renderer-proxy').FrontendApiReturn<TName>} */ (response.result));
                }
            };

            let timer = (typeof timeout === 'number' ? setTimeout(() => {
                cleanup();
                reject(new Error('Timeout'));
            }, timeout) : null);

            this._invocations.add(invocation);

            window.addEventListener('message', onMessage, false);
            /** @type {import('template-renderer-proxy').FrontendMessage<TName>} */
            const requestMessage = {action, params, id};
            frameWindow.postMessage(requestMessage, '*');
        });
    }

    /**
     * @returns {void}
     */
    _onFrameLoad() {
        if (this._frameLoading) { return; }
        this._frameNeedsLoad = true;

        for (const invocation of this._invocations) {
            invocation.cancel();
        }
        this._invocations.clear();
    }
}

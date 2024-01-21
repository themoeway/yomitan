/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2022  Yomichan Authors
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

import {Environment} from '../../extension/environment.js';

export class ExtensionContentController {
    /** */
    prepare() {
        this._prepareSpecialUrls();
        this._prepareExtensionIdExamples();
        this._prepareEnvironmentInfo();
    }

    // Private

    /** */
    async _prepareEnvironmentInfo() {
        const {dataset} = document.documentElement;
        const {manifest_version: manifestVersion} = chrome.runtime.getManifest();
        dataset.manifestVersion = `${manifestVersion}`;

        const environment = new Environment();
        await environment.prepare();

        const {browser, platform} = environment.getInfo();
        dataset.browser = browser;
        dataset.os = platform.os;
    }

    /** */
    _prepareExtensionIdExamples() {
        const nodes = document.querySelectorAll('.extension-id-example');
        let url = '';
        try {
            url = chrome.runtime.getURL('/');
        } catch (e) {
            // NOP
        }
        for (const node of nodes) {
            node.textContent = url;
        }
    }

    /** */
    _prepareSpecialUrls() {
        const nodes = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-special-url]'));
        if (nodes.length === 0) { return; }

        let extensionId = '';
        try {
            extensionId = chrome.runtime.id;
        } catch (e) {
            // NOP
        }

        const idPattern = /\{id\}/g;
        const onSpecialUrlLinkClick = this._onSpecialUrlLinkClick.bind(this);
        const onSpecialUrlLinkMouseDown = this._onSpecialUrlLinkMouseDown.bind(this);
        for (const node of nodes) {
            let {specialUrl} = node.dataset;
            if (typeof specialUrl !== 'string') { specialUrl = ''; }
            node.dataset.specialUrl = specialUrl.replace(idPattern, extensionId);
            node.addEventListener('click', onSpecialUrlLinkClick, false);
            node.addEventListener('auxclick', onSpecialUrlLinkClick, false);
            node.addEventListener('mousedown', onSpecialUrlLinkMouseDown, false);
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onSpecialUrlLinkClick(e) {
        switch (e.button) {
            case 0:
            case 1:
                {
                    const element = /** @type {HTMLElement} */ (e.currentTarget);
                    const {specialUrl} = element.dataset;
                    if (typeof specialUrl !== 'string') { return; }
                    e.preventDefault();
                    this._createTab(specialUrl, true);
                }
                break;
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onSpecialUrlLinkMouseDown(e) {
        switch (e.button) {
            case 0:
            case 1:
                e.preventDefault();
                break;
        }
    }

    /**
     * @param {string} url
     * @param {boolean} useOpener
     * @returns {Promise<chrome.tabs.Tab>}
     */
    async _createTab(url, useOpener) {
        /** @type {number|undefined} */
        let openerTabId;
        if (useOpener) {
            try {
                /** @type {chrome.tabs.Tab|undefined} */
                const tab = await new Promise((resolve, reject) => {
                    chrome.tabs.getCurrent((result) => {
                        const e = chrome.runtime.lastError;
                        if (e) {
                            reject(new Error(e.message));
                        } else {
                            resolve(result);
                        }
                    });
                });
                if (typeof tab !== 'undefined') {
                    openerTabId = tab.id;
                }
            } catch (e) {
                // NOP
            }
        }

        return await new Promise((resolve, reject) => {
            chrome.tabs.create({url, openerTabId}, (tab2) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve(tab2);
                }
            });
        });
    }
}

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

import {FrameOffsetForwarder} from '../comm/frame-offset-forwarder.js';
import {generateId} from '../core/utilities.js';
import {yomitan} from '../yomitan.js';
import {PopupProxy} from './popup-proxy.js';
import {PopupWindow} from './popup-window.js';
import {Popup} from './popup.js';

/**
 * A class which is used to generate and manage popups.
 */
export class PopupFactory {
    /**
     * Creates a new instance.
     * @param {number} frameId The frame ID of the host frame.
     */
    constructor(frameId) {
        /** @type {number} */
        this._frameId = frameId;
        /** @type {FrameOffsetForwarder} */
        this._frameOffsetForwarder = new FrameOffsetForwarder(frameId);
        /** @type {Map<string, import('popup').PopupAny>} */
        this._popups = new Map();
        /** @type {Map<string, {popup: import('popup').PopupAny, token: string}[]>} */
        this._allPopupVisibilityTokenMap = new Map();
    }

    /**
     * Prepares the instance for use.
     */
    prepare() {
        this._frameOffsetForwarder.prepare();
        /* eslint-disable no-multi-spaces */
        yomitan.crossFrame.registerHandlers([
            ['popupFactoryGetOrCreatePopup',     this._onApiGetOrCreatePopup.bind(this)],
            ['popupFactorySetOptionsContext',    this._onApiSetOptionsContext.bind(this)],
            ['popupFactoryHide',                 this._onApiHide.bind(this)],
            ['popupFactoryIsVisible',            this._onApiIsVisibleAsync.bind(this)],
            ['popupFactorySetVisibleOverride',   this._onApiSetVisibleOverride.bind(this)],
            ['popupFactoryClearVisibleOverride', this._onApiClearVisibleOverride.bind(this)],
            ['popupFactoryContainsPoint',        this._onApiContainsPoint.bind(this)],
            ['popupFactoryShowContent',          this._onApiShowContent.bind(this)],
            ['popupFactorySetCustomCss',         this._onApiSetCustomCss.bind(this)],
            ['popupFactoryClearAutoPlayTimer',   this._onApiClearAutoPlayTimer.bind(this)],
            ['popupFactorySetContentScale',      this._onApiSetContentScale.bind(this)],
            ['popupFactoryUpdateTheme',          this._onApiUpdateTheme.bind(this)],
            ['popupFactorySetCustomOuterCss',    this._onApiSetCustomOuterCss.bind(this)],
            ['popupFactoryGetFrameSize',         this._onApiGetFrameSize.bind(this)],
            ['popupFactorySetFrameSize',         this._onApiSetFrameSize.bind(this)]
        ]);
        /* eslint-enable no-multi-spaces */
    }

    /**
     * Gets or creates a popup based on a set of parameters
     * @param {import('popup-factory').GetOrCreatePopupDetails} details Details about how to acquire the popup.
     * @returns {Promise<import('popup').PopupAny>}
     */
    async getOrCreatePopup({
        frameId = null,
        id = null,
        parentPopupId = null,
        depth = null,
        popupWindow = false,
        childrenSupported = false
    }) {
        // Find by existing id
        if (id !== null) {
            const popup = this._popups.get(id);
            if (typeof popup !== 'undefined') {
                return popup;
            }
        }

        // Find by existing parent id
        let parent = null;
        if (parentPopupId !== null) {
            parent = this._popups.get(parentPopupId);
            if (typeof parent !== 'undefined') {
                const popup = parent.child;
                if (popup !== null) {
                    return popup;
                }
            } else {
                parent = null;
            }
        }

        // Depth
        if (parent !== null) {
            if (depth !== null) {
                throw new Error('Depth cannot be set when parent exists');
            }
            depth = parent.depth + 1;
        } else if (depth === null) {
            depth = 0;
        }

        if (popupWindow) {
            // New unique id
            if (id === null) {
                id = generateId(16);
            }
            const popup = new PopupWindow({
                id,
                depth,
                frameId: this._frameId
            });
            this._popups.set(id, popup);
            return popup;
        } else if (frameId === this._frameId) {
            // New unique id
            if (id === null) {
                id = generateId(16);
            }
            const popup = new Popup({
                id,
                depth,
                frameId: this._frameId,
                childrenSupported
            });
            if (parent !== null) {
                if (parent.child !== null) {
                    throw new Error('Parent popup already has a child');
                }
                popup.parent = /** @type {Popup} */ (parent);
                parent.child = popup;
            }
            this._popups.set(id, popup);
            popup.prepare();
            return popup;
        } else {
            if (frameId === null) {
                throw new Error('Invalid frameId');
            }
            const useFrameOffsetForwarder = (parentPopupId === null);
            /** @type {{id: string, depth: number, frameId: number}} */
            const info = await yomitan.crossFrame.invoke(frameId, 'popupFactoryGetOrCreatePopup', /** @type {import('popup-factory').GetOrCreatePopupDetails} */ ({
                id,
                parentPopupId,
                frameId,
                childrenSupported
            }));
            id = info.id;
            const popup = new PopupProxy({
                id,
                depth: info.depth,
                frameId: info.frameId,
                frameOffsetForwarder: useFrameOffsetForwarder ? this._frameOffsetForwarder : null
            });
            this._popups.set(id, popup);
            return popup;
        }
    }

    /**
     * Force all popups to have a specific visibility value.
     * @param {boolean} value Whether or not the popups should be visible.
     * @param {number} priority The priority of the override.
     * @returns {Promise<import('core').TokenString>} A token which can be passed to clearAllVisibleOverride.
     * @throws An exception is thrown if any popup fails to have its visibiltiy overridden.
     */
    async setAllVisibleOverride(value, priority) {
        const promises = [];
        for (const popup of this._popups.values()) {
            const promise = this._setPopupVisibleOverrideReturnTuple(popup, value, priority);
            promises.push(promise);
        }

        /** @type {undefined|unknown} */
        let error = void 0;
        /** @type {{popup: import('popup').PopupAny, token: string}[]} */
        const results = [];
        for (const promise of promises) {
            try {
                const {popup, token} = await promise;
                if (token !== null) {
                    results.push({popup, token});
                }
            } catch (e) {
                if (typeof error === 'undefined') {
                    error = new Error(`Failed to set popup visibility override: ${e}`);
                }
            }
        }

        if (typeof error === 'undefined') {
            const token = generateId(16);
            this._allPopupVisibilityTokenMap.set(token, results);
            return token;
        }

        // Revert on error
        await this._revertPopupVisibilityOverrides(results);
        throw error;
    }

    /**
     * @param {import('popup').PopupAny} popup
     * @param {boolean} value
     * @param {number} priority
     * @returns {Promise<{popup: import('popup').PopupAny, token: ?string}>}
     */
    async _setPopupVisibleOverrideReturnTuple(popup, value, priority) {
        const token = await popup.setVisibleOverride(value, priority);
        return {popup, token};
    }

    /**
     * Clears a visibility override that was generated by `setAllVisibleOverride`.
     * @param {import('core').TokenString} token The token returned from `setAllVisibleOverride`.
     * @returns {Promise<boolean>} `true` if the override existed and was removed, `false` otherwise.
     */
    async clearAllVisibleOverride(token) {
        const results = this._allPopupVisibilityTokenMap.get(token);
        if (typeof results === 'undefined') { return false; }

        this._allPopupVisibilityTokenMap.delete(token);
        await this._revertPopupVisibilityOverrides(results);
        return true;
    }

    // API message handlers

    /** @type {import('cross-frame-api').ApiHandler<'popupFactoryGetOrCreatePopup'>} */
    async _onApiGetOrCreatePopup(details) {
        const popup = await this.getOrCreatePopup(details);
        return {
            id: popup.id,
            depth: popup.depth,
            frameId: popup.frameId
        };
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactorySetOptionsContext'>} */
    async _onApiSetOptionsContext({id, optionsContext}) {
        const popup = this._getPopup(id);
        await popup.setOptionsContext(optionsContext);
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactoryHide'>} */
    async _onApiHide({id, changeFocus}) {
        const popup = this._getPopup(id);
        await popup.hide(changeFocus);
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactoryIsVisible'>} */
    async _onApiIsVisibleAsync({id}) {
        const popup = this._getPopup(id);
        return await popup.isVisible();
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactorySetVisibleOverride'>} */
    async _onApiSetVisibleOverride({id, value, priority}) {
        const popup = this._getPopup(id);
        return await popup.setVisibleOverride(value, priority);
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactoryClearVisibleOverride'>} */
    async _onApiClearVisibleOverride({id, token}) {
        const popup = this._getPopup(id);
        return await popup.clearVisibleOverride(token);
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactoryContainsPoint'>} */
    async _onApiContainsPoint({id, x, y}) {
        const popup = this._getPopup(id);
        const offset = this._getPopupOffset(popup);
        x += offset.x;
        y += offset.y;
        return await popup.containsPoint(x, y);
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactoryShowContent'>} */
    async _onApiShowContent({id, details, displayDetails}) {
        const popup = this._getPopup(id);
        if (!this._popupCanShow(popup)) { return; }

        const offset = this._getPopupOffset(popup);
        const {sourceRects} = details;
        for (const sourceRect of sourceRects) {
            sourceRect.left += offset.x;
            sourceRect.top += offset.y;
            sourceRect.right += offset.x;
            sourceRect.bottom += offset.y;
        }

        return await popup.showContent(details, displayDetails);
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactorySetCustomCss'>} */
    async _onApiSetCustomCss({id, css}) {
        const popup = this._getPopup(id);
        await popup.setCustomCss(css);
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactoryClearAutoPlayTimer'>} */
    async _onApiClearAutoPlayTimer({id}) {
        const popup = this._getPopup(id);
        await popup.clearAutoPlayTimer();
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactorySetContentScale'>} */
    async _onApiSetContentScale({id, scale}) {
        const popup = this._getPopup(id);
        await popup.setContentScale(scale);
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactoryUpdateTheme'>} */
    async _onApiUpdateTheme({id}) {
        const popup = this._getPopup(id);
        await popup.updateTheme();
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactorySetCustomOuterCss'>} */
    async _onApiSetCustomOuterCss({id, css, useWebExtensionApi}) {
        const popup = this._getPopup(id);
        await popup.setCustomOuterCss(css, useWebExtensionApi);
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactoryGetFrameSize'>} */
    async _onApiGetFrameSize({id}) {
        const popup = this._getPopup(id);
        return await popup.getFrameSize();
    }

    /** @type {import('cross-frame-api').ApiHandler<'popupFactorySetFrameSize'>} */
    async _onApiSetFrameSize({id, width, height}) {
        const popup = this._getPopup(id);
        return await popup.setFrameSize(width, height);
    }

    // Private functions

    /**
     * @param {string} id
     * @returns {import('popup').PopupAny}
     * @throws {Error}
     */
    _getPopup(id) {
        const popup = this._popups.get(id);
        if (typeof popup === 'undefined') {
            throw new Error(`Invalid popup ID ${id}`);
        }
        return popup;
    }

    /**
     * @param {import('popup').PopupAny} popup
     * @returns {{x: number, y: number}}
     */
    _getPopupOffset(popup) {
        const {parent} = popup;
        if (parent !== null) {
            const popupRect = parent.getFrameRect();
            if (popupRect.valid) {
                return {x: popupRect.left, y: popupRect.top};
            }
        }
        return {x: 0, y: 0};
    }

    /**
     * @param {import('popup').PopupAny} popup
     * @returns {boolean}
     */
    _popupCanShow(popup) {
        const parent = popup.parent;
        return parent === null || parent.isVisibleSync();
    }

    /**
     * @param {{popup: import('popup').PopupAny, token: string}[]} overrides
     * @returns {Promise<boolean[]>}
     */
    async _revertPopupVisibilityOverrides(overrides) {
        const promises = [];
        for (const value of overrides) {
            if (value === null) { continue; }
            const {popup, token} = value;
            const promise = popup.clearVisibleOverride(token)
                .then(
                    (v) => v,
                    () => false
                );
            promises.push(promise);
        }
        return await Promise.all(promises);
    }
}

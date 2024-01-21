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

import {isObject} from '../core/utilities.js';
import {parseJson} from '../core/json.js';
import {yomitan} from '../yomitan.js';
import {HotkeyUtil} from './hotkey-util.js';

export class HotkeyHelpController {
    constructor() {
        /** @type {HotkeyUtil} */
        this._hotkeyUtil = new HotkeyUtil();
        /** @type {Map<string, string>} */
        this._localActionHotkeys = new Map();
        /** @type {Map<string, string>} */
        this._globalActionHotkeys = new Map();
        /** @type {RegExp} */
        this._replacementPattern = /\{0\}/g;
    }

    /**
     * @returns {Promise<void>}
     */
    async prepare() {
        const {platform: {os}} = await yomitan.api.getEnvironmentInfo();
        this._hotkeyUtil.os = os;
        await this._setupGlobalCommands(this._globalActionHotkeys);
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    setOptions(options) {
        const hotkeys = options.inputs.hotkeys;
        const hotkeyMap = this._localActionHotkeys;
        hotkeyMap.clear();
        for (const {enabled, action, key, modifiers} of hotkeys) {
            if (!enabled || key === null || action === '' || hotkeyMap.has(action)) { continue; }
            hotkeyMap.set(action, this._hotkeyUtil.getInputDisplayValue(key, modifiers));
        }
    }

    /**
     * @param {ParentNode} node
     */
    setupNode(node) {
        const replacementPattern = this._replacementPattern;
        for (const node2 of /** @type {NodeListOf<HTMLElement>} */ (node.querySelectorAll('[data-hotkey]'))) {
            const info = this._getNodeInfo(node2);
            if (info === null) { continue; }
            const {action, global, attributes, values, defaultAttributeValues} = info;
            const multipleValues = Array.isArray(values);
            const hotkey = (global ? this._globalActionHotkeys : this._localActionHotkeys).get(action);
            for (let i = 0, ii = attributes.length; i < ii; ++i) {
                const attribute = attributes[i];
                let value;
                if (typeof hotkey !== 'undefined') {
                    value = /** @type {unknown} */ (multipleValues ? values[i] : values);
                    if (typeof value === 'string') {
                        value = value.replace(replacementPattern, hotkey);
                    }
                } else {
                    value = defaultAttributeValues[i];
                }

                if (typeof value === 'string') {
                    node2.setAttribute(attribute, value);
                } else {
                    node2.removeAttribute(attribute);
                }
            }
        }
    }

    // Private

    /**
     * @param {Map<string, string>} commandMap
     */
    async _setupGlobalCommands(commandMap) {
        const commands = await new Promise((resolve, reject) => {
            if (!(isObject(chrome.commands) && typeof chrome.commands.getAll === 'function')) {
                resolve([]);
                return;
            }

            chrome.commands.getAll((result) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve(result);
                }
            });
        });

        commandMap.clear();
        for (const {name, shortcut} of commands) {
            if (shortcut.length === 0) { continue; }
            const {key, modifiers} = this._hotkeyUtil.convertCommandToInput(shortcut);
            commandMap.set(name, this._hotkeyUtil.getInputDisplayValue(key, modifiers));
        }
    }

    /**
     * @param {HTMLElement} node
     * @param {unknown[]} data
     * @param {string[]} attributes
     * @returns {unknown[]}
     */
    _getDefaultAttributeValues(node, data, attributes) {
        if (data.length > 3) {
            const result = data[3];
            if (Array.isArray(result)) {
                return result;
            }
        }

        /** @type {(?string)[]} */
        const defaultAttributeValues = [];
        for (let i = 0, ii = attributes.length; i < ii; ++i) {
            const attribute = attributes[i];
            const value = node.hasAttribute(attribute) ? node.getAttribute(attribute) : null;
            defaultAttributeValues.push(value);
        }
        data[3] = defaultAttributeValues;
        node.dataset.hotkey = JSON.stringify(data);
        return defaultAttributeValues;
    }

    /**
     * @param {HTMLElement} node
     * @returns {?{action: string, global: boolean, attributes: string[], values: unknown, defaultAttributeValues: unknown[]}}
     */
    _getNodeInfo(node) {
        const {hotkey} = node.dataset;
        if (typeof hotkey !== 'string') { return null; }
        const data = /** @type {unknown} */ (parseJson(hotkey));
        if (!Array.isArray(data)) { return null; }
        const [action, attributes, values] = data;
        if (typeof action !== 'string') { return null; }
        /** @type {string[]} */
        const attributesArray = [];
        if (Array.isArray(attributes)) {
            for (const item of attributes) {
                if (typeof item !== 'string') { continue; }
                attributesArray.push(item);
            }
        } else if (typeof attributes === 'string') {
            attributesArray.push(attributes);
        }
        const defaultAttributeValues = this._getDefaultAttributeValues(node, data, attributesArray);
        const globalPrexix = 'global:';
        const global = action.startsWith(globalPrexix);
        return {
            action: global ? action.substring(globalPrexix.length) : action,
            global,
            attributes,
            values,
            defaultAttributeValues
        };
    }
}

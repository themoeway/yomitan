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

import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {isObject} from '../../core/utilities.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {HotkeyUtil} from '../../input/hotkey-util.js';
import {yomitan} from '../../yomitan.js';
import {KeyboardMouseInputField} from './keyboard-mouse-input-field.js';

export class ExtensionKeyboardShortcutController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {HTMLButtonElement} */
        this._resetButton = querySelectorNotNull(document, '#extension-hotkey-list-reset-all');
        /** @type {HTMLButtonElement} */
        this._clearButton = querySelectorNotNull(document, '#extension-hotkey-list-clear-all');
        /** @type {HTMLElement} */
        this._listContainer = querySelectorNotNull(document, '#extension-hotkey-list');
        /** @type {HotkeyUtil} */
        this._hotkeyUtil = new HotkeyUtil();
        /** @type {?import('environment').OperatingSystem} */
        this._os = null;
        /** @type {ExtensionKeyboardShortcutHotkeyEntry[]} */
        this._entries = [];
    }

    /** @type {HotkeyUtil} */
    get hotkeyUtil() {
        return this._hotkeyUtil;
    }

    /** */
    async prepare() {
        const canResetCommands = this.canResetCommands();
        const canModifyCommands = this.canModifyCommands();
        this._resetButton.hidden = !canResetCommands;
        this._clearButton.hidden = !canModifyCommands;

        if (canResetCommands) {
            this._resetButton.addEventListener('click', this._onResetClick.bind(this));
        }
        if (canModifyCommands) {
            this._clearButton.addEventListener('click', this._onClearClick.bind(this));
        }

        const {platform: {os}} = await yomitan.api.getEnvironmentInfo();
        this._os = os;
        this._hotkeyUtil.os = os;

        const commands = await this._getCommands();
        this._setupCommands(commands);
    }

    /**
     * @param {string} name
     * @returns {Promise<{key: ?string, modifiers: import('input').Modifier[]}>}
     */
    async resetCommand(name) {
        await this._resetCommand(name);

        /** @type {?string} */
        let key = null;
        /** @type {import('input').Modifier[]} */
        let modifiers = [];

        const commands = await this._getCommands();
        for (const {name: name2, shortcut} of commands) {
            if (name === name2) {
                ({key, modifiers} = this._hotkeyUtil.convertCommandToInput(shortcut));
                break;
            }
        }

        return {key, modifiers};
    }

    /**
     * @param {string} name
     * @param {?string} key
     * @param {import('input').Modifier[]} modifiers
     */
    async updateCommand(name, key, modifiers) {
        // Firefox-only; uses Promise API
        const shortcut = this._hotkeyUtil.convertInputToCommand(key, modifiers);
        await browser.commands.update({name, shortcut});
    }

    /**
     * @returns {boolean}
     */
    canResetCommands() {
        return (
            typeof browser === 'object' && browser !== null &&
            typeof browser.commands === 'object' && browser.commands !== null &&
            typeof browser.commands.reset === 'function'
        );
    }

    /**
     * @returns {boolean}
     */
    canModifyCommands() {
        return (
            typeof browser === 'object' && browser !== null &&
            typeof browser.commands === 'object' && browser.commands !== null &&
            typeof browser.commands.update === 'function'
        );
    }

    // Add

    /**
     * @param {MouseEvent} e
     */
    _onResetClick(e) {
        e.preventDefault();
        this._resetAllCommands();
    }

    /**
     * @param {MouseEvent} e
     */
    _onClearClick(e) {
        e.preventDefault();
        this._clearAllCommands();
    }

    /**
     * @returns {Promise<chrome.commands.Command[]>}
     */
    _getCommands() {
        return new Promise((resolve, reject) => {
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
    }

    /**
     * @param {chrome.commands.Command[]} commands
     */
    _setupCommands(commands) {
        for (const entry of this._entries) {
            entry.cleanup();
        }
        this._entries = [];

        const fragment = document.createDocumentFragment();

        for (const {name, description, shortcut} of commands) {
            if (typeof name !== 'string' || name.startsWith('_')) { continue; }

            const {key, modifiers} = this._hotkeyUtil.convertCommandToInput(shortcut);

            const node = this._settingsController.instantiateTemplate('extension-hotkey-list-item');
            fragment.appendChild(node);

            const entry = new ExtensionKeyboardShortcutHotkeyEntry(this, node, name, description, key, modifiers, this._os);
            entry.prepare();
            this._entries.push(entry);
        }

        const listContainer = /** @type {HTMLElement} */ (this._listContainer);
        listContainer.textContent = '';
        listContainer.appendChild(fragment);
    }

    /** */
    async _resetAllCommands() {
        if (!this.canModifyCommands()) { return; }

        let commands = await this._getCommands();
        const promises = [];

        for (const {name} of commands) {
            if (typeof name !== 'string' || name.startsWith('_')) { continue; }
            promises.push(this._resetCommand(name));
        }

        await Promise.all(promises);

        commands = await this._getCommands();
        this._setupCommands(commands);
    }

    /** */
    async _clearAllCommands() {
        if (!this.canModifyCommands()) { return; }

        let commands = await this._getCommands();
        const promises = [];

        for (const {name} of commands) {
            if (typeof name !== 'string' || name.startsWith('_')) { continue; }
            promises.push(this.updateCommand(name, null, []));
        }

        await Promise.all(promises);

        commands = await this._getCommands();
        this._setupCommands(commands);
    }

    /**
     * @param {string} name
     */
    async _resetCommand(name) {
        // Firefox-only; uses Promise API
        await browser.commands.reset(name);
    }
}

class ExtensionKeyboardShortcutHotkeyEntry {
    /**
     * @param {ExtensionKeyboardShortcutController} parent
     * @param {Element} node
     * @param {string} name
     * @param {string|undefined} description
     * @param {?string} key
     * @param {import('input').Modifier[]} modifiers
     * @param {?import('environment').OperatingSystem} os
     */
    constructor(parent, node, name, description, key, modifiers, os) {
        /** @type {ExtensionKeyboardShortcutController} */
        this._parent = parent;
        /** @type {Element} */
        this._node = node;
        /** @type {string} */
        this._name = name;
        /** @type {string|undefined} */
        this._description = description;
        /** @type {?string} */
        this._key = key;
        /** @type {import('input').Modifier[]} */
        this._modifiers = modifiers;
        /** @type {?import('environment').OperatingSystem} */
        this._os = os;
        /** @type {?HTMLInputElement} */
        this._input = null;
        /** @type {?KeyboardMouseInputField} */
        this._inputField = null;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
    }

    /** */
    prepare() {
        /** @type {HTMLElement} */
        const label = querySelectorNotNull(this._node, '.settings-item-label');
        label.textContent = this._description || this._name;

        /** @type {HTMLButtonElement} */
        const button = querySelectorNotNull(this._node, '.extension-hotkey-list-item-button');
        /** @type {HTMLInputElement} */
        const input = querySelectorNotNull(this._node, 'input');

        this._input = input;

        if (this._parent.canModifyCommands()) {
            this._inputField = new KeyboardMouseInputField(input, null, this._os);
            this._inputField.prepare(this._key, this._modifiers, false, true);
            this._eventListeners.on(this._inputField, 'change', this._onInputFieldChange.bind(this));
            this._eventListeners.addEventListener(button, 'menuClose', this._onMenuClose.bind(this));
            this._eventListeners.addEventListener(input, 'blur', this._onInputFieldBlur.bind(this));
        } else {
            input.readOnly = true;
            input.value = this._parent.hotkeyUtil.getInputDisplayValue(this._key, this._modifiers);
            button.hidden = true;
        }
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();
        if (this._node.parentNode !== null) {
            this._node.parentNode.removeChild(this._node);
        }
        if (this._inputField !== null) {
            this._inputField.cleanup();
            this._inputField = null;
        }
    }

    // Private

    /**
     * @param {import('keyboard-mouse-input-field').EventArgument<'change'>} e
     */
    _onInputFieldChange(e) {
        const {key, modifiers} = e;
        this._tryUpdateInput(key, modifiers, false);
    }

    /** */
    _onInputFieldBlur() {
        this._updateInput();
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onMenuClose(e) {
        switch (e.detail.action) {
            case 'clearInput':
                this._tryUpdateInput(null, [], true);
                break;
            case 'resetInput':
                this._resetInput();
                break;
        }
    }

    /** */
    _updateInput() {
        /** @type {KeyboardMouseInputField} */ (this._inputField).setInput(this._key, this._modifiers);
        if (this._input !== null) {
            delete this._input.dataset.invalid;
        }
    }

    /**
     * @param {?string} key
     * @param {import('input').Modifier[]} modifiers
     * @param {boolean} updateInput
     */
    async _tryUpdateInput(key, modifiers, updateInput) {
        let okay = (key === null ? (modifiers.length === 0) : (modifiers.length !== 0));
        if (okay) {
            try {
                await this._parent.updateCommand(this._name, key, modifiers);
            } catch (e) {
                okay = false;
            }
        }

        if (okay) {
            this._key = key;
            this._modifiers = modifiers;
            if (this._input !== null) {
                delete this._input.dataset.invalid;
            }
        } else {
            if (this._input !== null) {
                this._input.dataset.invalid = 'true';
            }
        }

        if (updateInput) {
            this._updateInput();
        }
    }

    /** */
    async _resetInput() {
        const {key, modifiers} = await this._parent.resetCommand(this._name);
        this._key = key;
        this._modifiers = modifiers;
        this._updateInput();
    }
}

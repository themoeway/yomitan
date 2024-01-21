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
import {DocumentUtil} from '../../dom/document-util.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {ObjectPropertyAccessor} from '../../general/object-property-accessor.js';
import {yomitan} from '../../yomitan.js';
import {KeyboardMouseInputField} from './keyboard-mouse-input-field.js';

export class KeyboardShortcutController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {KeyboardShortcutHotkeyEntry[]} */
        this._entries = [];
        /** @type {?import('environment').OperatingSystem} */
        this._os = null;
        /** @type {HTMLButtonElement} */
        this._addButton = querySelectorNotNull(document, '#hotkey-list-add');
        /** @type {HTMLButtonElement} */
        this._resetButton = querySelectorNotNull(document, '#hotkey-list-reset');
        /** @type {HTMLElement} */
        this._listContainer = querySelectorNotNull(document, '#hotkey-list');
        /** @type {HTMLElement} */
        this._emptyIndicator = querySelectorNotNull(document, '#hotkey-list-empty');
        /** @type {Intl.Collator} */
        this._stringComparer = new Intl.Collator('en-US'); // Invariant locale
        /** @type {HTMLElement} */
        this._scrollContainer = querySelectorNotNull(document, '#keyboard-shortcuts-modal .modal-body');
        /* eslint-disable no-multi-spaces */
        /** @type {Map<string, import('keyboard-shortcut-controller').ActionDetails>} */
        this._actionDetails = new Map([
            ['',                                 {scopes: new Set()}],
            ['close',                            {scopes: new Set(['popup', 'search'])}],
            ['focusSearchBox',                   {scopes: new Set(['search'])}],
            ['nextEntry',                        {scopes: new Set(['popup', 'search']), argument: {template: 'hotkey-argument-move-offset', default: '1'}}],
            ['previousEntry',                    {scopes: new Set(['popup', 'search']), argument: {template: 'hotkey-argument-move-offset', default: '1'}}],
            ['lastEntry',                        {scopes: new Set(['popup', 'search'])}],
            ['firstEntry',                       {scopes: new Set(['popup', 'search'])}],
            ['nextEntryDifferentDictionary',     {scopes: new Set(['popup', 'search'])}],
            ['previousEntryDifferentDictionary', {scopes: new Set(['popup', 'search'])}],
            ['historyBackward',                  {scopes: new Set(['popup', 'search'])}],
            ['historyForward',                   {scopes: new Set(['popup', 'search'])}],
            ['addNoteKanji',                     {scopes: new Set(['popup', 'search'])}],
            ['addNoteTermKanji',                 {scopes: new Set(['popup', 'search'])}],
            ['addNoteTermKana',                  {scopes: new Set(['popup', 'search'])}],
            ['viewNote',                         {scopes: new Set(['popup', 'search'])}],
            ['playAudio',                        {scopes: new Set(['popup', 'search'])}],
            ['playAudioFromSource',              {scopes: new Set(['popup', 'search']), argument: {template: 'hotkey-argument-audio-source', default: 'jpod101'}}],
            ['copyHostSelection',                {scopes: new Set(['popup'])}],
            ['scanSelectedText',                 {scopes: new Set(['web'])}],
            ['scanTextAtCaret',                  {scopes: new Set(['web'])}],
            ['toggleOption',                     {scopes: new Set(['popup', 'search']), argument: {template: 'hotkey-argument-setting-path', default: ''}}]
        ]);
        /* eslint-enable no-multi-spaces */
    }

    /** @type {import('./settings-controller.js').SettingsController} */
    get settingsController() {
        return this._settingsController;
    }

    /** */
    async prepare() {
        const {platform: {os}} = await yomitan.api.getEnvironmentInfo();
        this._os = os;

        this._addButton.addEventListener('click', this._onAddClick.bind(this));
        this._resetButton.addEventListener('click', this._onResetClick.bind(this));
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));

        await this._updateOptions();
    }

    /**
     * @param {import('settings').InputsHotkeyOptions} terminationCharacterEntry
     */
    async addEntry(terminationCharacterEntry) {
        const options = await this._settingsController.getOptions();
        const {inputs: {hotkeys}} = options;

        await this._settingsController.modifyProfileSettings([{
            action: 'splice',
            path: 'inputs.hotkeys',
            start: hotkeys.length,
            deleteCount: 0,
            items: [terminationCharacterEntry]
        }]);

        await this._updateOptions();
        const scrollContainer = /** @type {HTMLElement} */ (this._scrollContainer);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }

    /**
     * @param {number} index
     * @returns {Promise<boolean>}
     */
    async deleteEntry(index) {
        const options = await this._settingsController.getOptions();
        const {inputs: {hotkeys}} = options;

        if (index < 0 || index >= hotkeys.length) { return false; }

        await this._settingsController.modifyProfileSettings([{
            action: 'splice',
            path: 'inputs.hotkeys',
            start: index,
            deleteCount: 1,
            items: []
        }]);

        await this._updateOptions();
        return true;
    }

    /**
     * @param {import('settings-modifications').Modification[]} targets
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async modifyProfileSettings(targets) {
        return await this._settingsController.modifyProfileSettings(targets);
    }

    /**
     * @returns {Promise<import('settings').InputsHotkeyOptions[]>}
     */
    async getDefaultHotkeys() {
        const defaultOptions = await this._settingsController.getDefaultOptions();
        return defaultOptions.profiles[0].options.inputs.hotkeys;
    }

    /**
     * @param {string} action
     * @returns {import('keyboard-shortcut-controller').ActionDetails|undefined}
     */
    getActionDetails(action) {
        return this._actionDetails.get(action);
    }

    // Private

    /**
     * @param {import('settings-controller').EventArgument<'optionsChanged'>} details
     */
    _onOptionsChanged({options}) {
        for (const entry of this._entries) {
            entry.cleanup();
        }

        this._entries = [];
        const os = /** @type {import('environment').OperatingSystem} */ (this._os);
        const {inputs: {hotkeys}} = options;
        const fragment = document.createDocumentFragment();

        for (let i = 0, ii = hotkeys.length; i < ii; ++i) {
            const hotkeyEntry = hotkeys[i];
            const node = /** @type {HTMLElement} */ (this._settingsController.instantiateTemplate('hotkey-list-item'));
            fragment.appendChild(node);
            const entry = new KeyboardShortcutHotkeyEntry(this, hotkeyEntry, i, node, os, this._stringComparer);
            this._entries.push(entry);
            entry.prepare();
        }

        const listContainer = /** @type {HTMLElement} */ (this._listContainer);
        listContainer.appendChild(fragment);
        listContainer.hidden = (hotkeys.length === 0);
        /** @type {HTMLElement} */ (this._emptyIndicator).hidden = (hotkeys.length !== 0);
    }

    /**
     * @param {MouseEvent} e
     */
    _onAddClick(e) {
        e.preventDefault();
        this._addNewEntry();
    }

    /**
     * @param {MouseEvent} e
     */
    _onResetClick(e) {
        e.preventDefault();
        this._reset();
    }

    /** */
    async _addNewEntry() {
        /** @type {import('settings').InputsHotkeyOptions} */
        const newEntry = {
            action: '',
            argument: '',
            key: null,
            modifiers: [],
            scopes: ['popup', 'search'],
            enabled: true
        };
        await this.addEntry(newEntry);
    }

    /** */
    async _updateOptions() {
        const options = await this._settingsController.getOptions();
        const optionsContext = this._settingsController.getOptionsContext();
        this._onOptionsChanged({options, optionsContext});
    }

    /** */
    async _reset() {
        const value = await this.getDefaultHotkeys();
        await this._settingsController.setProfileSetting('inputs.hotkeys', value);
        await this._updateOptions();
    }
}

class KeyboardShortcutHotkeyEntry {
    /**
     * @param {KeyboardShortcutController} parent
     * @param {import('settings').InputsHotkeyOptions} data
     * @param {number} index
     * @param {HTMLElement} node
     * @param {import('environment').OperatingSystem} os
     * @param {Intl.Collator} stringComparer
     */
    constructor(parent, data, index, node, os, stringComparer) {
        /** @type {KeyboardShortcutController} */
        this._parent = parent;
        /** @type {import('settings').InputsHotkeyOptions} */
        this._data = data;
        /** @type {number} */
        this._index = index;
        /** @type {HTMLElement} */
        this._node = node;
        /** @type {import('environment').OperatingSystem} */
        this._os = os;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {?KeyboardMouseInputField} */
        this._inputField = null;
        /** @type {?HTMLSelectElement} */
        this._actionSelect = null;
        /** @type {string} */
        this._basePath = `inputs.hotkeys[${this._index}]`;
        /** @type {Intl.Collator} */
        this._stringComparer = stringComparer;
        /** @type {?HTMLButtonElement} */
        this._enabledButton = null;
        /** @type {?import('../../dom/popup-menu.js').PopupMenu} */
        this._scopeMenu = null;
        /** @type {EventListenerCollection} */
        this._scopeMenuEventListeners = new EventListenerCollection();
        /** @type {?HTMLElement} */
        this._argumentContainer = null;
        /** @type {?HTMLInputElement} */
        this._argumentInput = null;
        /** @type {EventListenerCollection} */
        this._argumentEventListeners = new EventListenerCollection();
    }

    /** */
    prepare() {
        const node = this._node;

        /** @type {HTMLButtonElement} */
        const menuButton = querySelectorNotNull(node, '.hotkey-list-item-button');
        /** @type {HTMLInputElement} */
        const input = querySelectorNotNull(node, '.hotkey-list-item-input');
        /** @type {HTMLSelectElement} */
        const action = querySelectorNotNull(node, '.hotkey-list-item-action');
        /** @type {HTMLInputElement} */
        const enabledToggle = querySelectorNotNull(node, '.hotkey-list-item-enabled');
        /** @type {HTMLButtonElement} */
        const scopesButton = querySelectorNotNull(node, '.hotkey-list-item-scopes-button');
        /** @type {HTMLButtonElement} */
        const enabledButton = querySelectorNotNull(node, '.hotkey-list-item-enabled-button');

        this._actionSelect = action;
        this._enabledButton = enabledButton;
        this._argumentContainer = node.querySelector('.hotkey-list-item-action-argument-container');

        this._inputField = new KeyboardMouseInputField(input, null, this._os);
        this._inputField.prepare(this._data.key, this._data.modifiers, false, true);

        action.value = this._data.action;

        enabledToggle.checked = this._data.enabled;
        enabledToggle.dataset.setting = `${this._basePath}.enabled`;

        this._updateScopesButton();
        this._updateActionArgument();

        this._eventListeners.addEventListener(scopesButton, 'menuOpen', this._onScopesMenuOpen.bind(this));
        this._eventListeners.addEventListener(scopesButton, 'menuClose', this._onScopesMenuClose.bind(this));
        this._eventListeners.addEventListener(menuButton, 'menuOpen', this._onMenuOpen.bind(this), false);
        this._eventListeners.addEventListener(menuButton, 'menuClose', this._onMenuClose.bind(this), false);
        this._eventListeners.addEventListener(this._actionSelect, 'change', this._onActionSelectChange.bind(this), false);
        this._eventListeners.on(this._inputField, 'change', this._onInputFieldChange.bind(this));
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();
        /** @type {KeyboardMouseInputField} */ (this._inputField).cleanup();
        this._clearScopeMenu();
        this._clearArgumentEventListeners();
        if (this._node.parentNode !== null) {
            this._node.parentNode.removeChild(this._node);
        }
    }

    // Private

    /**
     * @param {import('popup-menu').MenuOpenEvent} e
     */
    _onMenuOpen(e) {
        const {action} = this._data;

        const {menu} = e.detail;
        /** @type {HTMLElement} */
        const resetArgument = querySelectorNotNull(menu.bodyNode, '.popup-menu-item[data-menu-action="resetArgument"]');

        const details = this._parent.getActionDetails(action);
        const argumentDetails = typeof details !== 'undefined' ? details.argument : void 0;

        resetArgument.hidden = (typeof argumentDetails === 'undefined');
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onMenuClose(e) {
        switch (e.detail.action) {
            case 'delete':
                this._delete();
                break;
            case 'clearInputs':
                /** @type {KeyboardMouseInputField} */ (this._inputField).clearInputs();
                break;
            case 'resetInput':
                this._resetInput();
                break;
            case 'resetArgument':
                this._resetArgument();
                break;
        }
    }

    /**
     * @param {import('popup-menu').MenuOpenEvent} e
     */
    _onScopesMenuOpen(e) {
        const {menu} = e.detail;
        const validScopes = this._getValidScopesForAction(this._data.action);
        if (validScopes === null || validScopes.size === 0) {
            menu.close();
            return;
        }
        this._scopeMenu = menu;
        this._updateScopeMenuItems(menu);
        this._updateDisplay(menu.containerNode); // Fix a animation issue due to changing checkbox values
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onScopesMenuClose(e) {
        const {menu, action} = e.detail;
        if (action === 'toggleScope') {
            e.preventDefault();
            return;
        }
        if (this._scopeMenu === menu) {
            this._clearScopeMenu();
        }
    }

    /**
     * @param {import('keyboard-mouse-input-field').EventArgument<'change'>} details
     */
    _onInputFieldChange({key, modifiers}) {
        /** @type {import('input').ModifierKey[]} */
        const modifiers2 = [];
        for (const modifier of modifiers) {
            const modifier2 = DocumentUtil.normalizeModifierKey(modifier);
            if (modifier2 === null) { continue; }
            modifiers2.push(modifier2);
        }
        this._setKeyAndModifiers(key, modifiers2);
    }

    /**
     * @param {MouseEvent} e
     */
    _onScopeCheckboxChange(e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        const scope = this._normalizeScope(node.dataset.scope);
        if (scope === null) { return; }
        this._setScopeEnabled(scope, node.checked);
    }

    /**
     * @param {MouseEvent} e
     */
    _onActionSelectChange(e) {
        const node = /** @type {HTMLSelectElement} */ (e.currentTarget);
        const value = node.value;
        this._setAction(value);
    }

    /**
     * @param {string} template
     * @param {Event} e
     */
    _onArgumentValueChange(template, e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        let value = this._getArgumentInputValue(node);
        switch (template) {
            case 'hotkey-argument-move-offset':
                value = `${DocumentUtil.convertElementValueToNumber(value, node)}`;
                break;
        }
        this._setArgument(value);
    }

    /** */
    async _delete() {
        this._parent.deleteEntry(this._index);
    }

    /**
     * @param {?string} key
     * @param {import('input').ModifierKey[]} modifiers
     */
    async _setKeyAndModifiers(key, modifiers) {
        this._data.key = key;
        this._data.modifiers = modifiers;
        await this._modifyProfileSettings([
            {
                action: 'set',
                path: `${this._basePath}.key`,
                value: key
            },
            {
                action: 'set',
                path: `${this._basePath}.modifiers`,
                value: modifiers
            }
        ]);
    }

    /**
     * @param {import('settings').InputsHotkeyScope} scope
     * @param {boolean} enabled
     */
    async _setScopeEnabled(scope, enabled) {
        const scopes = this._data.scopes;
        const index = scopes.indexOf(scope);
        if ((index >= 0) === enabled) { return; }

        if (enabled) {
            scopes.push(scope);
            const stringComparer = this._stringComparer;
            scopes.sort((scope1, scope2) => stringComparer.compare(scope1, scope2));
        } else {
            scopes.splice(index, 1);
        }

        await this._modifyProfileSettings([{
            action: 'set',
            path: `${this._basePath}.scopes`,
            value: scopes
        }]);

        this._updateScopesButton();
    }

    /**
     * @param {import('settings-modifications').Modification[]} targets
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async _modifyProfileSettings(targets) {
        return await this._parent.settingsController.modifyProfileSettings(targets);
    }

    /** */
    async _resetInput() {
        const defaultHotkeys = await this._parent.getDefaultHotkeys();
        const defaultValue = this._getDefaultKeyAndModifiers(defaultHotkeys, this._data.action);
        if (defaultValue === null) { return; }

        const {key, modifiers} = defaultValue;
        await this._setKeyAndModifiers(key, modifiers);
        /** @type {KeyboardMouseInputField} */ (this._inputField).setInput(key, modifiers);
    }

    /** */
    async _resetArgument() {
        const {action} = this._data;
        const details = this._parent.getActionDetails(action);
        const argumentDetails = typeof details !== 'undefined' ? details.argument : void 0;
        let argumentDefault = typeof argumentDetails !== 'undefined' ? argumentDetails.default : void 0;
        if (typeof argumentDefault !== 'string') { argumentDefault = ''; }
        await this._setArgument(argumentDefault);
    }

    /**
     * @param {import('settings').InputsHotkeyOptions[]} defaultHotkeys
     * @param {string} action
     * @returns {?{modifiers: import('settings').InputsHotkeyModifier[], key: ?string}}
     */
    _getDefaultKeyAndModifiers(defaultHotkeys, action) {
        for (const {action: action2, key, modifiers} of defaultHotkeys) {
            if (action2 !== action) { continue; }
            return {modifiers, key};
        }
        return null;
    }

    /**
     * @param {string} value
     */
    async _setAction(value) {
        const validScopesOld = this._getValidScopesForAction(this._data.action);

        const scopes = this._data.scopes;

        let details = this._parent.getActionDetails(value);
        if (typeof details === 'undefined') { details = {scopes: new Set()}; }

        const validScopes = details.scopes;

        const {argument: argumentDetails} = details;
        let defaultArgument = typeof argumentDetails !== 'undefined' ? argumentDetails.default : '';
        if (typeof defaultArgument !== 'string') { defaultArgument = ''; }

        this._data.action = value;
        this._data.argument = defaultArgument;

        let scopesChanged = false;
        if ((validScopesOld !== null ? validScopesOld.size : 0) === scopes.length) {
            scopes.length = 0;
            scopesChanged = true;
        } else {
            for (let i = 0, ii = scopes.length; i < ii; ++i) {
                if (!validScopes.has(scopes[i])) {
                    scopes.splice(i, 1);
                    --i;
                    --ii;
                    scopesChanged = true;
                }
            }
        }
        if (scopesChanged && scopes.length === 0) {
            scopes.push(...validScopes);
        }

        await this._modifyProfileSettings([
            {
                action: 'set',
                path: `${this._basePath}.action`,
                value: this._data.action
            },
            {
                action: 'set',
                path: `${this._basePath}.argument`,
                value: this._data.argument
            },
            {
                action: 'set',
                path: `${this._basePath}.scopes`,
                value: this._data.scopes
            }
        ]);

        this._updateScopesButton();
        this._updateScopesMenu();
        this._updateActionArgument();
    }

    /**
     * @param {string} value
     */
    async _setArgument(value) {
        this._data.argument = value;

        const node = this._argumentInput;
        if (node !== null && this._getArgumentInputValue(node) !== value) {
            this._setArgumentInputValue(node, value);
        }

        this._updateArgumentInputValidity();

        await this._modifyProfileSettings([{
            action: 'set',
            path: `${this._basePath}.argument`,
            value
        }]);
    }

    /** */
    _updateScopesMenu() {
        if (this._scopeMenu === null) { return; }
        this._updateScopeMenuItems(this._scopeMenu);
    }

    /**
     * @param {string} action
     * @returns {?Set<import('settings').InputsHotkeyScope>}
     */
    _getValidScopesForAction(action) {
        const details = this._parent.getActionDetails(action);
        return typeof details !== 'undefined' ? details.scopes : null;
    }

    /**
     * @param {import('../../dom/popup-menu.js').PopupMenu} menu
     */
    _updateScopeMenuItems(menu) {
        this._scopeMenuEventListeners.removeAllEventListeners();

        const scopes = this._data.scopes;
        const validScopes = this._getValidScopesForAction(this._data.action);

        const bodyNode = menu.bodyNode;
        const menuItems = /** @type {NodeListOf<HTMLElement>} */ (bodyNode.querySelectorAll('.popup-menu-item'));
        for (const menuItem of menuItems) {
            if (menuItem.dataset.menuAction !== 'toggleScope') { continue; }

            const scope = this._normalizeScope(menuItem.dataset.scope);
            if (scope === null) { continue; }
            menuItem.hidden = !(validScopes === null || validScopes.has(scope));

            /** @type {HTMLInputElement} */
            const checkbox = querySelectorNotNull(menuItem, '.hotkey-scope-checkbox');
            if (checkbox !== null) {
                checkbox.checked = scopes.includes(scope);
                this._scopeMenuEventListeners.addEventListener(checkbox, 'change', this._onScopeCheckboxChange.bind(this), false);
            }
        }
    }

    /** */
    _clearScopeMenu() {
        this._scopeMenuEventListeners.removeAllEventListeners();
        this._scopeMenu = null;
    }

    /** */
    _updateScopesButton() {
        const {scopes} = this._data;
        if (this._enabledButton !== null) {
            this._enabledButton.dataset.scopeCount = `${scopes.length}`;
        }
    }

    /**
     * @param {HTMLElement} node
     */
    _updateDisplay(node) {
        const {style} = node;
        const {display} = style;
        style.display = 'none';
        getComputedStyle(node).getPropertyValue('display');
        style.display = display;
    }

    /** */
    _updateActionArgument() {
        this._clearArgumentEventListeners();

        const {action, argument} = this._data;
        const details = this._parent.getActionDetails(action);
        const argumentDetails = typeof details !== 'undefined' ? details.argument : void 0;

        if (this._argumentContainer !== null) {
            this._argumentContainer.textContent = '';
        }
        if (typeof argumentDetails !== 'undefined') {
            const {template} = argumentDetails;
            const node = this._parent.settingsController.instantiateTemplate(template);
            const inputSelector = '.hotkey-argument-input';
            const inputNode = /** @type {HTMLInputElement} */ (node.matches(inputSelector) ? node : node.querySelector(inputSelector));
            if (inputNode !== null) {
                this._setArgumentInputValue(inputNode, argument);
                this._argumentInput = inputNode;
                this._updateArgumentInputValidity();
                this._argumentEventListeners.addEventListener(inputNode, 'change', this._onArgumentValueChange.bind(this, template), false);
            }
            if (this._argumentContainer !== null) {
                this._argumentContainer.appendChild(node);
            }
        }
    }

    /** */
    _clearArgumentEventListeners() {
        this._argumentEventListeners.removeAllEventListeners();
        this._argumentInput = null;
    }

    /**
     * @param {HTMLInputElement} node
     * @returns {string}
     */
    _getArgumentInputValue(node) {
        return node.value;
    }

    /**
     * @param {HTMLInputElement} node
     * @param {string} value
     */
    _setArgumentInputValue(node, value) {
        node.value = value;
    }

    /** */
    async _updateArgumentInputValidity() {
        if (this._argumentInput === null) { return; }

        let okay = true;
        const {action, argument} = this._data;
        const details = this._parent.getActionDetails(action);
        const argumentDetails = typeof details !== 'undefined' ? details.argument : void 0;

        if (typeof argumentDetails !== 'undefined') {
            const {template} = argumentDetails;
            switch (template) {
                case 'hotkey-argument-setting-path':
                    okay = await this._isHotkeyArgumentSettingPathValid(argument);
                    break;
            }
        }

        this._argumentInput.dataset.invalid = `${!okay}`;
    }

    /**
     * @param {string} path
     * @returns {Promise<boolean>}
     */
    async _isHotkeyArgumentSettingPathValid(path) {
        if (path.length === 0) { return true; }

        const options = await this._parent.settingsController.getOptions();
        const accessor = new ObjectPropertyAccessor(options);
        const pathArray = ObjectPropertyAccessor.getPathArray(path);
        try {
            const value = accessor.get(pathArray, pathArray.length);
            if (typeof value === 'boolean') {
                return true;
            }
        } catch (e) {
            // NOP
        }
        return false;
    }

    /**
     * @param {string|undefined} value
     * @returns {?import('settings').InputsHotkeyScope}
     */
    _normalizeScope(value) {
        switch (value) {
            case 'popup':
            case 'search':
            case 'web':
                return value;
            default:
                return null;
        }
    }
}

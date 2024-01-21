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
import {querySelectorNotNull} from '../../dom/query-selector.js';

export class SentenceTerminationCharactersController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {SentenceTerminationCharacterEntry[]} */
        this._entries = [];
        /** @type {HTMLButtonElement} */
        this._addButton = querySelectorNotNull(document, '#sentence-termination-character-list-add');
        /** @type {HTMLButtonElement} */
        this._resetButton = querySelectorNotNull(document, '#sentence-termination-character-list-reset');
        /** @type {HTMLElement} */
        this._listTable = querySelectorNotNull(document, '#sentence-termination-character-list-table');
        /** @type {HTMLElement} */
        this._listContainer = querySelectorNotNull(document, '#sentence-termination-character-list');
        /** @type {HTMLElement} */
        this._emptyIndicator = querySelectorNotNull(document, '#sentence-termination-character-list-empty');
    }

    /** @type {import('./settings-controller.js').SettingsController} */
    get settingsController() {
        return this._settingsController;
    }

    /** */
    async prepare() {
        this._addButton.addEventListener('click', this._onAddClick.bind(this));
        this._resetButton.addEventListener('click', this._onResetClick.bind(this));
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));

        await this._updateOptions();
    }

    /**
     * @param {import('settings').SentenceParsingTerminationCharacterOption} terminationCharacterEntry
     */
    async addEntry(terminationCharacterEntry) {
        const options = await this._settingsController.getOptions();
        const {sentenceParsing: {terminationCharacters}} = options;

        await this._settingsController.modifyProfileSettings([{
            action: 'splice',
            path: 'sentenceParsing.terminationCharacters',
            start: terminationCharacters.length,
            deleteCount: 0,
            items: [terminationCharacterEntry]
        }]);

        await this._updateOptions();
    }

    /**
     * @param {number} index
     * @returns {Promise<boolean>}
     */
    async deleteEntry(index) {
        const options = await this._settingsController.getOptions();
        const {sentenceParsing: {terminationCharacters}} = options;

        if (index < 0 || index >= terminationCharacters.length) { return false; }

        await this._settingsController.modifyProfileSettings([{
            action: 'splice',
            path: 'sentenceParsing.terminationCharacters',
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

    // Private

    /**
     * @param {import('settings-controller').EventArgument<'optionsChanged'>} details
     */
    _onOptionsChanged({options}) {
        for (const entry of this._entries) {
            entry.cleanup();
        }

        this._entries = [];
        const {sentenceParsing: {terminationCharacters}} = options;

        const listContainer = /** @type {HTMLElement} */ (this._listContainer);
        for (let i = 0, ii = terminationCharacters.length; i < ii; ++i) {
            const terminationCharacterEntry = terminationCharacters[i];
            const node = /** @type {HTMLElement} */ (this._settingsController.instantiateTemplate('sentence-termination-character-entry'));
            listContainer.appendChild(node);
            const entry = new SentenceTerminationCharacterEntry(this, terminationCharacterEntry, i, node);
            this._entries.push(entry);
            entry.prepare();
        }

        /** @type {HTMLElement} */ (this._listTable).hidden = (terminationCharacters.length === 0);
        /** @type {HTMLElement} */ (this._emptyIndicator).hidden = (terminationCharacters.length !== 0);
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
        const newEntry = {
            enabled: true,
            character1: '"',
            character2: '"',
            includeCharacterAtStart: false,
            includeCharacterAtEnd: false
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
        const defaultOptions = await this._settingsController.getDefaultOptions();
        const value = defaultOptions.profiles[0].options.sentenceParsing.terminationCharacters;
        await this._settingsController.setProfileSetting('sentenceParsing.terminationCharacters', value);
        await this._updateOptions();
    }
}

class SentenceTerminationCharacterEntry {
    /**
     * @param {SentenceTerminationCharactersController} parent
     * @param {import('settings').SentenceParsingTerminationCharacterOption} data
     * @param {number} index
     * @param {HTMLElement} node
     */
    constructor(parent, data, index, node) {
        /** @type {SentenceTerminationCharactersController} */
        this._parent = parent;
        /** @type {import('settings').SentenceParsingTerminationCharacterOption} */
        this._data = data;
        /** @type {number} */
        this._index = index;
        /** @type {HTMLElement} */
        this._node = node;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {?HTMLInputElement} */
        this._character1Input = null;
        /** @type {?HTMLInputElement} */
        this._character2Input = null;
        /** @type {string} */
        this._basePath = `sentenceParsing.terminationCharacters[${this._index}]`;
    }

    /** */
    prepare() {
        const {enabled, character1, character2, includeCharacterAtStart, includeCharacterAtEnd} = this._data;
        const node = this._node;

        /** @type {HTMLInputElement} */
        const enabledToggle = querySelectorNotNull(node, '.sentence-termination-character-enabled');
        /** @type {HTMLSelectElement} */
        const typeSelect = querySelectorNotNull(node, '.sentence-termination-character-type');
        /** @type {HTMLInputElement} */
        const character1Input = querySelectorNotNull(node, '.sentence-termination-character-input1');
        /** @type {HTMLInputElement} */
        const character2Input = querySelectorNotNull(node, '.sentence-termination-character-input2');
        /** @type {HTMLInputElement} */
        const includeAtStartCheckbox = querySelectorNotNull(node, '.sentence-termination-character-include-at-start');
        /** @type {HTMLInputElement} */
        const includeAtEndheckbox = querySelectorNotNull(node, '.sentence-termination-character-include-at-end');
        /** @type {HTMLButtonElement} */
        const menuButton = querySelectorNotNull(node, '.sentence-termination-character-entry-button');

        this._character1Input = character1Input;
        this._character2Input = character2Input;

        const type = (character2 === null ? 'terminator' : 'quote');
        node.dataset.type = type;

        enabledToggle.checked = enabled;
        typeSelect.value = type;
        character1Input.value = character1;
        character2Input.value = (character2 !== null ? character2 : '');
        includeAtStartCheckbox.checked = includeCharacterAtStart;
        includeAtEndheckbox.checked = includeCharacterAtEnd;

        enabledToggle.dataset.setting = `${this._basePath}.enabled`;
        includeAtStartCheckbox.dataset.setting = `${this._basePath}.includeCharacterAtStart`;
        includeAtEndheckbox.dataset.setting = `${this._basePath}.includeCharacterAtEnd`;

        this._eventListeners.addEventListener(typeSelect, 'change', this._onTypeSelectChange.bind(this), false);
        this._eventListeners.addEventListener(character1Input, 'change', this._onCharacterChange.bind(this, 1), false);
        this._eventListeners.addEventListener(character2Input, 'change', this._onCharacterChange.bind(this, 2), false);
        this._eventListeners.addEventListener(menuButton, 'menuClose', this._onMenuClose.bind(this), false);
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();
        if (this._node.parentNode !== null) {
            this._node.parentNode.removeChild(this._node);
        }
    }

    // Private

    /**
     * @param {Event} e
     */
    _onTypeSelectChange(e) {
        const element = /** @type {HTMLSelectElement} */ (e.currentTarget);
        this._setHasCharacter2(element.value === 'quote');
    }

    /**
     * @param {1|2} characterNumber
     * @param {Event} e
     */
    _onCharacterChange(characterNumber, e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        if (characterNumber === 2 && this._data.character2 === null) {
            node.value = '';
        }

        const value = node.value.substring(0, 1);
        this._setCharacterValue(node, characterNumber, value);
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onMenuClose(e) {
        switch (e.detail.action) {
            case 'delete':
                this._delete();
                break;
        }
    }

    /** */
    async _delete() {
        this._parent.deleteEntry(this._index);
    }

    /**
     * @param {boolean} has
     */
    async _setHasCharacter2(has) {
        if (this._character2Input === null) { return; }
        const okay = await this._setCharacterValue(this._character2Input, 2, has ? this._data.character1 : null);
        if (okay) {
            const type = (!has ? 'terminator' : 'quote');
            this._node.dataset.type = type;
        }
    }

    /**
     * @param {HTMLInputElement} inputNode
     * @param {1|2} characterNumber
     * @param {?string} value
     * @returns {Promise<boolean>}
     */
    async _setCharacterValue(inputNode, characterNumber, value) {
        if (characterNumber === 1 && typeof value !== 'string') { value = ''; }
        const r = await this._parent.settingsController.setProfileSetting(`${this._basePath}.character${characterNumber}`, value);
        const okay = !r[0].error;
        if (okay) {
            if (characterNumber === 1) {
                this._data.character1 = /** @type {string} */ (value);
            } else {
                this._data.character2 = value;
            }
        } else {
            value = characterNumber === 1 ? this._data.character1 : this._data.character2;
        }
        inputNode.value = (value !== null ? value : '');
        return okay;
    }
}

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
import {yomitan} from '../../yomitan.js';

export class CollapsibleDictionaryController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {?import('core').TokenObject} */
        this._getDictionaryInfoToken = null;
        /** @type {Map<string, import('dictionary-importer').Summary>} */
        this._dictionaryInfoMap = new Map();
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {HTMLElement} */
        this._container = querySelectorNotNull(document, '#collapsible-dictionary-list');
        /** @type {HTMLSelectElement[]} */
        this._selects = [];
        /** @type {?HTMLSelectElement} */
        this._allSelect = null;
    }

    /** */
    async prepare() {
        await this._onDatabaseUpdated();

        yomitan.on('databaseUpdated', this._onDatabaseUpdated.bind(this));
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));
        this._settingsController.on('dictionarySettingsReordered', this._onDictionarySettingsReordered.bind(this));
    }

    // Private

    /** */
    async _onDatabaseUpdated() {
        /** @type {?import('core').TokenObject} */
        const token = {};
        this._getDictionaryInfoToken = token;
        const dictionaries = await this._settingsController.getDictionaryInfo();
        if (this._getDictionaryInfoToken !== token) { return; }
        this._getDictionaryInfoToken = null;

        this._dictionaryInfoMap.clear();
        for (const entry of dictionaries) {
            this._dictionaryInfoMap.set(entry.title, entry);
        }

        await this._onDictionarySettingsReordered();
    }

    /**
     * @param {import('settings-controller').EventArgument<'optionsChanged'>} details
     */
    _onOptionsChanged({options}) {
        this._eventListeners.removeAllEventListeners();
        this._selects = [];

        const fragment = document.createDocumentFragment();

        this._setupAllSelect(fragment, options);

        const {dictionaries} = options;
        for (let i = 0, ii = dictionaries.length; i < ii; ++i) {
            const {name} = dictionaries[i];
            const dictionaryInfo = this._dictionaryInfoMap.get(name);
            if (typeof dictionaryInfo === 'undefined') { continue; }

            const select = this._addSelect(fragment, name, `rev.${dictionaryInfo.revision}`);
            select.dataset.setting = `dictionaries[${i}].definitionsCollapsible`;
            this._eventListeners.addEventListener(select, 'settingChanged', this._onDefinitionsCollapsibleChange.bind(this), false);

            this._selects.push(select);
        }

        const container = /** @type {HTMLElement} */ (this._container);
        container.textContent = '';
        container.appendChild(fragment);
    }

    /** */
    _onDefinitionsCollapsibleChange() {
        this._updateAllSelectFresh();
    }

    /**
     * @param {Event} e
     */
    _onAllSelectChange(e) {
        const {value} = /** @type {HTMLSelectElement} */ (e.currentTarget);
        const value2 = this._normalizeDictionaryDefinitionsCollapsible(value);
        if (value2 === null) { return; }
        this._setDefinitionsCollapsibleAll(value2);
    }

    /** */
    async _onDictionarySettingsReordered() {
        const options = await this._settingsController.getOptions();
        const optionsContext = this._settingsController.getOptionsContext();
        this._onOptionsChanged({options, optionsContext});
    }

    /**
     * @param {DocumentFragment} fragment
     * @param {import('settings').ProfileOptions} options
     */
    _setupAllSelect(fragment, options) {
        const select = this._addSelect(fragment, 'All', '');

        const option = document.createElement('option');
        option.value = 'varies';
        option.textContent = 'Varies';
        option.disabled = true;
        select.appendChild(option);

        this._eventListeners.addEventListener(select, 'change', this._onAllSelectChange.bind(this), false);

        this._allSelect = select;
        this._updateAllSelect(options);
    }

    /**
     * @param {DocumentFragment} fragment
     * @param {string} dictionary
     * @param {string} version
     * @returns {HTMLSelectElement}
     */
    _addSelect(fragment, dictionary, version) {
        const node = this._settingsController.instantiateTemplate('collapsible-dictionary-item');
        fragment.appendChild(node);

        /** @type {HTMLElement} */
        const nameNode = querySelectorNotNull(node, '.dictionary-title');
        nameNode.textContent = dictionary;

        /** @type {HTMLElement} */
        const versionNode = querySelectorNotNull(node, '.dictionary-version');
        versionNode.textContent = version;

        /** @type {HTMLSelectElement} */
        const select = querySelectorNotNull(node, '.definitions-collapsible');
        return select;
    }

    /** */
    async _updateAllSelectFresh() {
        this._updateAllSelect(await this._settingsController.getOptions());
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    _updateAllSelect(options) {
        let value = null;
        let varies = false;
        for (const {definitionsCollapsible} of options.dictionaries) {
            if (value === null) {
                value = definitionsCollapsible;
            } else if (value !== definitionsCollapsible) {
                varies = true;
                break;
            }
        }

        if (this._allSelect !== null) {
            this._allSelect.value = (varies || value === null ? 'varies' : value);
        }
    }

    /**
     * @param {import('settings').DictionaryDefinitionsCollapsible} value
     */
    async _setDefinitionsCollapsibleAll(value) {
        const options = await this._settingsController.getOptions();
        /** @type {import('settings-modifications').Modification[]} */
        const targets = [];
        const {dictionaries} = options;
        for (let i = 0, ii = dictionaries.length; i < ii; ++i) {
            const path = `dictionaries[${i}].definitionsCollapsible`;
            targets.push({action: 'set', path, value});
        }
        await this._settingsController.modifyProfileSettings(targets);
        for (const select of this._selects) {
            select.value = value;
        }
    }

    /**
     * @param {string} value
     * @returns {?import('settings').DictionaryDefinitionsCollapsible}
     */
    _normalizeDictionaryDefinitionsCollapsible(value) {
        switch (value) {
            case 'not-collapsible':
            case 'expanded':
            case 'collapsed':
            case 'force-collapsed':
            case 'force-expanded':
                return value;
            default:
                return null;
        }
    }
}

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

import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {yomitan} from '../../yomitan.js';

export class SecondarySearchDictionaryController {
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
        this._container = querySelectorNotNull(document, '#secondary-search-dictionary-list');
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

        const fragment = document.createDocumentFragment();

        const {dictionaries} = options;
        for (let i = 0, ii = dictionaries.length; i < ii; ++i) {
            const {name} = dictionaries[i];
            const dictionaryInfo = this._dictionaryInfoMap.get(name);
            if (typeof dictionaryInfo === 'undefined') { continue; }

            const node = /** @type {HTMLElement} */ (this._settingsController.instantiateTemplate('secondary-search-dictionary'));
            fragment.appendChild(node);

            /** @type {HTMLElement} */
            const nameNode = querySelectorNotNull(node, '.dictionary-title');
            nameNode.textContent = name;

            /** @type {HTMLElement} */
            const versionNode = querySelectorNotNull(node, '.dictionary-version');
            versionNode.textContent = `rev.${dictionaryInfo.revision}`;

            /** @type {HTMLElement} */
            const toggle = querySelectorNotNull(node, '.dictionary-allow-secondary-searches');
            toggle.dataset.setting = `dictionaries[${i}].allowSecondarySearches`;
            this._eventListeners.addEventListener(toggle, 'settingChanged', this._onEnabledChanged.bind(this, node), false);
        }

        const container = /** @type {HTMLElement} */ (this._container);
        container.textContent = '';
        container.appendChild(fragment);
    }

    /**
     * @param {HTMLElement} node
     * @param {import('dom-data-binder').SettingChangedEvent} e
     */
    _onEnabledChanged(node, e) {
        const {detail: {value}} = e;
        node.dataset.enabled = `${value}`;
    }

    /** */
    async _onDictionarySettingsReordered() {
        const options = await this._settingsController.getOptions();
        const optionsContext = this._settingsController.getOptionsContext();
        this._onOptionsChanged({options, optionsContext});
    }
}

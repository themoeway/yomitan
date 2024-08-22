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

import * as ajvSchemas0 from '../../../lib/validate-schemas.js';
import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {readResponseJson} from '../../core/json.js';
import {log} from '../../core/log.js';
import {compareRevisions} from '../../dictionary/dictionary-data-util.js';
import {DictionaryWorker} from '../../dictionary/dictionary-worker.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';

const ajvSchemas = /** @type {import('dictionary-importer').CompiledSchemaValidators} */ (/** @type {unknown} */ (ajvSchemas0));

/**
 * Throttles a function to be called at most once per `wait` milliseconds.
 * @param {Function} func The function to be throttled.
 * @param {number} wait The minimum time (in milliseconds) to wait between function calls.
 * @param {unknown} self The value to be passed as the `this` parameter to the throttled function.
 * @returns {(this: unknown, ...args: any[]) => void} The throttled function.
 */
function throttle(func, wait, self) {
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall >= wait) {
            lastCall = now;
            return func.apply(self, args);
        }
    };
}

class DictionaryEntry {
    /**
     * @param {DictionaryController} dictionaryController
     * @param {DocumentFragment} fragment
     * @param {number} index
     * @param {import('dictionary-importer').Summary} dictionaryInfo
     */
    constructor(dictionaryController, fragment, index, dictionaryInfo) {
        /** @type {DictionaryController} */
        this._dictionaryController = dictionaryController;
        /** @type {number} */
        this._index = index;
        /** @type {import('dictionary-importer').Summary} */
        this._dictionaryInfo = dictionaryInfo;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {?import('dictionary-database').DictionaryCountGroup} */
        this._counts = null;
        /** @type {ChildNode[]} */
        this._nodes = [...fragment.childNodes];
        /** @type {HTMLElement} */
        this._dictionaryItem = querySelectorNotNull(fragment, '.dictionary-item');
        /** @type {HTMLInputElement} */
        this._enabledCheckbox = querySelectorNotNull(fragment, '.dictionary-enabled');
        /** @type {HTMLButtonElement} */
        this._menuButton = querySelectorNotNull(fragment, '.dictionary-menu-button');
        /** @type {HTMLButtonElement} */
        this._outdatedButton = querySelectorNotNull(fragment, '.dictionary-outdated-button');
        /** @type {HTMLButtonElement} */
        this._integrityButton = querySelectorNotNull(fragment, '.dictionary-integrity-button');
        /** @type {HTMLButtonElement} */
        this._updatesAvailable = querySelectorNotNull(fragment, '.dictionary-update-available');
        /** @type {HTMLElement} */
        this._aliasNode = querySelectorNotNull(fragment, '.dictionary-alias');
        /** @type {HTMLElement} */
        this._versionNode = querySelectorNotNull(fragment, '.dictionary-revision');
        /** @type {HTMLElement} */
        this._titleContainer = querySelectorNotNull(fragment, '.dictionary-item-title-container');
    }

    /** @type {string} */
    get dictionaryTitle() {
        return this._dictionaryInfo.title;
    }

    /** @type {HTMLElement} */
    get dictionaryItem() {
        return this._dictionaryItem;
    }

    /** */
    prepare() {
        //
        const index = this._index;
        const {revision, version} = this._dictionaryInfo;

        this._aliasNode.dataset.setting = `dictionaries[${index}].alias`;
        this._versionNode.textContent = `rev.${revision}`;
        this._outdatedButton.hidden = (version >= 3);
        this._enabledCheckbox.dataset.setting = `dictionaries[${index}].enabled`;
        this._eventListeners.addEventListener(this._enabledCheckbox, 'settingChanged', this._onEnabledChanged.bind(this), false);
        this._eventListeners.addEventListener(this._menuButton, 'menuOpen', this._onMenuOpen.bind(this), false);
        this._eventListeners.addEventListener(this._menuButton, 'menuClose', this._onMenuClose.bind(this), false);
        this._eventListeners.addEventListener(this._outdatedButton, 'click', this._onOutdatedButtonClick.bind(this), false);
        this._eventListeners.addEventListener(this._integrityButton, 'click', this._onIntegrityButtonClick.bind(this), false);
        this._eventListeners.addEventListener(this._updatesAvailable, 'click', this._onUpdateButtonClick.bind(this), false);
        this._eventListeners.addEventListener(this._dictionaryItem, 'dragstart', this._onDragStart.bind(this), false);
        this._eventListeners.addEventListener(this._dictionaryItem, 'dragend', this._onDragEnd.bind(this), false);
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();
        for (const node of this._nodes) {
            if (node.parentNode !== null) {
                node.parentNode.removeChild(node);
            }
        }
        this._nodes = [];
    }

    /**
     * @param {import('dictionary-database').DictionaryCountGroup} counts
     */
    setCounts(counts) {
        this._counts = counts;
        this._integrityButton.hidden = false;
    }

    /**
     * @param {boolean} value
     */
    setEnabled(value) {
        this._enabledCheckbox.checked = value;
    }

    /**
     * @returns {Promise<boolean>}
     */
    async checkForUpdate() {
        this._updatesAvailable.hidden = true;
        const {isUpdatable, indexUrl, revision: currentRevision, downloadUrl: currentDownloadUrl} = this._dictionaryInfo;
        if (!isUpdatable || !indexUrl || !currentDownloadUrl) { return false; }
        const response = await fetch(indexUrl);

        /** @type {unknown} */
        const index = await readResponseJson(response);

        if (!ajvSchemas.dictionaryIndex(index)) {
            throw new Error('Invalid dictionary index');
        }

        const validIndex = /** @type {import('dictionary-data').Index} */ (index);
        const {revision: latestRevision, downloadUrl: latestDownloadUrl} = validIndex;

        if (!compareRevisions(currentRevision, latestRevision)) {
            return false;
        }

        const downloadUrl = latestDownloadUrl ?? currentDownloadUrl;

        this._updatesAvailable.dataset.downloadUrl = downloadUrl;
        this._updatesAvailable.hidden = false;
        return true;
    }

    // Private

    /**
     * @param {import('popup-menu').MenuOpenEvent} e
     */
    _onMenuOpen(e) {
        const bodyNode = e.detail.menu.bodyNode;
        const count = this._dictionaryController.dictionaryOptionCount;
        this._setMenuActionEnabled(bodyNode, 'moveTo', count > 1);
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onMenuClose(e) {
        switch (e.detail.action) {
            case 'delete':
                this._delete();
                break;
            case 'showDetails':
                this._showDetails();
                break;
            case 'moveTo':
                this._showMoveToModal();
                break;
            case 'rename':
                this._showRenameModal();
                break;
        }
    }

    /**
     * @param {string} alias
     */
    updateAliasSettings(alias) {
        this._aliasNode.textContent = alias;
        this._aliasNode.dispatchEvent(new CustomEvent('change', {bubbles: true}));
    }

    /**
     * @param {import('dom-data-binder').SettingChangedEvent} e
     */
    _onEnabledChanged(e) {
        const {detail: {value}} = e;
        this._titleContainer.dataset.enabled = `${value}`;
        void this._dictionaryController.updateDictionariesEnabled();
    }

    /** */
    _onOutdatedButtonClick() {
        this._showDetails();
    }

    /** */
    _onUpdateButtonClick() {
        const downloadUrl = this._updatesAvailable.dataset.downloadUrl;
        this._dictionaryController.updateDictionary(this.dictionaryTitle, downloadUrl);
    }

    /** */
    _onDragStart() {
        this._dictionaryItem.classList.add('dragging');
    }

    /** */
    _onDragEnd() {
        this._dictionaryItem.classList.remove('dragging');
    }

    /** */
    _onIntegrityButtonClick() {
        this._showDetails();
    }

    /** */
    _showDetails() {
        const {title, revision, version, counts, prefixWildcardsSupported} = this._dictionaryInfo;

        const modal = this._dictionaryController.modalController.getModal('dictionary-details');
        if (modal === null) { return; }

        /** @type {HTMLElement} */
        const titleElement = querySelectorNotNull(modal.node, '.dictionary-title');
        /** @type {HTMLElement} */
        const versionElement = querySelectorNotNull(modal.node, '.dictionary-revision');
        /** @type {HTMLElement} */
        const outdateElement = querySelectorNotNull(modal.node, '.dictionary-outdated-notification');
        /** @type {HTMLElement} */
        const countsElement = querySelectorNotNull(modal.node, '.dictionary-counts');
        /** @type {HTMLInputElement} */
        const wildcardSupportedElement = querySelectorNotNull(modal.node, '.dictionary-prefix-wildcard-searches-supported');
        /** @type {HTMLElement} */
        const detailsTableElement = querySelectorNotNull(modal.node, '.dictionary-details-table');
        /** @type {HTMLElement} */
        const partsOfSpeechFilterSetting = querySelectorNotNull(modal.node, '.dictionary-parts-of-speech-filter-setting');
        /** @type {HTMLElement} */
        const partsOfSpeechFilterToggle = querySelectorNotNull(partsOfSpeechFilterSetting, '.dictionary-parts-of-speech-filter-toggle');
        /** @type {HTMLElement} */
        const useDeinflectionsSetting = querySelectorNotNull(modal.node, '.dictionary-use-deinflections-setting');
        /** @type {HTMLElement} */
        const useDeinflectionsToggle = querySelectorNotNull(useDeinflectionsSetting, '.dictionary-use-deinflections-toggle');

        titleElement.textContent = title;
        versionElement.textContent = `rev.${revision}`;
        outdateElement.hidden = (version >= 3);
        countsElement.textContent = this._counts !== null ? JSON.stringify(this._counts, null, 4) : '';
        wildcardSupportedElement.checked = prefixWildcardsSupported;
        partsOfSpeechFilterSetting.hidden = !counts.terms.total;
        partsOfSpeechFilterToggle.dataset.setting = `dictionaries[${this._index}].partsOfSpeechFilter`;

        useDeinflectionsSetting.hidden = !counts.terms.total;
        useDeinflectionsToggle.dataset.setting = `dictionaries[${this._index}].useDeinflections`;

        this._setupDetails(detailsTableElement);

        modal.setVisible(true);
    }

    /**
     * @param {Element} detailsTable
     * @returns {boolean}
     */
    _setupDetails(detailsTable) {
        /** @type {Partial<Record<keyof (typeof this._dictionaryInfo & typeof this._dictionaryInfo.counts), string>>} */
        const targets = {
            author: 'Author',
            url: 'URL',
            description: 'Description',
            attribution: 'Attribution',
            sourceLanguage: 'Source Language',
            targetLanguage: 'Target Language',
            terms: 'Term Count',
            kanji: 'Kanji Count',
            kanjiMeta: 'Kanji Meta Count',
            tagMeta: 'Tag Count',
            media: 'Media Count',
        };

        const dictionaryInfo = {...this._dictionaryInfo, ...this._dictionaryInfo.counts};
        const fragment = document.createDocumentFragment();
        let any = false;
        for (const [key, label] of /** @type {([keyof (typeof this._dictionaryInfo & typeof this._dictionaryInfo.counts), string])[]} */ (Object.entries(targets))) {
            const info = dictionaryInfo[key];
            const displayText = ((_info) => {
                if (typeof _info === 'string') { return _info; }
                if (_info && typeof _info === 'object' && 'total' in _info) {
                    return _info.total ? `${_info.total}` : false;
                }
                return false;
            })(info);
            if (!displayText) { continue; }

            const details = /** @type {HTMLElement} */ (this._dictionaryController.instantiateTemplate('dictionary-details-entry'));
            details.dataset.type = key;

            /** @type {HTMLElement} */
            const labelElement = querySelectorNotNull(details, '.dictionary-details-entry-label');
            /** @type {HTMLElement} */
            const infoElement = querySelectorNotNull(details, '.dictionary-details-entry-info');

            labelElement.textContent = `${label}:`;
            infoElement.textContent = displayText;
            fragment.appendChild(details);

            any = true;
        }

        detailsTable.textContent = '';
        detailsTable.appendChild(fragment);
        return any;
    }

    /** */
    _delete() {
        this._dictionaryController.deleteDictionary(this.dictionaryTitle);
    }

    /**
     * @param {number} offset
     */
    _move(offset) {
        void this._dictionaryController.moveDictionaryOptions(this._index, this._index + offset);
    }

    /**
     * @param {Element} menu
     * @param {string} action
     * @param {boolean} enabled
     */
    _setMenuActionEnabled(menu, action, enabled) {
        const element = /** @type {?HTMLButtonElement} */ (menu.querySelector(`[data-menu-action="${action}"]`));
        if (element === null) { return; }
        element.disabled = !enabled;
    }

    /** */
    _showMoveToModal() {
        const {title} = this._dictionaryInfo;
        const count = this._dictionaryController.dictionaryOptionCount;
        const modal = this._dictionaryController.modalController.getModal('dictionary-move-location');
        if (modal === null) { return; }
        /** @type {HTMLInputElement} */
        const input = querySelectorNotNull(modal.node, '#dictionary-move-location');
        /** @type {HTMLElement} */
        const titleNode = querySelectorNotNull(modal.node, '.dictionary-title');

        modal.node.dataset.index = `${this._index}`;
        titleNode.textContent = title;
        input.value = `${this._index + 1}`;
        input.max = `${count}`;

        modal.setVisible(true);
    }

    /** */
    _showRenameModal() {
        const {title} = this._dictionaryInfo;
        const modal = this._dictionaryController.modalController.getModal('dictionary-set-alias');
        if (modal === null) { return; }
        /** @type {HTMLInputElement} */
        const input = querySelectorNotNull(modal.node, '#dictionary-alias-input');
        /** @type {HTMLElement} */
        const titleNode = querySelectorNotNull(modal.node, '.dictionary-title');

        modal.node.dataset.index = `${this._index}`;
        titleNode.textContent = title;
        input.value = this._aliasNode.textContent || title;

        modal.setVisible(true);
    }
}

class DictionaryExtraInfo {
    /**
     * @param {DictionaryController} parent
     * @param {import('dictionary-database').DictionaryCountGroup} totalCounts
     * @param {import('dictionary-database').DictionaryCountGroup} remainders
     * @param {number} totalRemainder
     */
    constructor(parent, totalCounts, remainders, totalRemainder) {
        /** @type {DictionaryController} */
        this._parent = parent;
        /** @type {import('dictionary-database').DictionaryCountGroup} */
        this._totalCounts = totalCounts;
        /** @type {import('dictionary-database').DictionaryCountGroup} */
        this._remainders = remainders;
        /** @type {number} */
        this._totalRemainder = totalRemainder;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {ChildNode[]} */
        this._nodes = [];
    }

    /**
     * @param {HTMLElement} container
     */
    prepare(container) {
        const fragment = this._parent.instantiateTemplateFragment('dictionary-extra');
        for (const node of fragment.childNodes) {
            this._nodes.push(node);
        }

        /** @type {HTMLButtonElement} */
        const dictionaryIntegrityButton = querySelectorNotNull(fragment, '.dictionary-integrity-button');

        const titleNode = fragment.querySelector('.dictionary-total-count');
        this._setTitle(titleNode);
        this._eventListeners.addEventListener(dictionaryIntegrityButton, 'click', this._onIntegrityButtonClick.bind(this), false);

        container.appendChild(fragment);
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();
        for (const node of this._nodes) {
            if (node.parentNode !== null) {
                node.parentNode.removeChild(node);
            }
        }
        this._nodes.length = 0;
    }

    // Private

    /** */
    _onIntegrityButtonClick() {
        this._showDetails();
    }

    /** */
    _showDetails() {
        const modal = this._parent.modalController.getModal('dictionary-extra-data');
        if (modal === null) { return; }

        /** @type {HTMLElement} */
        const dictionaryCounts = querySelectorNotNull(modal.node, '.dictionary-counts');

        const info = {counts: this._totalCounts, remainders: this._remainders};
        dictionaryCounts.textContent = JSON.stringify(info, null, 4);
        const titleNode = modal.node.querySelector('.dictionary-total-count');
        this._setTitle(titleNode);

        modal.setVisible(true);
    }

    /**
     * @param {?Element} node
     */
    _setTitle(node) {
        if (node === null) { return; }
        node.textContent = `${this._totalRemainder} item${this._totalRemainder !== 1 ? 's' : ''}`;
    }
}

export class DictionaryController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     * @param {import('./modal-controller.js').ModalController} modalController
     * @param {import('./status-footer.js').StatusFooter} statusFooter
     */
    constructor(settingsController, modalController, statusFooter) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {import('./modal-controller.js').ModalController} */
        this._modalController = modalController;
        /** @type {import('./status-footer.js').StatusFooter} */
        this._statusFooter = statusFooter;
        /** @type {?import('dictionary-importer').Summary[]} */
        this._dictionaries = null;
        /** @type {DictionaryEntry[]} */
        this._dictionaryEntries = [];
        /** @type {?import('core').TokenObject} */
        this._databaseStateToken = null;
        /** @type {boolean} */
        this._checkingUpdates = false;
        /** @type {boolean} */
        this._checkingIntegrity = false;
        /** @type {?HTMLButtonElement} */
        this._checkUpdatesButton = document.querySelector('#dictionary-check-updates');
        /** @type {?HTMLButtonElement} */
        this._checkIntegrityButton = document.querySelector('#dictionary-check-integrity');
        /** @type {HTMLElement} */
        this._dictionaryEntryContainer = querySelectorNotNull(document, '#dictionary-list');
        /** @type {?HTMLElement} */
        this._dictionaryInstallCountNode = document.querySelector('#dictionary-install-count');
        /** @type {?HTMLElement} */
        this._dictionaryEnabledCountNode = document.querySelector('#dictionary-enabled-count');
        /** @type {?NodeListOf<HTMLElement>} */
        this._noDictionariesInstalledWarnings = null;
        /** @type {?NodeListOf<HTMLElement>} */
        this._noDictionariesEnabledWarnings = null;
        /** @type {?import('./modal.js').Modal} */
        this._deleteDictionaryModal = null;
        /** @type {?import('./modal.js').Modal} */
        this._updateDictionaryModal = null;
        /** @type {HTMLInputElement} */
        this._allCheckbox = querySelectorNotNull(document, '#all-dictionaries-enabled');
        /** @type {?DictionaryExtraInfo} */
        this._extraInfo = null;
        /** @type {boolean} */
        this._isDeleting = false;
    }

    /** @type {import('./modal-controller.js').ModalController} */
    get modalController() {
        return this._modalController;
    }

    /** @type {number} */
    get dictionaryOptionCount() {
        return this._dictionaryEntries.length;
    }

    /** */
    async prepare() {
        this._noDictionariesInstalledWarnings = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.no-dictionaries-installed-warning'));
        this._noDictionariesEnabledWarnings = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.no-dictionaries-enabled-warning'));
        this._deleteDictionaryModal = this._modalController.getModal('dictionary-confirm-delete');
        this._updateDictionaryModal = this._modalController.getModal('dictionary-confirm-update');
        /** @type {HTMLButtonElement} */
        const dictionaryDeleteButton = querySelectorNotNull(document, '#dictionary-confirm-delete-button');
        /** @type {HTMLButtonElement} */
        const dictionaryUpdateButton = querySelectorNotNull(document, '#dictionary-confirm-update-button');

        /** @type {HTMLButtonElement} */
        const dictionaryMoveButton = querySelectorNotNull(document, '#dictionary-move-button');

        /** @type {HTMLButtonElement} */
        const dictionaryResetAliasButton = querySelectorNotNull(document, '#dictionary-reset-alias-button');
        /** @type {HTMLButtonElement} */
        const dictionarySetAliasButton = querySelectorNotNull(document, '#dictionary-set-alias-button');

        this._settingsController.application.on('databaseUpdated', this._onDatabaseUpdated.bind(this));
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));
        this._allCheckbox.addEventListener('change', this._onAllCheckboxChange.bind(this), false);
        dictionaryDeleteButton.addEventListener('click', this._onDictionaryConfirmDelete.bind(this), false);
        dictionaryUpdateButton.addEventListener('click', this._onDictionaryConfirmUpdate.bind(this), false);

        dictionaryMoveButton.addEventListener('click', this._onDictionaryMoveButtonClick.bind(this), false);

        dictionarySetAliasButton.addEventListener('click', this._onDictionarySetAliasButtonClick.bind(this), false);
        dictionaryResetAliasButton.addEventListener('click', this._onDictionaryResetAliasButtonClick.bind(this), false);

        this._onDragOverThrottled = throttle(this._onDragOver.bind(this), 100, this);

        this._dictionaryEntryContainer.addEventListener('dragover', this._onDragOver.bind(this), false);

        if (this._checkUpdatesButton !== null) {
            this._checkUpdatesButton.addEventListener('click', this._onCheckUpdatesButtonClick.bind(this), false);
        }
        if (this._checkIntegrityButton !== null) {
            this._checkIntegrityButton.addEventListener('click', this._onCheckIntegrityButtonClick.bind(this), false);
        }

        this._updateDictionaryEntryCount();

        await this._onDatabaseUpdated();
    }

    /**
     * @param {string} dictionaryTitle
     */
    deleteDictionary(dictionaryTitle) {
        if (this._isDeleting) { return; }
        const modal = /** @type {import('./modal.js').Modal} */ (this._deleteDictionaryModal);
        modal.node.dataset.dictionaryTitle = dictionaryTitle;
        /** @type {Element} */
        const nameElement = querySelectorNotNull(modal.node, '#dictionary-confirm-delete-name');
        nameElement.textContent = dictionaryTitle;
        modal.setVisible(true);
    }

    /**
     * @param {string} dictionaryTitle
     * @param {string|undefined} downloadUrl
     */
    updateDictionary(dictionaryTitle, downloadUrl) {
        const modal = this._updateDictionaryModal;
        if (modal === null) { return; }
        modal.node.dataset.downloadUrl = downloadUrl;
        modal.node.dataset.dictionaryTitle = dictionaryTitle;
        /** @type {Element} */
        const nameElement = querySelectorNotNull(modal.node, '#dictionary-confirm-update-name');
        nameElement.textContent = dictionaryTitle;
        modal.setVisible(true);
    }

    /**
     * @param {number} currentIndex
     * @param {number} targetIndex
     */
    async moveDictionaryOptions(currentIndex, targetIndex) {
        const options = await this._settingsController.getOptions();
        const {dictionaries} = options;
        if (
            currentIndex < 0 || currentIndex >= dictionaries.length ||
            targetIndex < 0 || targetIndex >= dictionaries.length ||
            currentIndex === targetIndex
        ) {
            return;
        }

        const item = dictionaries.splice(currentIndex, 1)[0];
        dictionaries.splice(targetIndex, 0, item);

        await this._settingsController.modifyProfileSettings([{
            action: 'set',
            path: 'dictionaries',
            value: dictionaries,
        }]);

        /** @type {import('settings-controller').EventArgument<'dictionarySettingsReordered'>} */
        const event = {source: this};
        this._settingsController.trigger('dictionarySettingsReordered', event);

        await this._updateEntries();
    }

    /**
     * @param {string} name
     * @returns {Element}
     */
    instantiateTemplate(name) {
        return this._settingsController.instantiateTemplate(name);
    }

    /**
     * @param {string} name
     * @returns {DocumentFragment}
     */
    instantiateTemplateFragment(name) {
        return this._settingsController.instantiateTemplateFragment(name);
    }

    /** */
    async updateDictionariesEnabled() {
        const options = await this._settingsController.getOptions();
        this._updateDictionariesEnabledWarnings(options);
    }

    /**
     * @param {string} name
     * @param {boolean} enabled
     * @param {string} styles
     * @returns {import('settings').DictionaryOptions}
     */
    static createDefaultDictionarySettings(name, enabled, styles) {
        return {
            name,
            alias: name,
            priority: 0,
            enabled,
            allowSecondarySearches: false,
            definitionsCollapsible: 'not-collapsible',
            partsOfSpeechFilter: true,
            useDeinflections: true,
            styles: styles ?? '',
        };
    }

    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     * @param {import('dictionary-importer').Summary[]|undefined} dictionaries
     * @param {import('settings').Options|undefined} optionsFull
     * @param {boolean} modifyGlobalSettings
     * @param {boolean} newDictionariesEnabled
     */
    static async ensureDictionarySettings(settingsController, dictionaries, optionsFull, modifyGlobalSettings, newDictionariesEnabled) {
        if (typeof dictionaries === 'undefined') {
            dictionaries = await settingsController.getDictionaryInfo();
        }
        if (typeof optionsFull === 'undefined') {
            optionsFull = await settingsController.getOptionsFull();
        }

        /** @type {Set<string>} */
        const installedDictionaries = new Set();
        for (const {title} of dictionaries) {
            installedDictionaries.add(title);
        }

        /** @type {import('settings-modifications').Modification[]} */
        const targets = [];
        const {profiles} = optionsFull;
        for (let i = 0, ii = profiles.length; i < ii; ++i) {
            let modified = false;
            const missingDictionaries = new Set(installedDictionaries);
            const dictionaryOptionsArray = profiles[i].options.dictionaries;
            for (let j = dictionaryOptionsArray.length - 1; j >= 0; --j) {
                const {name} = dictionaryOptionsArray[j];
                if (installedDictionaries.has(name)) {
                    missingDictionaries.delete(name);
                } else {
                    dictionaryOptionsArray.splice(j, 1);
                    modified = true;
                }
            }

            for (const name of missingDictionaries) {
                const value = DictionaryController.createDefaultDictionarySettings(name, newDictionariesEnabled, '');
                dictionaryOptionsArray.push(value);
                modified = true;
            }

            if (modified) {
                targets.push({
                    action: 'set',
                    path: `profiles[${i}].options.dictionaries`,
                    value: dictionaryOptionsArray,
                });
            }
        }

        if (modifyGlobalSettings && targets.length > 0) {
            await settingsController.modifyGlobalSettings(targets);
        }
    }

    // Private

    /**
     * @param {import('settings-controller').EventArgument<'optionsChanged'>} details
     */
    _onOptionsChanged({options}) {
        this._updateDictionariesEnabledWarnings(options);
        if (this._dictionaries !== null) {
            void this._updateEntries();
        }
    }

    /** */
    async _onDatabaseUpdated() {
        /** @type {?import('core').TokenObject} */
        const token = {};
        this._databaseStateToken = token;
        this._dictionaries = null;
        const dictionaries = await this._settingsController.getDictionaryInfo();
        if (this._databaseStateToken !== token) { return; }
        this._dictionaries = dictionaries;

        await this._updateEntries();
    }

    /** */
    _onAllCheckboxChange() {
        const allCheckbox = /** @type {HTMLInputElement} */ (this._allCheckbox);
        const value = allCheckbox.checked;
        allCheckbox.checked = !value;
        void this._setAllDictionariesEnabled(value);
    }

    /** */
    async _updateEntries() {
        const dictionaries = this._dictionaries;
        if (dictionaries === null) { return; }
        this._updateMainDictionarySelectOptions(dictionaries);

        for (const entry of this._dictionaryEntries) {
            entry.cleanup();
        }
        this._dictionaryEntries = [];
        this._updateDictionaryEntryCount();

        if (this._dictionaryInstallCountNode !== null) {
            this._dictionaryInstallCountNode.textContent = `${dictionaries.length}`;
        }

        const hasDictionary = (dictionaries.length > 0);
        for (const node of /** @type {NodeListOf<HTMLElement>} */ (this._noDictionariesInstalledWarnings)) {
            node.hidden = hasDictionary;
        }

        await DictionaryController.ensureDictionarySettings(this._settingsController, dictionaries, void 0, true, false);

        const options = await this._settingsController.getOptions();
        this._updateDictionariesEnabledWarnings(options);

        /** @type {Map<string, import('dictionary-importer').Summary>} */
        const dictionaryInfoMap = new Map();
        for (const dictionary of dictionaries) {
            dictionaryInfoMap.set(dictionary.title, dictionary);
        }

        const dictionaryOptionsArray = options.dictionaries;
        for (let i = 0, ii = dictionaryOptionsArray.length; i < ii; ++i) {
            const {name} = dictionaryOptionsArray[i];
            const dictionaryInfo = dictionaryInfoMap.get(name);
            if (typeof dictionaryInfo === 'undefined') { continue; }
            this._createDictionaryEntry(i, dictionaryInfo);
        }
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    _updateDictionariesEnabledWarnings(options) {
        const {dictionaries} = options;
        let enabledDictionaryCountValid = 0;
        let enabledDictionaryCount = 0;
        const dictionaryCount = dictionaries.length;
        if (this._dictionaries !== null) {
            const enabledDictionaries = new Set();
            for (const {name, enabled} of dictionaries) {
                if (enabled) {
                    ++enabledDictionaryCount;
                    enabledDictionaries.add(name);
                }
            }

            for (const {title} of this._dictionaries) {
                if (enabledDictionaries.has(title)) {
                    ++enabledDictionaryCountValid;
                }
            }
        }

        const hasEnabledDictionary = (enabledDictionaryCountValid > 0);
        if (hasEnabledDictionary) {
            this._settingsController.trigger('dictionaryEnabled', {});
        }
        for (const node of /** @type {NodeListOf<HTMLElement>} */ (this._noDictionariesEnabledWarnings)) {
            node.hidden = hasEnabledDictionary;
        }

        if (this._dictionaryEnabledCountNode !== null) {
            this._dictionaryEnabledCountNode.textContent = `${enabledDictionaryCountValid}`;
        }

        /** @type {HTMLInputElement} */ (this._allCheckbox).checked = (enabledDictionaryCount >= dictionaryCount);

        const entries = this._dictionaryEntries;
        for (let i = 0, ii = Math.min(entries.length, dictionaryCount); i < ii; ++i) {
            entries[i].setEnabled(dictionaries[i].enabled);
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onDictionaryConfirmDelete(e) {
        e.preventDefault();

        const modal = /** @type {import('./modal.js').Modal} */ (this._deleteDictionaryModal);
        modal.setVisible(false);

        const title = modal.node.dataset.dictionaryTitle;
        if (typeof title !== 'string') { return; }
        delete modal.node.dataset.dictionaryTitle;

        void this._deleteDictionary(title);
    }

    /**
     * @param {MouseEvent} e
     */
    _onDictionaryConfirmUpdate(e) {
        e.preventDefault();

        const modal = /** @type {import('./modal.js').Modal} */ (this._updateDictionaryModal);
        modal.setVisible(false);

        const title = modal.node.dataset.dictionaryTitle;
        const downloadUrl = modal.node.dataset.downloadUrl;
        if (typeof title !== 'string') { return; }
        delete modal.node.dataset.dictionaryTitle;

        void this._updateDictionary(title, downloadUrl);
    }

    /**
     * @param {MouseEvent} e
     */
    _onCheckIntegrityButtonClick(e) {
        e.preventDefault();
        void this._checkIntegrity();
    }

    /**
     * @param {MouseEvent} e
     */
    _onCheckUpdatesButtonClick(e) {
        e.preventDefault();
        void this._checkForUpdates();
    }

    /** */
    _onDictionaryMoveButtonClick() {
        const modal = /** @type {import('./modal.js').Modal} */ (this._modalController.getModal('dictionary-move-location'));
        const index = modal.node.dataset.index ?? '';
        const indexNumber = Number.parseInt(index, 10);
        if (Number.isNaN(indexNumber)) { return; }

        /** @type {HTMLInputElement} */
        const targetStringInput = querySelectorNotNull(document, '#dictionary-move-location');
        const targetString = targetStringInput.value;
        const target = Number.parseInt(targetString, 10) - 1;

        if (!Number.isFinite(target) || !Number.isFinite(indexNumber) || indexNumber === target) { return; }

        void this.moveDictionaryOptions(indexNumber, target);
    }

    /**
     * @param {DragEvent} e
     */
    _onDragOver(e) {
        const draggingIndex = this._dictionaryEntries.findIndex((entry) => entry.dictionaryItem.classList.contains('dragging'));
        if (draggingIndex === -1) { return; }
        const draggingItem = this._dictionaryEntries[draggingIndex].dictionaryItem;
        const nextDictionaryIndex = this._getDragOverDictionaryItem(draggingIndex, e.clientY);
        if (nextDictionaryIndex === draggingIndex) { return; }
        if (nextDictionaryIndex === null) {
            this._dictionaryEntryContainer.appendChild(draggingItem);
            return;
        }
        const nextDictionaryItem = this._dictionaryEntries[nextDictionaryIndex].dictionaryItem;
        this._dictionaryEntryContainer.insertBefore(draggingItem, nextDictionaryItem);
    }

    /**
     * @param {number} draggingIndex
     * @param {number} y
     * @returns {number|null}
     */
    _getDragOverDictionaryItem(draggingIndex, y) {
        const neighbors = [draggingIndex - 1, draggingIndex + 1]
            .filter((index) => index >= 0 && index < this._dictionaryEntries.length);

        /** @type {{index: number|null, offset: number}} */
        const currentBest = {index: null, offset: Number.NEGATIVE_INFINITY};
        for (const index of neighbors) {
            const item = this._dictionaryEntries[index].dictionaryItem;
            const {top, height} = item.getBoundingClientRect();
            const offset = y - (top + height / 2);
            if (offset < 0 && offset > currentBest.offset) {
                currentBest.index = index;
                currentBest.offset = offset;
            }
        }
        return currentBest.index;
    }

    /** */
    _onDictionaryResetAliasButtonClick() {
        const modal = /** @type {import('./modal.js').Modal} */ (this._modalController.getModal('dictionary-set-alias'));
        const index = modal.node.dataset.index ?? '';
        const indexNumber = Number.parseInt(index, 10);
        if (Number.isNaN(indexNumber)) { return; }

        /** @type {HTMLInputElement} */
        const input = querySelectorNotNull(modal.node, '#dictionary-alias-input');
        input.value = this._dictionaryEntries[indexNumber].dictionaryTitle;
    }

    /** */
    _onDictionarySetAliasButtonClick() {
        const modal = /** @type {import('./modal.js').Modal} */ (this._modalController.getModal('dictionary-set-alias'));
        const index = modal.node.dataset.index ?? '';
        const indexNumber = Number.parseInt(index, 10);
        if (Number.isNaN(indexNumber)) { return; }

        /** @type {HTMLInputElement} */
        const input = querySelectorNotNull(modal.node, '#dictionary-alias-input');
        const inputValue = input.value.trim();
        if (inputValue) {
            this._dictionaryEntries[indexNumber].updateAliasSettings(inputValue);
        }
    }

    /**
     * @param {import('dictionary-importer').Summary[]} dictionaries
     */
    _updateMainDictionarySelectOptions(dictionaries) {
        for (const select of document.querySelectorAll('[data-setting="general.mainDictionary"]')) {
            const fragment = document.createDocumentFragment();

            let option = document.createElement('option');
            option.className = 'text-muted';
            option.value = '';
            option.textContent = 'Not selected';
            fragment.appendChild(option);

            for (const {title, sequenced} of dictionaries) {
                if (!sequenced) { continue; }
                option = document.createElement('option');
                option.value = title;
                option.textContent = title;
                fragment.appendChild(option);
            }

            select.textContent = ''; // Empty
            select.appendChild(fragment);
        }
    }

    /** */
    async _checkForUpdates() {
        if (this._dictionaries === null || this._checkingIntegrity || this._checkingUpdates || this._isDeleting) { return; }
        try {
            this._checkingUpdates = true;
            this._setButtonsEnabled(false);

            const updateChecks = this._dictionaryEntries.map((entry) => entry.checkForUpdate());
            const updateCount = (await Promise.all(updateChecks)).reduce((sum, value) => (sum + (value ? 1 : 0)), 0);
            if (this._checkUpdatesButton !== null) {
                this._checkUpdatesButton.textContent = updateCount ? `${updateCount} update${updateCount > 1 ? 's' : ''}` : 'No updates';
            }
        } finally {
            this._setButtonsEnabled(true);
            this._checkingUpdates = false;
        }
    }

    /** */
    async _checkIntegrity() {
        if (this._dictionaries === null || this._checkingIntegrity || this._checkingUpdates || this._isDeleting) { return; }

        try {
            this._checkingIntegrity = true;
            this._setButtonsEnabled(false);

            const token = this._databaseStateToken;
            const dictionaryTitles = this._dictionaryEntries.map(({dictionaryTitle}) => dictionaryTitle);
            const {counts, total} = await new DictionaryWorker().getDictionaryCounts(dictionaryTitles, true);
            if (this._databaseStateToken !== token) { return; }

            for (let i = 0, ii = Math.min(counts.length, this._dictionaryEntries.length); i < ii; ++i) {
                const entry = this._dictionaryEntries[i];
                entry.setCounts(counts[i]);
            }

            this._setCounts(counts, /** @type {import('dictionary-database').DictionaryCountGroup} */ (total));
        } finally {
            this._setButtonsEnabled(true);
            this._checkingIntegrity = false;
        }
    }

    /**
     * @param {import('dictionary-database').DictionaryCountGroup[]} dictionaryCounts
     * @param {import('dictionary-database').DictionaryCountGroup} totalCounts
     */
    _setCounts(dictionaryCounts, totalCounts) {
        const remainders = Object.assign({}, totalCounts);
        const keys = Object.keys(remainders);

        for (const counts of dictionaryCounts) {
            for (const key of keys) {
                remainders[key] -= counts[key];
            }
        }

        let totalRemainder = 0;
        for (const key of keys) {
            totalRemainder += remainders[key];
        }

        if (this._extraInfo !== null) {
            this._extraInfo.cleanup();
            this._extraInfo = null;
        }

        if (totalRemainder > 0 && this._dictionaryEntryContainer !== null) {
            this._extraInfo = new DictionaryExtraInfo(this, totalCounts, remainders, totalRemainder);
            this._extraInfo.prepare(this._dictionaryEntryContainer);
        }
    }

    /**
     * @param {number} index
     * @param {import('dictionary-importer').Summary} dictionaryInfo
     */
    _createDictionaryEntry(index, dictionaryInfo) {
        const fragment = this.instantiateTemplateFragment('dictionary');

        const entry = new DictionaryEntry(this, fragment, index, dictionaryInfo);
        this._dictionaryEntries.push(entry);
        entry.prepare();

        const container = /** @type {HTMLElement} */ (this._dictionaryEntryContainer);
        const relative = container.querySelector('.dictionary-item-bottom');
        container.insertBefore(fragment, relative);

        this._updateDictionaryEntryCount();
    }

    /**
     * @param {string} dictionaryTitle
     */
    async _deleteDictionary(dictionaryTitle) {
        if (this._isDeleting || this._checkingIntegrity) { return; }

        const index = this._dictionaryEntries.findIndex((entry) => entry.dictionaryTitle === dictionaryTitle);
        if (index < 0) { return; }

        const statusFooter = this._statusFooter;
        const progressSelector = '.dictionary-delete-progress';
        const progressContainers = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(`#dictionaries-modal ${progressSelector}`));
        const progressBars = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(`${progressSelector} .progress-bar`));
        const infoLabels = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(`${progressSelector} .progress-info`));
        const statusLabels = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(`${progressSelector} .progress-status`));
        const prevention = this._settingsController.preventPageExit();
        try {
            this._isDeleting = true;
            this._setButtonsEnabled(false);

            /**
             * @param {import('dictionary-database').DeleteDictionaryProgressData} details
             */
            const onProgress = ({processed, count, storeCount, storesProcesed}) => {
                const percent = (
                    (count > 0 && storesProcesed > 0) ?
                    (processed / count) * (storesProcesed / storeCount) * 100 :
                    0
                );
                const cssString = `${percent}%`;
                const statusString = `${percent.toFixed(0)}%`;
                for (const progressBar of progressBars) { progressBar.style.width = cssString; }
                for (const label of statusLabels) { label.textContent = statusString; }
            };

            onProgress({processed: 0, count: 1, storeCount: 1, storesProcesed: 0});

            for (const progress of progressContainers) { progress.hidden = false; }
            for (const label of infoLabels) { label.textContent = 'Deleting dictionary...'; }
            if (statusFooter !== null) { statusFooter.setTaskActive(progressSelector, true); }

            await this._deleteDictionaryInternal(dictionaryTitle, onProgress);
            await this._deleteDictionarySettings(dictionaryTitle);
        } catch (e) {
            log.error(e);
        } finally {
            prevention.end();
            for (const progress of progressContainers) { progress.hidden = true; }
            if (statusFooter !== null) { statusFooter.setTaskActive(progressSelector, false); }
            this._setButtonsEnabled(true);
            this._isDeleting = false;
            this._triggerStorageChanged();
        }
    }

    /**
     * @param {string} dictionaryTitle
     * @param {string|undefined} downloadUrl
     */
    async _updateDictionary(dictionaryTitle, downloadUrl) {
        if (this._checkingIntegrity || this._checkingUpdates || this._isDeleting || this._dictionaries === null) { return; }

        const dictionaryInfo = this._dictionaries.find((entry) => entry.title === dictionaryTitle);
        if (typeof dictionaryInfo === 'undefined') { throw new Error('Dictionary not found'); }
        downloadUrl = downloadUrl ?? dictionaryInfo.downloadUrl;
        if (typeof downloadUrl !== 'string') { throw new Error('Attempted to update dictionary without download URL'); }

        await this._deleteDictionary(dictionaryTitle);

        this._settingsController.trigger('importDictionaryFromUrl', {url: downloadUrl});
    }

    /**
     * @param {boolean} value
     */
    _setButtonsEnabled(value) {
        value = !value;
        for (const node of /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('.dictionary-database-mutating-input'))) {
            node.disabled = value;
        }
    }

    /**
     * @param {string} dictionaryTitle
     * @param {import('dictionary-worker').DeleteProgressCallback} onProgress
     */
    async _deleteDictionaryInternal(dictionaryTitle, onProgress) {
        await new DictionaryWorker().deleteDictionary(dictionaryTitle, onProgress);
        void this._settingsController.application.api.triggerDatabaseUpdated('dictionary', 'delete');
    }

    /**
     * @param {string} dictionaryTitle
     */
    async _deleteDictionarySettings(dictionaryTitle) {
        const optionsFull = await this._settingsController.getOptionsFull();
        const {profiles} = optionsFull;
        /** @type {import('settings-modifications').Modification[]} */
        const targets = [];
        for (let i = 0, ii = profiles.length; i < ii; ++i) {
            const {options: {dictionaries}} = profiles[i];
            for (let j = 0, jj = dictionaries.length; j < jj; ++j) {
                if (dictionaries[j].name !== dictionaryTitle) { continue; }
                const path = `profiles[${i}].options.dictionaries`;
                targets.push({
                    action: 'splice',
                    path,
                    start: j,
                    deleteCount: 1,
                    items: [],
                });
            }
        }
        await this._settingsController.modifyGlobalSettings(targets);
    }

    /** */
    _triggerStorageChanged() {
        this._settingsController.application.triggerStorageChanged();
    }

    /** */
    _updateDictionaryEntryCount() {
        /** @type {HTMLElement} */ (this._dictionaryEntryContainer).dataset.count = `${this._dictionaryEntries.length}`;
    }

    /**
     * @param {boolean} value
     */
    async _setAllDictionariesEnabled(value) {
        const options = await this._settingsController.getOptions();
        const {dictionaries} = options;

        /** @type {import('settings-modifications').Modification[]} */
        const targets = [];
        for (let i = 0, ii = dictionaries.length; i < ii; ++i) {
            targets.push({
                action: 'set',
                path: `dictionaries[${i}].enabled`,
                value,
            });
        }
        await this._settingsController.modifyProfileSettings(targets);

        await this.updateDictionariesEnabled();
    }
}

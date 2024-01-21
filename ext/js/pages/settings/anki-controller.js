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

import {AnkiConnect} from '../../comm/anki-connect.js';
import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {ExtensionError} from '../../core/extension-error.js';
import {log} from '../../core/logger.js';
import {toError} from '../../core/to-error.js';
import {AnkiUtil} from '../../data/anki-util.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {SelectorObserver} from '../../dom/selector-observer.js';
import {ObjectPropertyAccessor} from '../../general/object-property-accessor.js';
import {yomitan} from '../../yomitan.js';

export class AnkiController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {AnkiConnect} */
        this._ankiConnect = new AnkiConnect();
        /** @type {SelectorObserver<AnkiCardController>} */
        this._selectorObserver = new SelectorObserver({
            selector: '.anki-card',
            ignoreSelector: null,
            onAdded: this._createCardController.bind(this),
            onRemoved: this._removeCardController.bind(this),
            isStale: this._isCardControllerStale.bind(this)
        });
        /** @type {Intl.Collator} */
        this._stringComparer = new Intl.Collator(); // Locale does not matter
        /** @type {?Promise<import('anki-controller').AnkiData>} */
        this._getAnkiDataPromise = null;
        /** @type {HTMLElement} */
        this._ankiErrorMessageNode = querySelectorNotNull(document, '#anki-error-message');
        const ankiErrorMessageNodeDefaultContent = this._ankiErrorMessageNode.textContent;
        /** @type {string} */
        this._ankiErrorMessageNodeDefaultContent = typeof ankiErrorMessageNodeDefaultContent === 'string' ? ankiErrorMessageNodeDefaultContent : '';
        /** @type {HTMLElement} */
        this._ankiErrorMessageDetailsNode = querySelectorNotNull(document, '#anki-error-message-details');
        /** @type {HTMLElement} */
        this._ankiErrorMessageDetailsContainer = querySelectorNotNull(document, '#anki-error-message-details-container');
        /** @type {HTMLElement} */
        this._ankiErrorMessageDetailsToggle = querySelectorNotNull(document, '#anki-error-message-details-toggle');
        /** @type {HTMLElement} */
        this._ankiErrorInvalidResponseInfo = querySelectorNotNull(document, '#anki-error-invalid-response-info');
        /** @type {HTMLElement} */
        this._ankiCardPrimary = querySelectorNotNull(document, '#anki-card-primary');
        /** @type {?Error} */
        this._ankiError = null;
        /** @type {?import('core').TokenObject} */
        this._validateFieldsToken = null;
        /** @type {?HTMLInputElement} */
        this._ankiEnableCheckbox = document.querySelector('[data-setting="anki.enable"]');
    }

    /** @type {import('./settings-controller.js').SettingsController} */
    get settingsController() {
        return this._settingsController;
    }

    /** */
    async prepare() {
        /** @type {HTMLElement} */
        const ankiApiKeyInput = querySelectorNotNull(document, '#anki-api-key-input');
        const ankiCardPrimaryTypeRadios = /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('input[type=radio][name=anki-card-primary-type]'));
        /** @type {HTMLElement} */
        const ankiErrorLog = querySelectorNotNull(document, '#anki-error-log');

        this._setupFieldMenus();

        this._ankiErrorMessageDetailsToggle.addEventListener('click', this._onAnkiErrorMessageDetailsToggleClick.bind(this), false);
        if (this._ankiEnableCheckbox !== null) {
            this._ankiEnableCheckbox.addEventListener(
                /** @type {string} */ ('settingChanged'),
                /** @type {EventListener} */ (this._onAnkiEnableChanged.bind(this)),
                false
            );
        }
        for (const input of ankiCardPrimaryTypeRadios) {
            input.addEventListener('change', this._onAnkiCardPrimaryTypeRadioChange.bind(this), false);
        }

        const testAnkiNoteViewerButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll('.test-anki-note-viewer-button'));
        const onTestAnkiNoteViewerButtonClick = this._onTestAnkiNoteViewerButtonClick.bind(this);
        for (const button of testAnkiNoteViewerButtons) {
            button.addEventListener('click', onTestAnkiNoteViewerButtonClick, false);
        }

        ankiErrorLog.addEventListener('click', this._onAnkiErrorLogLinkClick.bind(this));

        ankiApiKeyInput.addEventListener('focus', this._onApiKeyInputFocus.bind(this));
        ankiApiKeyInput.addEventListener('blur', this._onApiKeyInputBlur.bind(this));

        const onAnkiSettingChanged = () => { this._updateOptions(); };
        const nodes = [ankiApiKeyInput, ...document.querySelectorAll('[data-setting="anki.enable"]')];
        for (const node of nodes) {
            node.addEventListener('settingChanged', onAnkiSettingChanged);
        }

        await this._updateOptions();
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));
    }

    /**
     * @param {string} type
     * @returns {string[]}
     */
    getFieldMarkers(type) {
        switch (type) {
            case 'terms':
                return [
                    'audio',
                    'clipboard-image',
                    'clipboard-text',
                    'cloze-body',
                    'cloze-prefix',
                    'cloze-suffix',
                    'conjugation',
                    'dictionary',
                    'document-title',
                    'expression',
                    'frequencies',
                    'furigana',
                    'furigana-plain',
                    'glossary',
                    'glossary-brief',
                    'glossary-no-dictionary',
                    'part-of-speech',
                    'pitch-accents',
                    'pitch-accent-graphs',
                    'pitch-accent-positions',
                    'phonetic-transcriptions',
                    'reading',
                    'screenshot',
                    'search-query',
                    'selection-text',
                    'sentence',
                    'sentence-furigana',
                    'tags',
                    'url'
                ];
            case 'kanji':
                return [
                    'character',
                    'clipboard-image',
                    'clipboard-text',
                    'cloze-body',
                    'cloze-prefix',
                    'cloze-suffix',
                    'dictionary',
                    'document-title',
                    'glossary',
                    'kunyomi',
                    'onyomi',
                    'screenshot',
                    'search-query',
                    'selection-text',
                    'sentence-furigana',
                    'sentence',
                    'stroke-count',
                    'tags',
                    'url'
                ];
            default:
                return [];
        }
    }

    /**
     * @returns {Promise<import('anki-controller').AnkiData>}
     */
    async getAnkiData() {
        let promise = this._getAnkiDataPromise;
        if (promise === null) {
            promise = this._getAnkiData();
            this._getAnkiDataPromise = promise;
            promise.finally(() => { this._getAnkiDataPromise = null; });
        }
        return promise;
    }

    /**
     * @param {string} model
     * @returns {Promise<string[]>}
     */
    async getModelFieldNames(model) {
        return await this._ankiConnect.getModelFieldNames(model);
    }

    /**
     * @param {string} fieldValue
     * @returns {string[]}
     */
    getRequiredPermissions(fieldValue) {
        return this._settingsController.permissionsUtil.getRequiredPermissionsForAnkiFieldValue(fieldValue);
    }

    // Private

    /** */
    async _updateOptions() {
        const options = await this._settingsController.getOptions();
        const optionsContext = this._settingsController.getOptionsContext();
        this._onOptionsChanged({options, optionsContext});
    }

    /**
     * @param {import('settings-controller').EventArgument<'optionsChanged'>} details
     */
    async _onOptionsChanged({options: {anki}}) {
        /** @type {?string} */
        let apiKey = anki.apiKey;
        if (apiKey === '') { apiKey = null; }
        this._ankiConnect.server = anki.server;
        this._ankiConnect.enabled = anki.enable;
        this._ankiConnect.apiKey = apiKey;

        this._selectorObserver.disconnect();
        this._selectorObserver.observe(document.documentElement, true);
    }

    /** */
    _onAnkiErrorMessageDetailsToggleClick() {
        const node = /** @type {HTMLElement} */ (this._ankiErrorMessageDetailsContainer);
        node.hidden = !node.hidden;
    }

    /**
     * @param {import('dom-data-binder').SettingChangedEvent} event
     */
    _onAnkiEnableChanged({detail: {value}}) {
        if (this._ankiConnect.server === null) { return; }
        this._ankiConnect.enabled = typeof value === 'boolean' && value;

        for (const cardController of this._selectorObserver.datas()) {
            cardController.updateAnkiState();
        }
    }

    /**
     * @param {Event} e
     */
    _onAnkiCardPrimaryTypeRadioChange(e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        if (!node.checked) { return; }
        const {value, ankiCardMenu} = node.dataset;
        if (typeof value !== 'string') { return; }
        this._setAnkiCardPrimaryType(value, ankiCardMenu);
    }

    /** */
    _onAnkiErrorLogLinkClick() {
        if (this._ankiError === null) { return; }
        // eslint-disable-next-line no-console
        console.log({error: this._ankiError});
    }

    /**
     * @param {MouseEvent} e
     */
    _onTestAnkiNoteViewerButtonClick(e) {
        const element = /** @type {HTMLElement} */ (e.currentTarget);
        // Anki note GUI mode
        const {mode} = element.dataset;
        if (typeof mode !== 'string') { return; }

        const normalizedMode = this._normalizeAnkiNoteGuiMode(mode);
        if (normalizedMode === null) { return; }
        this._testAnkiNoteViewerSafe(normalizedMode);
    }

    /**
     * @param {Event} e
     */
    _onApiKeyInputFocus(e) {
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        element.type = 'text';
    }

    /**
     * @param {Event} e
     */
    _onApiKeyInputBlur(e) {
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        element.type = 'password';
    }

    /**
     * @param {string} ankiCardType
     * @param {string} [ankiCardMenu]
     */
    _setAnkiCardPrimaryType(ankiCardType, ankiCardMenu) {
        if (this._ankiCardPrimary === null) { return; }
        this._ankiCardPrimary.dataset.ankiCardType = ankiCardType;
        if (typeof ankiCardMenu !== 'undefined') {
            this._ankiCardPrimary.dataset.ankiCardMenu = ankiCardMenu;
        } else {
            delete this._ankiCardPrimary.dataset.ankiCardMenu;
        }
    }

    /**
     * @param {Element} node
     * @returns {AnkiCardController}
     */
    _createCardController(node) {
        const cardController = new AnkiCardController(this._settingsController, this, /** @type {HTMLElement} */ (node));
        cardController.prepare();
        return cardController;
    }

    /**
     * @param {Element} _node
     * @param {AnkiCardController} cardController
     */
    _removeCardController(_node, cardController) {
        cardController.cleanup();
    }

    /**
     * @param {Element} _node
     * @param {AnkiCardController} cardController
     * @returns {boolean}
     */
    _isCardControllerStale(_node, cardController) {
        return cardController.isStale();
    }

    /** */
    _setupFieldMenus() {
        /** @type {[types: string[], selector: string][]} */
        const fieldMenuTargets = [
            [['terms'], '#anki-card-terms-field-menu-template'],
            [['kanji'], '#anki-card-kanji-field-menu-template'],
            [['terms', 'kanji'], '#anki-card-all-field-menu-template']
        ];
        for (const [types, selector] of fieldMenuTargets) {
            const element = /** @type {HTMLTemplateElement} */ (document.querySelector(selector));
            if (element === null) { continue; }

            let markers = [];
            for (const type of types) {
                markers.push(...this.getFieldMarkers(type));
            }
            markers = [...new Set(markers)];

            const container = element.content.querySelector('.popup-menu-body');
            if (container === null) { return; }

            const fragment = document.createDocumentFragment();
            for (const marker of markers) {
                const option = document.createElement('button');
                option.textContent = marker;
                option.className = 'popup-menu-item popup-menu-item-thin';
                option.dataset.menuAction = 'setFieldMarker';
                option.dataset.marker = marker;
                fragment.appendChild(option);
            }
            container.appendChild(fragment);
        }
    }

    /**
     * @returns {Promise<import('anki-controller').AnkiData>}
     */
    async _getAnkiData() {
        this._setAnkiStatusChanging();
        const [
            [deckNames, getDeckNamesError],
            [modelNames, getModelNamesError]
        ] = await Promise.all([
            this._getDeckNames(),
            this._getModelNames()
        ]);

        if (getDeckNamesError !== null) {
            this._showAnkiError(getDeckNamesError);
        } else if (getModelNamesError !== null) {
            this._showAnkiError(getModelNamesError);
        } else {
            this._hideAnkiError();
        }

        return {deckNames, modelNames};
    }

    /**
     * @returns {Promise<[deckNames: string[], error: ?Error]>}
     */
    async _getDeckNames() {
        try {
            const result = await this._ankiConnect.getDeckNames();
            this._sortStringArray(result);
            return [result, null];
        } catch (e) {
            return [[], toError(e)];
        }
    }

    /**
     * @returns {Promise<[modelNames: string[], error: ?Error]>}
     */
    async _getModelNames() {
        try {
            const result = await this._ankiConnect.getModelNames();
            this._sortStringArray(result);
            return [result, null];
        } catch (e) {
            return [[], toError(e)];
        }
    }

    /** */
    _setAnkiStatusChanging() {
        const ankiErrorMessageNode = /** @type {HTMLElement} */ (this._ankiErrorMessageNode);
        ankiErrorMessageNode.textContent = this._ankiErrorMessageNodeDefaultContent;
        ankiErrorMessageNode.classList.remove('danger-text');
    }

    /** */
    _hideAnkiError() {
        const ankiErrorMessageNode = /** @type {HTMLElement} */ (this._ankiErrorMessageNode);
        /** @type {HTMLElement} */ (this._ankiErrorMessageDetailsContainer).hidden = true;
        /** @type {HTMLElement} */ (this._ankiErrorMessageDetailsToggle).hidden = true;
        /** @type {HTMLElement} */ (this._ankiErrorInvalidResponseInfo).hidden = true;
        ankiErrorMessageNode.textContent = (this._ankiConnect.enabled ? 'Connected' : 'Not enabled');
        ankiErrorMessageNode.classList.remove('danger-text');
        /** @type {HTMLElement} */ (this._ankiErrorMessageDetailsNode).textContent = '';
        this._ankiError = null;
    }

    /**
     * @param {Error} error
     */
    _showAnkiError(error) {
        const ankiErrorMessageNode = /** @type {HTMLElement} */ (this._ankiErrorMessageNode);
        this._ankiError = error;

        let errorString = typeof error === 'object' && error !== null ? error.message : null;
        if (!errorString) { errorString = `${error}`; }
        if (!/[.!?]$/.test(errorString)) { errorString += '.'; }
        ankiErrorMessageNode.textContent = errorString;
        ankiErrorMessageNode.classList.add('danger-text');

        const data = error instanceof ExtensionError ? error.data : void 0;
        let details = '';
        if (typeof data !== 'undefined') {
            details += `${JSON.stringify(data, null, 4)}\n\n`;
        }
        details += `${error.stack}`.trimRight();
        /** @type {HTMLElement} */ (this._ankiErrorMessageDetailsNode).textContent = details;

        /** @type {HTMLElement} */ (this._ankiErrorMessageDetailsContainer).hidden = true;
        /** @type {HTMLElement} */ (this._ankiErrorInvalidResponseInfo).hidden = (errorString.indexOf('Invalid response') < 0);
        /** @type {HTMLElement} */ (this._ankiErrorMessageDetailsToggle).hidden = false;
    }

    /**
     * @param {string[]} array
     */
    _sortStringArray(array) {
        const stringComparer = this._stringComparer;
        array.sort((a, b) => stringComparer.compare(a, b));
    }

    /**
     * @param {import('settings').AnkiNoteGuiMode} mode
     */
    async _testAnkiNoteViewerSafe(mode) {
        this._setAnkiNoteViewerStatus(false, null);
        try {
            await this._testAnkiNoteViewer(mode);
        } catch (e) {
            this._setAnkiNoteViewerStatus(true, toError(e));
            return;
        }
        this._setAnkiNoteViewerStatus(true, null);
    }

    /**
     * @param {import('settings').AnkiNoteGuiMode} mode
     */
    async _testAnkiNoteViewer(mode) {
        const queries = [
            '"よむ" deck:current',
            '"よむ"',
            'deck:current',
            ''
        ];

        let noteId = null;
        for (const query of queries) {
            const notes = await yomitan.api.findAnkiNotes(query);
            if (notes.length > 0) {
                noteId = notes[0];
                break;
            }
        }

        if (noteId === null) {
            throw new Error('Could not find a note to test with');
        }

        await yomitan.api.noteView(noteId, mode, false);
    }

    /**
     * @param {boolean} visible
     * @param {?Error} error
     */
    _setAnkiNoteViewerStatus(visible, error) {
        /** @type {HTMLElement} */
        const node = querySelectorNotNull(document, '#test-anki-note-viewer-results');
        if (visible) {
            const success = (error === null);
            node.textContent = success ? 'Success!' : error.message;
            node.dataset.success = `${success}`;
        } else {
            node.textContent = '';
            delete node.dataset.success;
        }
        node.hidden = !visible;
    }

    /**
     * @param {string} value
     * @returns {?import('settings').AnkiNoteGuiMode}
     */
    _normalizeAnkiNoteGuiMode(value) {
        switch (value) {
            case 'browse':
            case 'edit':
                return value;
            default:
                return null;
        }
    }
}

class AnkiCardController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     * @param {AnkiController} ankiController
     * @param {HTMLElement} node
     */
    constructor(settingsController, ankiController, node) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {AnkiController} */
        this._ankiController = ankiController;
        /** @type {HTMLElement} */
        this._node = node;
        const {ankiCardType} = node.dataset;
        /** @type {string} */
        this._cardType = typeof ankiCardType === 'string' ? ankiCardType : 'terms';
        /** @type {string|undefined} */
        this._cardMenu = node.dataset.ankiCardMenu;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {EventListenerCollection} */
        this._fieldEventListeners = new EventListenerCollection();
        /** @type {import('settings').AnkiNoteFields} */
        this._fields = {};
        /** @type {?string} */
        this._modelChangingTo = null;
        /** @type {?Element} */
        this._ankiCardFieldsContainer = null;
        /** @type {boolean} */
        this._cleaned = false;
        /** @type {import('anki-controller').FieldEntry[]} */
        this._fieldEntries = [];
        /** @type {AnkiCardSelectController} */
        this._deckController = new AnkiCardSelectController();
        /** @type {AnkiCardSelectController} */
        this._modelController = new AnkiCardSelectController();
    }

    /** */
    async prepare() {
        const options = await this._settingsController.getOptions();
        const ankiOptions = options.anki;
        if (this._cleaned) { return; }

        const cardOptions = this._getCardOptions(ankiOptions, this._cardType);
        if (cardOptions === null) { return; }
        const {deck, model, fields} = cardOptions;
        /** @type {HTMLSelectElement} */
        const deckControllerSelect = querySelectorNotNull(this._node, '.anki-card-deck');
        /** @type {HTMLSelectElement} */
        const modelControllerSelect = querySelectorNotNull(this._node, '.anki-card-model');
        this._deckController.prepare(deckControllerSelect, deck);
        this._modelController.prepare(modelControllerSelect, model);
        this._fields = fields;

        this._ankiCardFieldsContainer = this._node.querySelector('.anki-card-fields');

        this._setupFields();

        this._eventListeners.addEventListener(this._deckController.select, 'change', this._onCardDeckChange.bind(this), false);
        this._eventListeners.addEventListener(this._modelController.select, 'change', this._onCardModelChange.bind(this), false);
        this._eventListeners.on(this._settingsController, 'permissionsChanged', this._onPermissionsChanged.bind(this));

        await this.updateAnkiState();
    }

    /** */
    cleanup() {
        this._cleaned = true;
        this._fieldEntries = [];
        this._eventListeners.removeAllEventListeners();
    }

    /** */
    async updateAnkiState() {
        if (this._fields === null) { return; }
        const {deckNames, modelNames} = await this._ankiController.getAnkiData();
        if (this._cleaned) { return; }
        this._deckController.setOptionValues(deckNames);
        this._modelController.setOptionValues(modelNames);
    }

    /**
     * @returns {boolean}
     */
    isStale() {
        return (this._cardType !== this._node.dataset.ankiCardType);
    }

    // Private

    /**
     * @param {Event} e
     */
    _onCardDeckChange(e) {
        const node = /** @type {HTMLSelectElement} */ (e.currentTarget);
        this._setDeck(node.value);
    }

    /**
     * @param {Event} e
     */
    _onCardModelChange(e) {
        const node = /** @type {HTMLSelectElement} */ (e.currentTarget);
        this._setModel(node.value);
    }

    /**
     * @param {number} index
     * @param {Event} e
     */
    _onFieldChange(index, e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        this._validateFieldPermissions(node, index, true);
        this._validateField(node, index);
    }

    /**
     * @param {number} index
     * @param {Event} e
     */
    _onFieldInput(index, e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        this._validateField(node, index);
    }

    /**
     * @param {number} index
     * @param {import('dom-data-binder').SettingChangedEvent} e
     */
    _onFieldSettingChanged(index, e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        this._validateFieldPermissions(node, index, false);
    }

    /**
     * @param {import('popup-menu').MenuOpenEvent} event
     */
    _onFieldMenuOpen(event) {
        const button = /** @type {HTMLElement} */ (event.currentTarget);
        const {menu} = event.detail;
        const {index, fieldName} = button.dataset;
        const indexNumber = typeof index === 'string' ? Number.parseInt(index, 10) : 0;
        if (typeof fieldName !== 'string') { return; }

        const defaultValue = this._getDefaultFieldValue(fieldName, indexNumber, this._cardType, null);
        if (defaultValue === '') { return; }

        const match = /^\{([\w\W]+)\}$/.exec(defaultValue);
        if (match === null) { return; }

        const defaultMarker = match[1];
        const item = menu.bodyNode.querySelector(`.popup-menu-item[data-marker="${defaultMarker}"]`);
        if (item === null) { return; }

        item.classList.add('popup-menu-item-bold');
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} event
     */
    _onFieldMenuClose(event) {
        const button = /** @type {HTMLElement} */ (event.currentTarget);
        const {action, item} = event.detail;
        switch (action) {
            case 'setFieldMarker':
                if (item !== null) {
                    const {marker} = item.dataset;
                    if (typeof marker === 'string') {
                        this._setFieldMarker(button, marker);
                    }
                }
                break;
        }
    }

    /**
     * @param {HTMLInputElement} node
     * @param {number} index
     */
    _validateField(node, index) {
        let valid = (node.dataset.hasPermissions !== 'false');
        if (valid && index === 0 && !AnkiUtil.stringContainsAnyFieldMarker(node.value)) {
            valid = false;
        }
        node.dataset.invalid = `${!valid}`;
    }

    /**
     * @param {Element} element
     * @param {string} marker
     */
    _setFieldMarker(element, marker) {
        const container = element.closest('.anki-card-field-value-container');
        if (container === null) { return; }
        /** @type {HTMLInputElement} */
        const input = querySelectorNotNull(container, '.anki-card-field-value');
        input.value = `{${marker}}`;
        input.dispatchEvent(new Event('change'));
    }

    /**
     * @param {import('settings').AnkiOptions} ankiOptions
     * @param {string} cardType
     * @returns {?import('settings').AnkiNoteOptions}
     */
    _getCardOptions(ankiOptions, cardType) {
        switch (cardType) {
            case 'terms': return ankiOptions.terms;
            case 'kanji': return ankiOptions.kanji;
            default: return null;
        }
    }

    /** */
    _setupFields() {
        this._fieldEventListeners.removeAllEventListeners();

        const totalFragment = document.createDocumentFragment();
        this._fieldEntries = [];
        let index = 0;
        for (const [fieldName, fieldValue] of Object.entries(this._fields)) {
            const content = this._settingsController.instantiateTemplateFragment('anki-card-field');

            /** @type {HTMLElement} */
            const fieldNameContainerNode = querySelectorNotNull(content, '.anki-card-field-name-container');
            fieldNameContainerNode.dataset.index = `${index}`;
            /** @type {HTMLElement} */
            const fieldNameNode = querySelectorNotNull(content, '.anki-card-field-name');
            fieldNameNode.textContent = fieldName;

            /** @type {HTMLElement} */
            const valueContainer = querySelectorNotNull(content, '.anki-card-field-value-container');
            valueContainer.dataset.index = `${index}`;

            /** @type {HTMLInputElement} */
            const inputField = querySelectorNotNull(content, '.anki-card-field-value');
            inputField.value = fieldValue;
            inputField.dataset.setting = ObjectPropertyAccessor.getPathString(['anki', this._cardType, 'fields', fieldName]);
            this._validateFieldPermissions(inputField, index, false);

            this._fieldEventListeners.addEventListener(inputField, 'change', this._onFieldChange.bind(this, index), false);
            this._fieldEventListeners.addEventListener(inputField, 'input', this._onFieldInput.bind(this, index), false);
            this._fieldEventListeners.addEventListener(inputField, 'settingChanged', this._onFieldSettingChanged.bind(this, index), false);
            this._validateField(inputField, index);

            /** @type {?HTMLElement} */
            const menuButton = content.querySelector('.anki-card-field-value-menu-button');
            if (menuButton !== null) {
                if (typeof this._cardMenu !== 'undefined') {
                    menuButton.dataset.menu = this._cardMenu;
                } else {
                    delete menuButton.dataset.menu;
                }
                menuButton.dataset.index = `${index}`;
                menuButton.dataset.fieldName = fieldName;
                this._fieldEventListeners.addEventListener(menuButton, 'menuOpen', this._onFieldMenuOpen.bind(this), false);
                this._fieldEventListeners.addEventListener(menuButton, 'menuClose', this._onFieldMenuClose.bind(this), false);
            }

            totalFragment.appendChild(content);
            this._fieldEntries.push({fieldName, inputField, fieldNameContainerNode});

            ++index;
        }

        const ELEMENT_NODE = Node.ELEMENT_NODE;
        const container = this._ankiCardFieldsContainer;
        if (container !== null) {
            for (const node of [...container.childNodes]) {
                if (node.nodeType === ELEMENT_NODE && node instanceof HTMLElement && node.dataset.persistent === 'true') { continue; }
                container.removeChild(node);
            }
            container.appendChild(totalFragment);
        }

        this._validateFields();
    }

    /** */
    async _validateFields() {
        const token = {};
        this._validateFieldsToken = token;

        let fieldNames;
        try {
            fieldNames = await this._ankiController.getModelFieldNames(this._modelController.value);
        } catch (e) {
            return;
        }

        if (token !== this._validateFieldsToken) { return; }

        const fieldNamesSet = new Set(fieldNames);
        let index = 0;
        for (const {fieldName, fieldNameContainerNode} of this._fieldEntries) {
            fieldNameContainerNode.dataset.invalid = `${!fieldNamesSet.has(fieldName)}`;
            fieldNameContainerNode.dataset.orderMatches = `${index < fieldNames.length && fieldName === fieldNames[index]}`;
            ++index;
        }
    }

    /**
     * @param {string} value
     */
    async _setDeck(value) {
        if (this._deckController.value === value) { return; }
        this._deckController.value = value;

        await this._settingsController.modifyProfileSettings([{
            action: 'set',
            path: ObjectPropertyAccessor.getPathString(['anki', this._cardType, 'deck']),
            value
        }]);
    }

    /**
     * @param {string} value
     */
    async _setModel(value) {
        const select = this._modelController.select;
        if (this._modelChangingTo !== null) {
            // Revert
            select.value = this._modelChangingTo;
            return;
        }
        if (this._modelController.value === value) { return; }

        let fieldNames;
        let options;
        try {
            this._modelChangingTo = value;
            fieldNames = await this._ankiController.getModelFieldNames(value);
            options = await this._ankiController.settingsController.getOptions();
        } catch (e) {
            // Revert
            select.value = this._modelController.value;
            return;
        } finally {
            this._modelChangingTo = null;
        }

        const cardType = this._cardType;
        const cardOptions = this._getCardOptions(options.anki, cardType);
        const oldFields = cardOptions !== null ? cardOptions.fields : null;

        /** @type {import('settings').AnkiNoteFields} */
        const fields = {};
        for (let i = 0, ii = fieldNames.length; i < ii; ++i) {
            const fieldName = fieldNames[i];
            fields[fieldName] = this._getDefaultFieldValue(fieldName, i, cardType, oldFields);
        }

        /** @type {import('settings-modifications').Modification[]} */
        const targets = [
            {
                action: 'set',
                path: ObjectPropertyAccessor.getPathString(['anki', this._cardType, 'model']),
                value
            },
            {
                action: 'set',
                path: ObjectPropertyAccessor.getPathString(['anki', this._cardType, 'fields']),
                value: fields
            }
        ];

        this._modelController.value = value;
        this._fields = fields;

        await this._settingsController.modifyProfileSettings(targets);

        this._setupFields();
    }

    /**
     * @param {string[]} permissions
     */
    async _requestPermissions(permissions) {
        try {
            await this._settingsController.permissionsUtil.setPermissionsGranted({permissions}, true);
        } catch (e) {
            log.error(e);
        }
    }

    /**
     * @param {HTMLInputElement} node
     * @param {number} index
     * @param {boolean} request
     */
    async _validateFieldPermissions(node, index, request) {
        const fieldValue = node.value;
        const permissions = this._ankiController.getRequiredPermissions(fieldValue);
        if (permissions.length > 0) {
            node.dataset.requiredPermission = permissions.join(' ');
            const hasPermissions = await (
                request ?
                this._settingsController.permissionsUtil.setPermissionsGranted({permissions}, true) :
                this._settingsController.permissionsUtil.hasPermissions({permissions})
            );
            node.dataset.hasPermissions = `${hasPermissions}`;
        } else {
            delete node.dataset.requiredPermission;
            delete node.dataset.hasPermissions;
        }

        this._validateField(node, index);
    }

    /**
     * @param {import('settings-controller').EventArgument<'permissionsChanged'>} details
     */
    _onPermissionsChanged({permissions: {permissions}}) {
        const permissionsSet = new Set(permissions);
        for (let i = 0, ii = this._fieldEntries.length; i < ii; ++i) {
            const {inputField} = this._fieldEntries[i];
            const {requiredPermission} = inputField.dataset;
            if (typeof requiredPermission !== 'string') { continue; }
            const requiredPermissionArray = (requiredPermission.length === 0 ? [] : requiredPermission.split(' '));

            let hasPermissions = true;
            for (const permission of requiredPermissionArray) {
                if (!permissionsSet.has(permission)) {
                    hasPermissions = false;
                    break;
                }
            }

            inputField.dataset.hasPermissions = `${hasPermissions}`;
            this._validateField(inputField, i);
        }
    }

    /**
     * @param {string} fieldName
     * @param {number} index
     * @param {string} cardType
     * @param {?import('settings').AnkiNoteFields} oldFields
     * @returns {string}
     */
    _getDefaultFieldValue(fieldName, index, cardType, oldFields) {
        if (
            typeof oldFields === 'object' &&
            oldFields !== null &&
            Object.prototype.hasOwnProperty.call(oldFields, fieldName)
        ) {
            return oldFields[fieldName];
        }

        if (index === 0) {
            return (cardType === 'kanji' ? '{character}' : '{expression}');
        }

        const markers = this._ankiController.getFieldMarkers(cardType);
        const markerAliases = new Map([
            ['expression', ['phrase', 'term', 'word']],
            ['glossary', ['definition', 'meaning']],
            ['audio', ['sound']],
            ['dictionary', ['dict']],
            ['pitch-accents', ['pitch']]
        ]);

        const hyphenPattern = /-/g;
        for (const marker of markers) {
            const names = [marker];
            const aliases = markerAliases.get(marker);
            if (typeof aliases !== 'undefined') {
                names.push(...aliases);
            }

            let pattern = '^(?:';
            for (let i = 0, ii = names.length; i < ii; ++i) {
                const name = names[i];
                if (i > 0) { pattern += '|'; }
                pattern += name.replace(hyphenPattern, '[-_ ]*');
            }
            pattern += ')$';
            const patternRegExp = new RegExp(pattern, 'i');

            if (patternRegExp.test(fieldName)) {
                return `{${marker}}`;
            }
        }

        return '';
    }
}

class AnkiCardSelectController {
    constructor() {
        /** @type {?string} */
        this._value = null;
        /** @type {?HTMLSelectElement} */
        this._select = null;
        /** @type {string[]} */
        this._optionValues = [];
        /** @type {boolean} */
        this._hasExtraOption = false;
        /** @type {boolean} */
        this._selectNeedsUpdate = false;
    }

    /** @type {string} */
    get value() {
        if (this._value === null) { throw new Error('Invalid value'); }
        return this._value;
    }

    set value(value) {
        this._value = value;
        this._updateSelect();
    }

    /** @type {HTMLSelectElement} */
    get select() {
        if (this._select === null) { throw new Error('Invalid value'); }
        return this._select;
    }

    /**
     * @param {HTMLSelectElement} select
     * @param {string} value
     */
    prepare(select, value) {
        this._select = select;
        this._value = value;
        this._updateSelect();
    }

    /**
     * @param {string[]} optionValues
     */
    setOptionValues(optionValues) {
        this._optionValues = optionValues;
        this._selectNeedsUpdate = true;
        this._updateSelect();
    }

    // Private

    /** */
    _updateSelect() {
        const select = this._select;
        const value = this._value;
        if (select === null || value === null) { return; }
        let optionValues = this._optionValues;
        const hasOptionValues = Array.isArray(optionValues) && optionValues.length > 0;

        if (!hasOptionValues) {
            optionValues = [];
        }

        const hasExtraOption = !optionValues.includes(value);
        if (hasExtraOption) {
            optionValues = [...optionValues, value];
        }

        if (this._selectNeedsUpdate || hasExtraOption !== this._hasExtraOption) {
            this._setSelectOptions(select, optionValues);
            select.value = value;
            this._hasExtraOption = hasExtraOption;
            this._selectNeedsUpdate = false;
        }

        if (hasOptionValues) {
            select.dataset.invalid = `${hasExtraOption}`;
        } else {
            delete select.dataset.invalid;
        }
    }

    /**
     * @param {HTMLSelectElement} select
     * @param {string[]} optionValues
     */
    _setSelectOptions(select, optionValues) {
        const fragment = document.createDocumentFragment();
        for (const optionValue of optionValues) {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            fragment.appendChild(option);
        }
        select.textContent = '';
        select.appendChild(fragment);
    }
}

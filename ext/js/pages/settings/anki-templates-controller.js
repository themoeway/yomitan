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

import {ExtensionError} from '../../core/extension-error.js';
import {toError} from '../../core/to-error.js';
import {AnkiNoteBuilder} from '../../data/anki-note-builder.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {JapaneseUtil} from '../../language/sandbox/japanese-util.js';
import {TemplateRendererProxy} from '../../templates/template-renderer-proxy.js';
import {yomitan} from '../../yomitan.js';

export class AnkiTemplatesController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     * @param {import('./modal-controller.js').ModalController} modalController
     * @param {import('./anki-controller.js').AnkiController} ankiController
     */
    constructor(settingsController, modalController, ankiController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {import('./modal-controller.js').ModalController} */
        this._modalController = modalController;
        /** @type {import('./anki-controller.js').AnkiController} */
        this._ankiController = ankiController;
        /** @type {?import('dictionary').TermDictionaryEntry} */
        this._cachedDictionaryEntryValue = null;
        /** @type {?string} */
        this._cachedDictionaryEntryText = null;
        /** @type {?string} */
        this._defaultFieldTemplates = null;
        /** @type {HTMLTextAreaElement} */
        this._fieldTemplatesTextarea = querySelectorNotNull(document, '#anki-card-templates-textarea');
        /** @type {HTMLElement} */
        this._compileResultInfo = querySelectorNotNull(document, '#anki-card-templates-compile-result');
        /** @type {HTMLInputElement} */
        this._renderFieldInput = querySelectorNotNull(document, '#anki-card-templates-test-field-input');
        /** @type {HTMLInputElement} */
        this._renderTextInput = querySelectorNotNull(document, '#anki-card-templates-test-text-input');
        /** @type {HTMLElement} */
        this._renderResult = querySelectorNotNull(document, '#anki-card-templates-render-result');
        /** @type {?import('./modal.js').Modal} */
        this._fieldTemplateResetModal = null;
        /** @type {AnkiNoteBuilder} */
        this._ankiNoteBuilder = new AnkiNoteBuilder(new JapaneseUtil(null), new TemplateRendererProxy());
    }

    /** */
    async prepare() {
        this._defaultFieldTemplates = await yomitan.api.getDefaultAnkiFieldTemplates();

        /** @type {HTMLButtonElement} */
        const menuButton = querySelectorNotNull(document, '#anki-card-templates-test-field-menu-button');
        /** @type {HTMLButtonElement} */
        const testRenderButton = querySelectorNotNull(document, '#anki-card-templates-test-render-button');
        /** @type {HTMLButtonElement} */
        const resetButton = querySelectorNotNull(document, '#anki-card-templates-reset-button');
        /** @type {HTMLButtonElement} */
        const resetConfirmButton = querySelectorNotNull(document, '#anki-card-templates-reset-button-confirm');
        this._fieldTemplateResetModal = this._modalController.getModal('anki-card-templates-reset');

        this._fieldTemplatesTextarea.addEventListener('change', this._onChanged.bind(this), false);
        testRenderButton.addEventListener('click', this._onRender.bind(this), false);
        resetButton.addEventListener('click', this._onReset.bind(this), false);
        resetConfirmButton.addEventListener('click', this._onResetConfirm.bind(this), false);
        if (menuButton !== null) {
            menuButton.addEventListener(
                /** @type {string} */ ('menuClose'),
                /** @type {EventListener} */ (this._onFieldMenuClose.bind(this)),
                false
            );
        }

        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));

        const options = await this._settingsController.getOptions();
        const optionsContext = this._settingsController.getOptionsContext();
        this._onOptionsChanged({options, optionsContext});
    }

    // Private

    /**
     * @param {import('settings-controller').EventArgument<'optionsChanged'>} details
     */
    _onOptionsChanged({options}) {
        let templates = options.anki.fieldTemplates;
        if (typeof templates !== 'string') {
            templates = this._defaultFieldTemplates;
            if (typeof templates !== 'string') { templates = ''; }
        }
        /** @type {HTMLTextAreaElement} */ (this._fieldTemplatesTextarea).value = templates;

        this._onValidateCompile();
    }

    /**
     * @param {MouseEvent} e
     */
    _onReset(e) {
        e.preventDefault();
        if (this._fieldTemplateResetModal !== null) {
            this._fieldTemplateResetModal.setVisible(true);
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onResetConfirm(e) {
        e.preventDefault();

        if (this._fieldTemplateResetModal !== null) {
            this._fieldTemplateResetModal.setVisible(false);
        }

        const value = this._defaultFieldTemplates;

        const textarea = /** @type {HTMLTextAreaElement} */ (this._fieldTemplatesTextarea);
        textarea.value = typeof value === 'string' ? value : '';
        textarea.dispatchEvent(new Event('change'));
    }

    /**
     * @param {Event} e
     */
    async _onChanged(e) {
        // Get value
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        /** @type {?string} */
        let templates = element.value;
        if (templates === this._defaultFieldTemplates) {
            // Default
            templates = null;
        }

        // Overwrite
        await this._settingsController.setProfileSetting('anki.fieldTemplates', templates);

        // Compile
        this._onValidateCompile();
    }

    /** */
    _onValidateCompile() {
        if (this._compileResultInfo === null) { return; }
        this._validate(this._compileResultInfo, '{expression}', 'term-kanji', false, true);
    }

    /**
     * @param {Event} e
     */
    _onRender(e) {
        e.preventDefault();

        const field = /** @type {HTMLInputElement} */ (this._renderFieldInput).value;
        const infoNode = /** @type {HTMLElement} */ (this._renderResult);
        infoNode.hidden = true;
        this._cachedDictionaryEntryText = null;
        this._validate(infoNode, field, 'term-kanji', true, false);
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} event
     */
    _onFieldMenuClose({detail: {action, item}}) {
        switch (action) {
            case 'setFieldMarker':
                {
                    const {marker} = /** @type {HTMLElement} */ (item).dataset;
                    if (typeof marker === 'string') {
                        this._setFieldMarker(marker);
                    }
                }
                break;
        }
    }

    /**
     * @param {string} marker
     */
    _setFieldMarker(marker) {
        const input = /** @type {HTMLInputElement} */ (this._renderFieldInput);
        input.value = `{${marker}}`;
        input.dispatchEvent(new Event('change'));
    }

    /**
     * @param {string} text
     * @param {import('settings').OptionsContext} optionsContext
     * @returns {Promise<?{dictionaryEntry: import('dictionary').TermDictionaryEntry, text: string}>}
     */
    async _getDictionaryEntry(text, optionsContext) {
        if (this._cachedDictionaryEntryText !== text) {
            const {dictionaryEntries} = await yomitan.api.termsFind(text, {}, optionsContext);
            if (dictionaryEntries.length === 0) { return null; }

            this._cachedDictionaryEntryValue = dictionaryEntries[0];
            this._cachedDictionaryEntryText = text;
        }
        return {
            dictionaryEntry: /** @type {import('dictionary').TermDictionaryEntry} */ (this._cachedDictionaryEntryValue),
            text: this._cachedDictionaryEntryText
        };
    }

    /**
     * @param {HTMLElement} infoNode
     * @param {string} field
     * @param {import('anki-templates-internal').CreateModeNoTest} mode
     * @param {boolean} showSuccessResult
     * @param {boolean} invalidateInput
     */
    async _validate(infoNode, field, mode, showSuccessResult, invalidateInput) {
        /** @type {Error[]} */
        const allErrors = [];
        const text = /** @type {HTMLInputElement} */ (this._renderTextInput).value;
        let result = `No definition found for ${text}`;
        try {
            const optionsContext = this._settingsController.getOptionsContext();
            const data = await this._getDictionaryEntry(text, optionsContext);
            if (data !== null) {
                const {dictionaryEntry, text: sentenceText} = data;
                const options = await this._settingsController.getOptions();
                const context = {
                    url: window.location.href,
                    sentence: {
                        text: sentenceText,
                        offset: 0
                    },
                    documentTitle: document.title,
                    query: sentenceText,
                    fullQuery: sentenceText
                };
                let template = options.anki.fieldTemplates;
                if (typeof template !== 'string') { template = this._defaultFieldTemplates; }
                const {general: {resultOutputMode, glossaryLayoutMode, compactTags}} = options;
                const {note, errors} = await this._ankiNoteBuilder.createNote(/** @type {import('anki-note-builder').CreateNoteDetails} */ ({
                    dictionaryEntry,
                    mode,
                    context,
                    template,
                    deckName: '',
                    modelName: '',
                    fields: [
                        ['field', field]
                    ],
                    resultOutputMode,
                    glossaryLayoutMode,
                    compactTags
                }));
                result = note.fields.field;
                allErrors.push(...errors);
            }
        } catch (e) {
            allErrors.push(toError(e));
        }

        /**
         * @param {Error} e
         * @returns {string}
         */
        const errorToMessageString = (e) => {
            if (e instanceof ExtensionError) {
                const v = e.data;
                if (typeof v === 'object' && v !== null) {
                    const v2 = /** @type {import('core').UnknownObject} */ (v).error;
                    if (v2 instanceof Error) {
                        return v2.message;
                    }
                }
            }
            return e.message;
        };

        const hasError = allErrors.length > 0;
        infoNode.hidden = !(showSuccessResult || hasError);
        infoNode.textContent = hasError ? allErrors.map(errorToMessageString).join('\n') : (showSuccessResult ? result : '');
        infoNode.classList.toggle('text-danger', hasError);
        if (invalidateInput) {
            /** @type {HTMLTextAreaElement} */ (this._fieldTemplatesTextarea).dataset.invalid = `${hasError}`;
        }
    }
}

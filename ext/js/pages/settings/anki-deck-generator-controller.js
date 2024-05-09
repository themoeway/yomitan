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
import {getDynamicTemplates} from '../../data/anki-template-util.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {TemplateRendererProxy} from '../../templates/template-renderer-proxy.js';

export class AnkiDeckGeneratorController {
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
        /** @type {?string} */
        this._defaultFieldTemplates = null;
        /** @type {HTMLTextAreaElement} */
        this._wordInputTextarea = querySelectorNotNull(document, '#generate-anki-deck-textarea');
        /** @type {HTMLInputElement} */
        this._renderTextInput = querySelectorNotNull(document, '#generate-anki-deck-test-text-input');
        /** @type {HTMLElement} */
        this._renderResult = querySelectorNotNull(document, '#generate-anki-deck-render-result');
        /** @type {HTMLElement} */
        this._activeCardFormatText = querySelectorNotNull(document, '#generate-anki-deck-active-card-format');
        /** @type {HTMLElement} */
        this._activeDeckText = querySelectorNotNull(document, '#generate-anki-deck-active-deck');
        /** @type {HTMLInputElement} */
        this._addMediaCheckbox = querySelectorNotNull(document, '#generate-anki-deck-add-media');
        /** @type {string} */
        this._activeNoteType = '';
        /** @type {string} */
        this._activeAnkiDeck = '';
        /** @type {HTMLSpanElement} */
        this._wordcount = querySelectorNotNull(document, '#generate-anki-deck-wordcount');
        /** @type {NodeListOf<HTMLElement>} */
        this._progressContainers = (document.querySelectorAll('#dictionaries-modal .generate-anki-deck-import-progress'));
        /** @type {NodeListOf<HTMLElement>} */
        this._progressBars = (document.querySelectorAll('.generate-anki-deck-import-progress .progress-bar'));
        /** @type {NodeListOf<HTMLElement>} */
        this._infoLabels = (document.querySelectorAll('.generate-anki-deck-import-progress .progress-info'));
        /** @type {NodeListOf<HTMLElement>} */
        this._statusLabels = (document.querySelectorAll('.generate-anki-deck-import-progress .progress-status'));
        /** @type {?import('./modal.js').Modal} */
        this._fieldTemplateSendToAnkiConfirmModal = null;
        /** @type {AnkiNoteBuilder} */
        this._ankiNoteBuilder = new AnkiNoteBuilder(settingsController.application.api, new TemplateRendererProxy());
    }

    /** */
    async prepare() {
        this._defaultFieldTemplates = await this._settingsController.application.api.getDefaultAnkiFieldTemplates();

        /** @type {HTMLButtonElement} */
        const testRenderButton = querySelectorNotNull(document, '#generate-anki-deck-test-render-button');
        /** @type {HTMLButtonElement} */
        const sendToAnkiButton = querySelectorNotNull(document, '#generate-anki-deck-send-to-anki-button');
        /** @type {HTMLButtonElement} */
        const sendToAnkiButtonConfirmButton = querySelectorNotNull(document, '#generate-anki-deck-send-button-confirm');
        /** @type {HTMLButtonElement} */
        const generateButton = querySelectorNotNull(document, '#generate-anki-deck-export-button');

        this._fieldTemplateSendToAnkiConfirmModal = this._modalController.getModal('generate-anki-deck-send-to-anki');

        testRenderButton.addEventListener('click', this._onRender.bind(this), false);
        sendToAnkiButton.addEventListener('click', this._onSendToAnki.bind(this), false);
        sendToAnkiButtonConfirmButton.addEventListener('click', this._onSendToAnkiConfirm.bind(this), false);
        generateButton.addEventListener('click', this._onExport.bind(this), false);

        void this._updateActiveCardFormat();
    }

    // Private

    /**
     *
     */
    async _updateActiveCardFormat() {
        const activeCardFormatText = /** @type {HTMLElement} */ (this._activeCardFormatText);
        const activeDeckText = /** @type {HTMLElement} */ (this._activeDeckText);
        const activeDeckTextConfirm = querySelectorNotNull(document, '#generate-anki-deck-active-deck-confirm');
        const options = await this._settingsController.getOptions();

        this._activeNoteType = options.anki.terms.model;
        this._activeAnkiDeck = options.anki.terms.deck;
        activeCardFormatText.textContent = this._activeNoteType;
        activeDeckText.textContent = this._activeAnkiDeck;
        activeDeckTextConfirm.textContent = this._activeAnkiDeck;
    }

    /**
     * @param {MouseEvent} e
     */
    async _onExport(e) {
        e.preventDefault();
        const terms = /** @type {HTMLTextAreaElement} */ (this._wordInputTextarea).value.split('\n');
        let ankiTSV = '#separator:tab\n#html:true\n#notetype column:1\n';
        for (const value of terms) {
            if (!value) { continue; }
            const noteData = await this._generateNoteData(value, 'term-kanji', false);
            const fieldsTSV = noteData ? this._fieldsToTSV(noteData.fields) : '';
            if (fieldsTSV) {
                ankiTSV += this._activeNoteType + '\t';
                ankiTSV += fieldsTSV;
                ankiTSV += '\n';
            }
        }
        const today = new Date();
        const fileName = `anki-deck-${today.getFullYear()}-${today.getMonth()}-${today.getDay()}.txt`;
        const blob = new Blob([ankiTSV], {type: 'application/octet-stream'});
        this._saveBlob(blob, fileName);
    }

    /**
     * @param {MouseEvent} e
     */
    _onSendToAnki(e) {
        e.preventDefault();
        if (this._fieldTemplateSendToAnkiConfirmModal !== null) {
            this._wordcount.textContent = /** @type {HTMLTextAreaElement} */ (this._wordInputTextarea).value.split('\n').filter(Boolean).length.toString();
            this._fieldTemplateSendToAnkiConfirmModal.setVisible(true);
        }
    }

    /**
     * @param {MouseEvent} e
     */
    async _onSendToAnkiConfirm(e) {
        e.preventDefault();
        const terms = /** @type {HTMLTextAreaElement} */ (this._wordInputTextarea).value.split('\n');
        const addMedia = this._addMediaCheckbox.checked;
        this._updateProgressBar(true, 'Sending to Anki...', 0, terms.length);
        let notes = [];
        let index = 0;
        for (const value of terms) {
            if (!value) { continue; }
            const noteData = await this._generateNoteData(value, 'term-kanji', addMedia);
            if (noteData) {
                notes.push(noteData);
            }
            if (notes.length >= 100) {
                await this._ankiController.addNotes(notes);
                notes = [];
            }
            index++;
            this._updateProgressBar(false, '', index, terms.length);
        }
        if (notes.length > 0) {
            await this._ankiController.addNotes(notes);
        }

        if (this._fieldTemplateSendToAnkiConfirmModal !== null) {
            this._fieldTemplateSendToAnkiConfirmModal.setVisible(false);
        }
    }

    /**
     *
     * @param {boolean} init
     * @param {string} text
     * @param {number} current
     * @param {number} end
     */
    _updateProgressBar(init, text, current, end) {
        if (current === end) {
            for (const progress of this._progressContainers) { progress.hidden = true; }
            return;
        }
        if (init) {
            for (const progress of this._progressContainers) { progress.hidden = false; }
            for (const infoLabel of this._infoLabels) { infoLabel.textContent = text; }
        }
        for (const statusLabel of this._statusLabels) { statusLabel.textContent = (current / end).toString(); }
        for (const progressBar of this._progressBars) { progressBar.style.width = (current / end).toString(); }
    }

    /**
     * @param {HTMLElement} infoNode
     * @param {import('anki-templates-internal').CreateModeNoTest} mode
     * @param {boolean} showSuccessResult
     */
    async _testNoteData(infoNode, mode, showSuccessResult) {
        /** @type {Error[]} */
        const allErrors = [];
        const text = /** @type {HTMLInputElement} */ (this._renderTextInput).value;
        let result;
        try {
            const noteData = await this._generateNoteData(text, mode, false);
            result = noteData ? this._fieldsToTSV(noteData.fields) : `No definition found for ${text}`;
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
        if (hasError || !result) {
            infoNode.textContent = allErrors.map(errorToMessageString).join('\n');
        } else {
            infoNode.textContent = showSuccessResult ? result : '';
        }
        infoNode.classList.toggle('text-danger', hasError);
    }

    /**
     * @param {string} word
     * @param {import('anki-templates-internal').CreateModeNoTest} mode
     * @param {boolean} addMedia
     * @returns {Promise<?import('anki.js').Note>}
     */
    async _generateNoteData(word, mode, addMedia) {
        const optionsContext = this._settingsController.getOptionsContext();
        const data = await this._getDictionaryEntry(word, optionsContext);
        if (data === null) {
            return null;
        }
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
        const template = this._getAnkiTemplate(options);
        const deckOptionsFields = options.anki.terms.fields;
        const {general: {resultOutputMode, glossaryLayoutMode, compactTags}} = options;
        const fields = [];
        for (const deckField in deckOptionsFields) {
            if (Object.prototype.hasOwnProperty.call(deckOptionsFields, deckField)) {
                fields.push([deckField, deckOptionsFields[deckField]]);
            }
        }
        const mediaOptions = addMedia ? {audio: {sources: options.audio.sources, preferredAudioIndex: null, idleTimeout: null}} : null;
        const requirements = addMedia ? [...this._getDictionaryEntryMedia(dictionaryEntry), {type: 'audio'}] : [];
        const {note} = await this._ankiNoteBuilder.createNote(/** @type {import('anki-note-builder').CreateNoteDetails} */ ({
            dictionaryEntry,
            mode,
            context,
            template,
            deckName: this._activeAnkiDeck,
            modelName: this._activeNoteType,
            fields: fields,
            resultOutputMode,
            glossaryLayoutMode,
            compactTags,
            tags: ['yomitan'],
            mediaOptions: mediaOptions,
            requirements: requirements
        }));
        return note;
    }

    /**
     * @param {string} text
     * @param {import('settings').OptionsContext} optionsContext
     * @returns {Promise<?{dictionaryEntry: import('dictionary').TermDictionaryEntry, text: string}>}
     */
    async _getDictionaryEntry(text, optionsContext) {
        const {dictionaryEntries} = await this._settingsController.application.api.termsFind(text, {}, optionsContext);
        if (dictionaryEntries.length === 0) { return null; }

        this._cachedDictionaryEntryValue = dictionaryEntries[0];
        return {
            dictionaryEntry: /** @type {import('dictionary').TermDictionaryEntry} */ (this._cachedDictionaryEntryValue),
            text: text
        };
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {Array<object>}
     */
    _getDictionaryEntryMedia(dictionaryEntry) {
        const media = [];
        const definitions = dictionaryEntry.definitions;
        for (const definition of definitions) {
            const paths = this._findAllByKey(definition, 'path');
            for (const path of paths) {
                media.push({dictionary: definition.dictionary, path: path, type: 'dictionaryMedia'});
            }
        }
        return media;
    }

    /**
     *
     * @param {object} obj
     * @param {string} keyToFind
     * @returns {Array<string>}
     */
    _findAllByKey(obj, keyToFind) {
        // @ts-expect-error - Recursive function to find object keys deeply nested in objects and arrays. Essentially impossible to type correctly.
        // eslint-disable-next-line unicorn/no-array-reduce, @typescript-eslint/no-unsafe-argument
        return Object.entries(obj).reduce((acc, [key, value]) => (key === keyToFind ? [...acc, value] : (typeof value === 'object' ? [...acc, ...this._findAllByKey(value, keyToFind)] : acc)), []);
    }

    /**
     * @param {import('settings').ProfileOptions} options
     * @returns {string}
     */
    _getAnkiTemplate(options) {
        let staticTemplates = options.anki.fieldTemplates;
        if (typeof staticTemplates !== 'string') { staticTemplates = this._defaultFieldTemplates; }
        const dynamicTemplates = getDynamicTemplates(options);
        return staticTemplates + '\n' + dynamicTemplates;
    }

    /**
     * @param {Event} e
     */
    _onRender(e) {
        e.preventDefault();

        const infoNode = /** @type {HTMLElement} */ (this._renderResult);
        infoNode.hidden = true;
        void this._testNoteData(infoNode, 'term-kanji', true);
    }

    /**
     * @param {import('anki.js').NoteFields} noteFields
     * @returns {string}
     */
    _fieldsToTSV(noteFields) {
        let tsv = '';
        for (const key in noteFields) {
            if (Object.prototype.hasOwnProperty.call(noteFields, key)) {
                tsv += noteFields[key].replaceAll('\t', '&nbsp;&nbsp;&nbsp;') + '\t';
            }
        }
        return tsv;
    }

    /**
     * @param {Blob} blob
     * @param {string} fileName
     */
    _saveBlob(blob, fileName) {
        if (
            typeof navigator === 'object' && navigator !== null &&
            // @ts-expect-error - call for legacy Edge
            typeof navigator.msSaveBlob === 'function' &&
            // @ts-expect-error - call for legacy Edge
            navigator.msSaveBlob(blob)
        ) {
            return;
        }

        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        a.rel = 'noopener';
        a.target = '_blank';

        const revoke = () => {
            URL.revokeObjectURL(blobUrl);
            a.href = '';
            this._settingsExportRevoke = null;
        };
        this._settingsExportRevoke = revoke;

        a.dispatchEvent(new MouseEvent('click'));
        setTimeout(revoke, 60000);
    }
}
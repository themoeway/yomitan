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

import {ExtensionError} from '../../core/extension-error.js';
import {log} from '../../core/logger.js';
import {toError} from '../../core/to-error.js';
import {DictionaryWorker} from '../../dictionary/dictionary-worker.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {yomitan} from '../../yomitan.js';
import {DictionaryController} from './dictionary-controller.js';

export class DictionaryImportController {
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
        /** @type {boolean} */
        this._modifying = false;
        /** @type {HTMLButtonElement} */
        this._purgeButton = querySelectorNotNull(document, '#dictionary-delete-all-button');
        /** @type {HTMLButtonElement} */
        this._purgeConfirmButton = querySelectorNotNull(document, '#dictionary-confirm-delete-all-button');
        /** @type {HTMLButtonElement} */
        this._importFileButton = querySelectorNotNull(document, '#dictionary-import-file-button');
        /** @type {HTMLInputElement} */
        this._importFileInput = querySelectorNotNull(document, '#dictionary-import-file-input');
        /** @type {?import('./modal.js').Modal} */
        this._purgeConfirmModal = null;
        /** @type {HTMLElement} */
        this._errorContainer = querySelectorNotNull(document, '#dictionary-error');
        /** @type {[originalMessage: string, newMessage: string][]} */
        this._errorToStringOverrides = [
            [
                'A mutation operation was attempted on a database that did not allow mutations.',
                'Access to IndexedDB appears to be restricted. Firefox seems to require that the history preference is set to "Remember history" before IndexedDB use of any kind is allowed.'
            ],
            [
                'The operation failed for reasons unrelated to the database itself and not covered by any other error code.',
                'Unable to access IndexedDB due to a possibly corrupt user profile. Try using the "Refresh Firefox" feature to reset your user profile.'
            ]
        ];
    }

    /** */
    async prepare() {
        this._purgeConfirmModal = this._modalController.getModal('dictionary-confirm-delete-all');

        this._purgeButton.addEventListener('click', this._onPurgeButtonClick.bind(this), false);
        this._purgeConfirmButton.addEventListener('click', this._onPurgeConfirmButtonClick.bind(this), false);
        this._importFileButton.addEventListener('click', this._onImportButtonClick.bind(this), false);
        this._importFileInput.addEventListener('change', this._onImportFileChange.bind(this), false);
    }

    // Private

    /** */
    _onImportButtonClick() {
        /** @type {HTMLInputElement} */ (this._importFileInput).click();
    }

    /**
     * @param {MouseEvent} e
     */
    _onPurgeButtonClick(e) {
        e.preventDefault();
        /** @type {import('./modal.js').Modal} */ (this._purgeConfirmModal).setVisible(true);
    }

    /**
     * @param {MouseEvent} e
     */
    _onPurgeConfirmButtonClick(e) {
        e.preventDefault();
        /** @type {import('./modal.js').Modal} */ (this._purgeConfirmModal).setVisible(false);
        this._purgeDatabase();
    }

    /**
     * @param {Event} e
     */
    _onImportFileChange(e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        const {files} = node;
        if (files === null) { return; }
        const files2 = [...files];
        node.value = '';
        this._importDictionaries(files2);
    }

    /** */
    async _purgeDatabase() {
        if (this._modifying) { return; }

        const prevention = this._preventPageExit();

        try {
            this._setModifying(true);
            this._hideErrors();

            await yomitan.api.purgeDatabase();
            const errors = await this._clearDictionarySettings();

            if (errors.length > 0) {
                this._showErrors(errors);
            }
        } catch (error) {
            this._showErrors([toError(error)]);
        } finally {
            prevention.end();
            this._setModifying(false);
            this._triggerStorageChanged();
        }
    }

    /**
     * @param {File[]} files
     */
    async _importDictionaries(files) {
        if (this._modifying) { return; }

        const statusFooter = this._statusFooter;
        const progressSelector = '.dictionary-import-progress';
        const progressContainers = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(`#dictionaries-modal ${progressSelector}`));
        const progressBars = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(`${progressSelector} .progress-bar`));
        const infoLabels = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(`${progressSelector} .progress-info`));
        const statusLabels = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(`${progressSelector} .progress-status`));

        const prevention = this._preventPageExit();

        try {
            this._setModifying(true);
            this._hideErrors();

            for (const progress of progressContainers) { progress.hidden = false; }

            const optionsFull = await this._settingsController.getOptionsFull();
            const importDetails = {
                prefixWildcardsSupported: optionsFull.global.database.prefixWildcardsSupported
            };

            let statusPrefix = '';
            /** @type {import('dictionary-importer.js').ImportStep} */
            let stepIndex = -2;
            /** @type {import('dictionary-worker').ImportProgressCallback} */
            const onProgress = (data) => {
                const {stepIndex: stepIndex2, index, count} = data;
                if (stepIndex !== stepIndex2) {
                    stepIndex = stepIndex2;
                    const labelText = `${statusPrefix} - Step ${stepIndex2 + 1} of ${data.stepCount}: ${this._getImportLabel(stepIndex2)}...`;
                    for (const label of infoLabels) { label.textContent = labelText; }
                }

                const percent = count > 0 ? (index / count * 100.0) : 0.0;
                const cssString = `${percent}%`;
                const statusString = `${Math.floor(percent).toFixed(0)}%`;
                for (const progressBar of progressBars) { progressBar.style.width = cssString; }
                for (const label of statusLabels) { label.textContent = statusString; }

                switch (stepIndex2) {
                    case -2:
                    case 5:
                        this._triggerStorageChanged();
                        break;
                }
            };

            const fileCount = files.length;
            for (let i = 0; i < fileCount; ++i) {
                statusPrefix = `Importing dictionary${fileCount > 1 ? ` (${i + 1} of ${fileCount})` : ''}`;
                onProgress({
                    stepIndex: -1,
                    stepCount: 6,
                    index: 0,
                    count: 0
                });
                if (statusFooter !== null) { statusFooter.setTaskActive(progressSelector, true); }

                await this._importDictionary(files[i], importDetails, onProgress);
            }
        } catch (err) {
            this._showErrors([toError(err)]);
        } finally {
            prevention.end();
            for (const progress of progressContainers) { progress.hidden = true; }
            if (statusFooter !== null) { statusFooter.setTaskActive(progressSelector, false); }
            this._setModifying(false);
            this._triggerStorageChanged();
        }
    }

    /**
     * @param {import('dictionary-importer').ImportStep} stepIndex
     * @returns {string}
     */
    _getImportLabel(stepIndex) {
        switch (stepIndex) {
            case -2: return '';
            case -1:
            case 0: return 'Loading dictionary';
            case 1: return 'Loading schemas';
            case 2: return 'Validating data';
            case 3: return 'Formatting data';
            case 4: return 'Importing media';
            case 5: return 'Importing data';
        }
    }

    /**
     * @param {File} file
     * @param {import('dictionary-importer').ImportDetails} importDetails
     * @param {import('dictionary-worker').ImportProgressCallback} onProgress
     */
    async _importDictionary(file, importDetails, onProgress) {
        const archiveContent = await this._readFile(file);
        const {result, errors} = await new DictionaryWorker().importDictionary(archiveContent, importDetails, onProgress);
        yomitan.api.triggerDatabaseUpdated('dictionary', 'import');
        const errors2 = await this._addDictionarySettings(result.sequenced, result.title);

        if (errors.length > 0) {
            const allErrors = [...errors, ...errors2];
            allErrors.push(new Error(`Dictionary may not have been imported properly: ${allErrors.length} error${allErrors.length === 1 ? '' : 's'} reported.`));
            this._showErrors(allErrors);
        }
    }

    /**
     * @param {boolean} sequenced
     * @param {string} title
     * @returns {Promise<Error[]>}
     */
    async _addDictionarySettings(sequenced, title) {
        const optionsFull = await this._settingsController.getOptionsFull();
        /** @type {import('settings-modifications').Modification[]} */
        const targets = [];
        const profileCount = optionsFull.profiles.length;
        for (let i = 0; i < profileCount; ++i) {
            const {options} = optionsFull.profiles[i];
            const value = DictionaryController.createDefaultDictionarySettings(title, true);
            const path1 = `profiles[${i}].options.dictionaries`;
            targets.push({action: 'push', path: path1, items: [value]});

            if (sequenced && options.general.mainDictionary === '') {
                const path2 = `profiles[${i}].options.general.mainDictionary`;
                targets.push({action: 'set', path: path2, value: title});
            }
        }
        return await this._modifyGlobalSettings(targets);
    }

    /**
     * @returns {Promise<Error[]>}
     */
    async _clearDictionarySettings() {
        const optionsFull = await this._settingsController.getOptionsFull();
        /** @type {import('settings-modifications').Modification[]} */
        const targets = [];
        const profileCount = optionsFull.profiles.length;
        for (let i = 0; i < profileCount; ++i) {
            const path1 = `profiles[${i}].options.dictionaries`;
            targets.push({action: 'set', path: path1, value: []});
            const path2 = `profiles[${i}].options.general.mainDictionary`;
            targets.push({action: 'set', path: path2, value: ''});
        }
        return await this._modifyGlobalSettings(targets);
    }

    /**
     * @returns {import('settings-controller').PageExitPrevention}
     */
    _preventPageExit() {
        return this._settingsController.preventPageExit();
    }

    /**
     * @param {Error[]} errors
     */
    _showErrors(errors) {
        const uniqueErrors = new Map();
        for (const error of errors) {
            log.error(error);
            const errorString = this._errorToString(error);
            let count = uniqueErrors.get(errorString);
            if (typeof count === 'undefined') {
                count = 0;
            }
            uniqueErrors.set(errorString, count + 1);
        }

        const fragment = document.createDocumentFragment();
        for (const [e, count] of uniqueErrors.entries()) {
            const div = document.createElement('p');
            if (count > 1) {
                div.textContent = `${e} `;
                const em = document.createElement('em');
                em.textContent = `(${count})`;
                div.appendChild(em);
            } else {
                div.textContent = `${e}`;
            }
            fragment.appendChild(div);
        }

        const errorContainer = /** @type {HTMLElement} */ (this._errorContainer);
        errorContainer.appendChild(fragment);
        errorContainer.hidden = false;
    }

    /** */
    _hideErrors() {
        const errorContainer = /** @type {HTMLElement} */ (this._errorContainer);
        errorContainer.textContent = '';
        errorContainer.hidden = true;
    }

    /**
     * @param {File} file
     * @returns {Promise<ArrayBuffer>}
     */
    _readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(/** @type {ArrayBuffer} */ (reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * @param {Error} error
     * @returns {string}
     */
    _errorToString(error) {
        const errorMessage = error.toString();

        for (const [match, newErrorString] of this._errorToStringOverrides) {
            if (errorMessage.includes(match)) {
                return newErrorString;
            }
        }

        return errorMessage;
    }

    /**
     * @param {boolean} value
     */
    _setModifying(value) {
        this._modifying = value;
        this._setButtonsEnabled(!value);
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
     * @param {import('settings-modifications').Modification[]} targets
     * @returns {Promise<Error[]>}
     */
    async _modifyGlobalSettings(targets) {
        const results = await this._settingsController.modifyGlobalSettings(targets);
        const errors = [];
        for (const {error} of results) {
            if (typeof error !== 'undefined') {
                errors.push(ExtensionError.deserialize(error));
            }
        }
        return errors;
    }

    /** */
    _triggerStorageChanged() {
        yomitan.triggerStorageChanged();
    }
}

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

import {Dexie} from '../../../lib/dexie.js';
import {parseJson} from '../../core/json.js';
import {log} from '../../core/logger.js';
import {toError} from '../../core/to-error.js';
import {isObject} from '../../core/utilities.js';
import {OptionsUtil} from '../../data/options-util.js';
import {ArrayBufferUtil} from '../../data/sandbox/array-buffer-util.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {yomitan} from '../../yomitan.js';
import {DictionaryController} from './dictionary-controller.js';

export class BackupController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     * @param {?import('./modal-controller.js').ModalController} modalController
     */
    constructor(settingsController, modalController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {?import('./modal-controller.js').ModalController} */
        this._modalController = modalController;
        /** @type {?import('core').TokenObject} */
        this._settingsExportToken = null;
        /** @type {?() => void} */
        this._settingsExportRevoke = null;
        /** @type {number} */
        this._currentVersion = 0;
        /** @type {?import('./modal.js').Modal} */
        this._settingsResetModal = null;
        /** @type {?import('./modal.js').Modal} */
        this._settingsImportErrorModal = null;
        /** @type {?import('./modal.js').Modal} */
        this._settingsImportWarningModal = null;
        /** @type {?OptionsUtil} */
        this._optionsUtil = null;

        /** @type {string} */
        this._dictionariesDatabaseName = 'dict';
        /** @type {?import('core').TokenObject} */
        this._settingsExportDatabaseToken = null;

        try {
            this._optionsUtil = new OptionsUtil();
        } catch (e) {
            // NOP
        }
    }

    /** */
    async prepare() {
        if (this._optionsUtil !== null) {
            await this._optionsUtil.prepare();
        }

        if (this._modalController !== null) {
            this._settingsResetModal = this._modalController.getModal('settings-reset');
            this._settingsImportErrorModal = this._modalController.getModal('settings-import-error');
            this._settingsImportWarningModal = this._modalController.getModal('settings-import-warning');
        }

        this._addNodeEventListener('#settings-export-button', 'click', this._onSettingsExportClick.bind(this), false);
        this._addNodeEventListener('#settings-import-button', 'click', this._onSettingsImportClick.bind(this), false);
        this._addNodeEventListener('#settings-import-file', 'change', this._onSettingsImportFileChange.bind(this), false);
        this._addNodeEventListener('#settings-reset-button', 'click', this._onSettingsResetClick.bind(this), false);
        this._addNodeEventListener('#settings-reset-confirm-button', 'click', this._onSettingsResetConfirmClick.bind(this), false);

        this._addNodeEventListener('#settings-export-db-button', 'click', this._onSettingsExportDatabaseClick.bind(this), false);
        this._addNodeEventListener('#settings-import-db-button', 'click', this._onSettingsImportDatabaseClick.bind(this), false);
        this._addNodeEventListener('#settings-import-db', 'change', this._onSettingsImportDatabaseChange.bind(this), false);
    }

    // Private

    /**
     * @param {string} selector
     * @param {string} eventName
     * @param {(event: Event) => void} callback
     * @param {boolean} capture
     */
    _addNodeEventListener(selector, eventName, callback, capture) {
        const node = document.querySelector(selector);
        if (node === null) { return; }

        node.addEventListener(eventName, callback, capture);
    }

    /**
     * @param {Date} date
     * @param {string} dateSeparator
     * @param {string} dateTimeSeparator
     * @param {string} timeSeparator
     * @param {number} resolution
     * @returns {string}
     */
    _getSettingsExportDateString(date, dateSeparator, dateTimeSeparator, timeSeparator, resolution) {
        const values = [
            date.getUTCFullYear().toString(),
            dateSeparator,
            (date.getUTCMonth() + 1).toString().padStart(2, '0'),
            dateSeparator,
            date.getUTCDate().toString().padStart(2, '0'),
            dateTimeSeparator,
            date.getUTCHours().toString().padStart(2, '0'),
            timeSeparator,
            date.getUTCMinutes().toString().padStart(2, '0'),
            timeSeparator,
            date.getUTCSeconds().toString().padStart(2, '0')
        ];
        return values.slice(0, resolution * 2 - 1).join('');
    }

    /**
     * @param {Date} date
     * @returns {Promise<import('backup-controller').BackupData>}
     */
    async _getSettingsExportData(date) {
        const optionsFull = await this._settingsController.getOptionsFull();
        const environment = await yomitan.api.getEnvironmentInfo();
        const fieldTemplatesDefault = await yomitan.api.getDefaultAnkiFieldTemplates();
        const permissions = await this._settingsController.permissionsUtil.getAllPermissions();

        // Format options
        for (const {options} of optionsFull.profiles) {
            if (options.anki.fieldTemplates === fieldTemplatesDefault || !options.anki.fieldTemplates) {
                options.anki.fieldTemplates = null;
            }
        }

        const data = {
            version: this._currentVersion,
            date: this._getSettingsExportDateString(date, '-', ' ', ':', 6),
            url: chrome.runtime.getURL('/'),
            manifest: chrome.runtime.getManifest(),
            environment,
            userAgent: navigator.userAgent,
            permissions,
            options: optionsFull
        };

        return data;
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

    /** */
    async _onSettingsExportClick() {
        if (this._settingsExportRevoke !== null) {
            this._settingsExportRevoke();
            this._settingsExportRevoke = null;
        }

        const date = new Date(Date.now());

        /** @type {?import('core').TokenObject} */
        const token = {};
        this._settingsExportToken = token;
        const data = await this._getSettingsExportData(date);
        if (this._settingsExportToken !== token) {
            // A new export has been started
            return;
        }
        this._settingsExportToken = null;

        const fileName = `yomitan-settings-${this._getSettingsExportDateString(date, '-', '-', '-', 6)}.json`;
        const blob = new Blob([JSON.stringify(data, null, 4)], {type: 'application/json'});
        this._saveBlob(blob, fileName);
    }

    /**
     * @param {File} file
     * @returns {Promise<ArrayBuffer>}
     */
    _readFileArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(/** @type {ArrayBuffer} */ (reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    // Importing

    /**
     * @param {import('settings').Options} optionsFull
     */
    async _settingsImportSetOptionsFull(optionsFull) {
        await this._settingsController.setAllSettings(optionsFull);
    }

    /**
     * @param {Error} error
     */
    _showSettingsImportError(error) {
        log.error(error);
        /** @type {HTMLElement} */
        const element = querySelectorNotNull(document, '#settings-import-error-message');
        element.textContent = `${error}`;
        if (this._settingsImportErrorModal !== null) {
            this._settingsImportErrorModal.setVisible(true);
        }
    }

    /**
     * @param {Set<string>} warnings
     * @returns {Promise<import('backup-controller').ShowSettingsImportWarningsResult>}
     */
    async _showSettingsImportWarnings(warnings) {
        const modal = this._settingsImportWarningModal;
        if (modal === null) { return {result: false}; }
        const buttons = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.settings-import-warning-import-button'));
        const messageContainer = document.querySelector('#settings-import-warning-message');
        if (buttons.length === 0 || messageContainer === null) {
            return {result: false};
        }

        // Set message
        const fragment = document.createDocumentFragment();
        for (const warning of warnings) {
            const node = document.createElement('li');
            node.textContent = `${warning}`;
            fragment.appendChild(node);
        }
        messageContainer.textContent = '';
        messageContainer.appendChild(fragment);

        // Show modal
        modal.setVisible(true);

        // Wait for modal to close
        return new Promise((resolve) => {
            /**
             * @param {MouseEvent} e
             */
            const onButtonClick = (e) => {
                const element = /** @type {HTMLElement} */ (e.currentTarget);
                e.preventDefault();
                complete({
                    result: true,
                    sanitize: element.dataset.importSanitize === 'true'
                });
                modal.setVisible(false);
            };
            /**
             * @param {import('panel-element').EventArgument<'visibilityChanged'>} details
             */
            const onModalVisibilityChanged = ({visible}) => {
                if (visible) { return; }
                complete({result: false});
            };

            let completed = false;
            /**
             * @param {import('backup-controller').ShowSettingsImportWarningsResult} result
             */
            const complete = (result) => {
                if (completed) { return; }
                completed = true;

                modal.off('visibilityChanged', onModalVisibilityChanged);
                for (const button of buttons) {
                    button.removeEventListener('click', onButtonClick, false);
                }

                resolve(result);
            };

            // Hook events
            modal.on('visibilityChanged', onModalVisibilityChanged);
            for (const button of buttons) {
                button.addEventListener('click', onButtonClick, false);
            }
        });
    }

    /**
     * @param {string} urlString
     * @returns {boolean}
     */
    _isLocalhostUrl(urlString) {
        try {
            const url = new URL(urlString);
            switch (url.hostname.toLowerCase()) {
                case 'localhost':
                case '127.0.0.1':
                case '[::1]':
                    switch (url.protocol.toLowerCase()) {
                        case 'http:':
                        case 'https:':
                            return true;
                    }
                    break;
            }
        } catch (e) {
            // NOP
        }
        return false;
    }

    /**
     * @param {import('settings').ProfileOptions} options
     * @param {boolean} dryRun
     * @returns {string[]}
     */
    _settingsImportSanitizeProfileOptions(options, dryRun) {
        const warnings = [];

        const anki = options.anki;
        if (isObject(anki)) {
            const fieldTemplates = anki.fieldTemplates;
            if (typeof fieldTemplates === 'string') {
                warnings.push('anki.fieldTemplates contains a non-default value');
                if (!dryRun) {
                    anki.fieldTemplates = null;
                }
            }
            const server = anki.server;
            if (typeof server === 'string' && server.length > 0 && !this._isLocalhostUrl(server)) {
                warnings.push('anki.server uses a non-localhost URL');
                if (!dryRun) {
                    anki.server = 'http://127.0.0.1:8765';
                }
            }
        }

        const audio = options.audio;
        if (isObject(audio)) {
            const sources = audio.sources;
            if (Array.isArray(sources)) {
                for (let i = 0, ii = sources.length; i < ii; ++i) {
                    const source = sources[i];
                    if (!isObject(source)) { continue; }
                    const {url} = source;
                    if (typeof url === 'string' && url.length > 0 && !this._isLocalhostUrl(url)) {
                        warnings.push(`audio.sources[${i}].url uses a non-localhost URL`);
                        if (!dryRun) {
                            sources[i].url = '';
                        }
                    }
                }
            }
        }

        return warnings;
    }

    /**
     * @param {import('settings').Options} optionsFull
     * @param {boolean} dryRun
     * @returns {Set<string>}
     */
    _settingsImportSanitizeOptions(optionsFull, dryRun) {
        const warnings = new Set();

        const profiles = optionsFull.profiles;
        if (Array.isArray(profiles)) {
            for (const profile of profiles) {
                if (!isObject(profile)) { continue; }
                const options = profile.options;
                if (!isObject(options)) { continue; }

                const warnings2 = this._settingsImportSanitizeProfileOptions(options, dryRun);
                for (const warning of warnings2) {
                    warnings.add(warning);
                }
            }
        }

        return warnings;
    }

    /**
     * @param {File} file
     */
    async _importSettingsFile(file) {
        if (this._optionsUtil === null) { throw new Error('OptionsUtil invalid'); }

        const dataString = ArrayBufferUtil.arrayBufferUtf8Decode(await this._readFileArrayBuffer(file));
        /** @type {import('backup-controller').BackupData} */
        const data = parseJson(dataString);

        // Type check
        if (!isObject(data)) {
            throw new Error(`Invalid data type: ${typeof data}`);
        }

        // Version check
        const version = data.version;
        if (!(
            typeof version === 'number' &&
            Number.isFinite(version) &&
            version === Math.floor(version)
        )) {
            throw new Error(`Invalid version: ${version}`);
        }

        if (!(
            version >= 0 &&
            version <= this._currentVersion
        )) {
            throw new Error(`Unsupported version: ${version}`);
        }

        // Verify options exists
        let optionsFull = data.options;
        if (!isObject(optionsFull)) {
            throw new Error(`Invalid options type: ${typeof optionsFull}`);
        }

        // Upgrade options
        optionsFull = await this._optionsUtil.update(optionsFull);

        // Check for warnings
        const sanitizationWarnings = this._settingsImportSanitizeOptions(optionsFull, true);

        // Show sanitization warnings
        if (sanitizationWarnings.size > 0) {
            const {result, sanitize} = await this._showSettingsImportWarnings(sanitizationWarnings);
            if (!result) { return; }

            if (sanitize !== false) {
                this._settingsImportSanitizeOptions(optionsFull, false);
            }
        }

        // Update dictionaries
        await DictionaryController.ensureDictionarySettings(this._settingsController, void 0, optionsFull, false, false);

        // Assign options
        await this._settingsImportSetOptionsFull(optionsFull);
    }

    /** */
    _onSettingsImportClick() {
        /** @type {HTMLElement} */
        const element = querySelectorNotNull(document, '#settings-import-file');
        element.click();
    }

    /**
     * @param {Event} e
     */
    async _onSettingsImportFileChange(e) {
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        const files = element.files;
        if (files === null || files.length === 0) { return; }

        const file = files[0];
        element.value = '';
        try {
            await this._importSettingsFile(file);
        } catch (error) {
            this._showSettingsImportError(toError(error));
        }
    }

    // Resetting

    /** */
    _onSettingsResetClick() {
        if (this._settingsResetModal === null) { return; }
        this._settingsResetModal.setVisible(true);
    }

    /** */
    async _onSettingsResetConfirmClick() {
        if (this._optionsUtil === null) { throw new Error('OptionsUtil invalid'); }

        if (this._settingsResetModal !== null) {
            this._settingsResetModal.setVisible(false);
        }

        // Get default options
        const optionsFull = this._optionsUtil.getDefault();

        // Update dictionaries
        await DictionaryController.ensureDictionarySettings(this._settingsController, void 0, optionsFull, false, false);

        // Assign options
        try {
            await this._settingsImportSetOptionsFull(optionsFull);
        } catch (e) {
            log.error(e);
        }
    }

    // Exporting Dictionaries Database

    /**
     * @param {string} message
     * @param {boolean} [isWarning]
     */
    _databaseExportImportErrorMessage(message, isWarning = false) {
        /** @type {HTMLElement} */
        const errorMessageContainer = querySelectorNotNull(document, '#db-ops-error-report');
        errorMessageContainer.style.display = 'block';
        errorMessageContainer.textContent = message;

        if (isWarning) { // Hide after 5 seconds (5000 milliseconds)
            errorMessageContainer.style.color = '#FFC40C';
            setTimeout(function _hideWarningMessage() {
                errorMessageContainer.style.display = 'none';
                errorMessageContainer.style.color = '#8B0000';
            }, 5000);
        }
    }

    /**
     * @param {{totalRows: number, completedRows: number, done: boolean}} details
     */
    _databaseExportProgressCallback({totalRows, completedRows, done}) {
        // eslint-disable-next-line no-console
        console.log(`Progress: ${completedRows} of ${totalRows} rows completed`);
        /** @type {HTMLElement} */
        const messageContainer = querySelectorNotNull(document, '#db-ops-progress-report');
        messageContainer.style.display = 'block';
        messageContainer.textContent = `Export Progress: ${completedRows} of ${totalRows} rows completed`;

        if (done) {
            // eslint-disable-next-line no-console
            console.log('Done exporting.');
            messageContainer.style.display = 'none';
        }
    }

    /**
     * @param {string} databaseName
     * @returns {Promise<Blob>}
     */
    async _exportDatabase(databaseName) {
        const db = await new Dexie(databaseName).open();
        const blob = await db.export({progressCallback: this._databaseExportProgressCallback});
        await db.close();
        return blob;
    }

    /** */
    async _onSettingsExportDatabaseClick() {
        if (this._settingsExportDatabaseToken !== null) {
            // An existing import or export is in progress.
            this._databaseExportImportErrorMessage('An export or import operation is already in progress. Please wait till it is over.', true);
            return;
        }

        /** @type {HTMLElement} */
        const errorMessageContainer = querySelectorNotNull(document, '#db-ops-error-report');
        errorMessageContainer.style.display = 'none';

        const date = new Date(Date.now());
        const pageExitPrevention = this._settingsController.preventPageExit();
        try {
            /** @type {import('core').TokenObject} */
            const token = {};
            this._settingsExportDatabaseToken = token;
            const fileName = `yomitan-dictionaries-${this._getSettingsExportDateString(date, '-', '-', '-', 6)}.json`;
            const data = await this._exportDatabase(this._dictionariesDatabaseName);
            const blob = new Blob([data], {type: 'application/json'});
            this._saveBlob(blob, fileName);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(error);
            this._databaseExportImportErrorMessage('Errors encountered while exporting. Please try again. Restart the browser if it continues to fail.');
        } finally {
            pageExitPrevention.end();
            this._settingsExportDatabaseToken = null;
        }
    }

    // Importing Dictionaries Database

    /**
     * @param {{totalRows: number, completedRows: number, done: boolean}} details
     */
    _databaseImportProgressCallback({totalRows, completedRows, done}) {
        // eslint-disable-next-line no-console
        console.log(`Progress: ${completedRows} of ${totalRows} rows completed`);
        /** @type {HTMLElement} */
        const messageContainer = querySelectorNotNull(document, '#db-ops-progress-report');
        messageContainer.style.display = 'block';
        messageContainer.style.color = '#4169e1';
        messageContainer.textContent = `Import Progress: ${completedRows} of ${totalRows} rows completed`;

        if (done) {
            // eslint-disable-next-line no-console
            console.log('Done importing.');
            messageContainer.style.color = '#006633';
            messageContainer.textContent = 'Done importing. You will need to re-enable the dictionaries and refresh afterward. If you run into issues, please restart the browser. If it continues to fail, reinstall Yomitan and import dictionaries one-by-one.';
        }
    }

    /**
     * @param {string} databaseName
     * @param {File} file
     */
    async _importDatabase(databaseName, file) {
        await yomitan.api.purgeDatabase();
        await Dexie.import(file, {progressCallback: this._databaseImportProgressCallback});
        yomitan.api.triggerDatabaseUpdated('dictionary', 'import');
        yomitan.triggerStorageChanged();
    }

    /** */
    _onSettingsImportDatabaseClick() {
        /** @type {HTMLElement} */
        const element = querySelectorNotNull(document, '#settings-import-db');
        element.click();
    }

    /**
     * @param {Event} e
     */
    async _onSettingsImportDatabaseChange(e) {
        if (this._settingsExportDatabaseToken !== null) {
            // An existing import or export is in progress.
            this._databaseExportImportErrorMessage('An export or import operation is already in progress. Please wait till it is over.', true);
            return;
        }

        /** @type {HTMLElement} */
        const errorMessageContainer = querySelectorNotNull(document, '#db-ops-error-report');
        errorMessageContainer.style.display = 'none';

        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        const files = element.files;
        if (files === null || files.length === 0) { return; }

        const pageExitPrevention = this._settingsController.preventPageExit();
        const file = files[0];
        element.value = '';
        try {
            /** @type {import('core').TokenObject} */
            const token = {};
            this._settingsExportDatabaseToken = token;
            await this._importDatabase(this._dictionariesDatabaseName, file);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(error);
            /** @type {HTMLElement} */
            const messageContainer = querySelectorNotNull(document, '#db-ops-progress-report');
            messageContainer.style.color = 'red';
            this._databaseExportImportErrorMessage('Encountered errors when importing. Please restart the browser and try again. If it continues to fail, reinstall Yomitan and import dictionaries one-by-one.');
        } finally {
            pageExitPrevention.end();
            this._settingsExportDatabaseToken = null;
        }
    }
}

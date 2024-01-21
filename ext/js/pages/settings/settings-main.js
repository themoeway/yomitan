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

import {log} from '../../core/logger.js';
import {DocumentFocusController} from '../../dom/document-focus-controller.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {yomitan} from '../../yomitan.js';
import {ExtensionContentController} from '../common/extension-content-controller.js';
import {AnkiController} from './anki-controller.js';
import {AnkiTemplatesController} from './anki-templates-controller.js';
import {AudioController} from './audio-controller.js';
import {BackupController} from './backup-controller.js';
import {CollapsibleDictionaryController} from './collapsible-dictionary-controller.js';
import {DictionaryController} from './dictionary-controller.js';
import {DictionaryImportController} from './dictionary-import-controller.js';
import {ExtensionKeyboardShortcutController} from './extension-keyboard-shortcuts-controller.js';
import {GenericSettingController} from './generic-setting-controller.js';
import {KeyboardShortcutController} from './keyboard-shortcuts-controller.js';
import {MecabController} from './mecab-controller.js';
import {ModalController} from './modal-controller.js';
import {NestedPopupsController} from './nested-popups-controller.js';
import {PermissionsToggleController} from './permissions-toggle-controller.js';
import {PersistentStorageController} from './persistent-storage-controller.js';
import {PopupPreviewController} from './popup-preview-controller.js';
import {PopupWindowController} from './popup-window-controller.js';
import {ProfileController} from './profile-controller.js';
import {ScanInputsController} from './scan-inputs-controller.js';
import {ScanInputsSimpleController} from './scan-inputs-simple-controller.js';
import {SecondarySearchDictionaryController} from './secondary-search-dictionary-controller.js';
import {SentenceTerminationCharactersController} from './sentence-termination-characters-controller.js';
import {SettingsController} from './settings-controller.js';
import {SettingsDisplayController} from './settings-display-controller.js';
import {SortFrequencyDictionaryController} from './sort-frequency-dictionary-controller.js';
import {StatusFooter} from './status-footer.js';
import {StorageController} from './storage-controller.js';
import {TranslationTextReplacementsController} from './translation-text-replacements-controller.js';

/**
 * @param {GenericSettingController} genericSettingController
 */
async function setupGenericSettingController(genericSettingController) {
    await genericSettingController.prepare();
    await genericSettingController.refresh();
}

/** Entry point. */
async function main() {
    try {
        const documentFocusController = new DocumentFocusController();
        documentFocusController.prepare();

        const extensionContentController = new ExtensionContentController();
        extensionContentController.prepare();

        /** @type {HTMLElement} */
        const statusFooterElement = querySelectorNotNull(document, '.status-footer-container');
        const statusFooter = new StatusFooter(statusFooterElement);
        statusFooter.prepare();

        /** @type {?number} */
        let prepareTimer = window.setTimeout(() => {
            prepareTimer = null;
            document.documentElement.dataset.loadingStalled = 'true';
        }, 1000);

        await yomitan.prepare();

        if (prepareTimer !== null) {
            clearTimeout(prepareTimer);
            prepareTimer = null;
        }
        delete document.documentElement.dataset.loadingStalled;

        const preparePromises = [];

        const modalController = new ModalController();
        modalController.prepare();

        const settingsController = new SettingsController();
        await settingsController.prepare();

        const persistentStorageController = new PersistentStorageController();
        persistentStorageController.prepare();

        const storageController = new StorageController(persistentStorageController);
        storageController.prepare();

        const dictionaryController = new DictionaryController(settingsController, modalController, statusFooter);
        dictionaryController.prepare();

        const dictionaryImportController = new DictionaryImportController(settingsController, modalController, statusFooter);
        dictionaryImportController.prepare();

        const genericSettingController = new GenericSettingController(settingsController);
        preparePromises.push(setupGenericSettingController(genericSettingController));

        const audioController = new AudioController(settingsController, modalController);
        audioController.prepare();

        const profileController = new ProfileController(settingsController, modalController);
        profileController.prepare();

        const settingsBackup = new BackupController(settingsController, modalController);
        settingsBackup.prepare();

        const ankiController = new AnkiController(settingsController);
        ankiController.prepare();

        const ankiTemplatesController = new AnkiTemplatesController(settingsController, modalController, ankiController);
        ankiTemplatesController.prepare();

        const popupPreviewController = new PopupPreviewController(settingsController);
        popupPreviewController.prepare();

        const scanInputsController = new ScanInputsController(settingsController);
        scanInputsController.prepare();

        const simpleScanningInputController = new ScanInputsSimpleController(settingsController);
        simpleScanningInputController.prepare();

        const nestedPopupsController = new NestedPopupsController(settingsController);
        nestedPopupsController.prepare();

        const permissionsToggleController = new PermissionsToggleController(settingsController);
        permissionsToggleController.prepare();

        const secondarySearchDictionaryController = new SecondarySearchDictionaryController(settingsController);
        secondarySearchDictionaryController.prepare();

        const translationTextReplacementsController = new TranslationTextReplacementsController(settingsController);
        translationTextReplacementsController.prepare();

        const sentenceTerminationCharactersController = new SentenceTerminationCharactersController(settingsController);
        sentenceTerminationCharactersController.prepare();

        const keyboardShortcutController = new KeyboardShortcutController(settingsController);
        keyboardShortcutController.prepare();

        const extensionKeyboardShortcutController = new ExtensionKeyboardShortcutController(settingsController);
        extensionKeyboardShortcutController.prepare();

        const popupWindowController = new PopupWindowController();
        popupWindowController.prepare();

        const mecabController = new MecabController();
        mecabController.prepare();

        const collapsibleDictionaryController = new CollapsibleDictionaryController(settingsController);
        collapsibleDictionaryController.prepare();

        const sortFrequencyDictionaryController = new SortFrequencyDictionaryController(settingsController);
        sortFrequencyDictionaryController.prepare();

        await Promise.all(preparePromises);

        document.documentElement.dataset.loaded = 'true';

        const settingsDisplayController = new SettingsDisplayController(settingsController, modalController);
        settingsDisplayController.prepare();
    } catch (e) {
        log.error(e);
    }
}

await main();

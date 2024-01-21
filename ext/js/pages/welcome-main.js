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

import {log} from '../core/logger.js';
import {DocumentFocusController} from '../dom/document-focus-controller.js';
import {querySelectorNotNull} from '../dom/query-selector.js';
import {yomitan} from '../yomitan.js';
import {ExtensionContentController} from './common/extension-content-controller.js';
import {DictionaryController} from './settings/dictionary-controller.js';
import {DictionaryImportController} from './settings/dictionary-import-controller.js';
import {GenericSettingController} from './settings/generic-setting-controller.js';
import {ModalController} from './settings/modal-controller.js';
import {RecommendedPermissionsController} from './settings/recommended-permissions-controller.js';
import {ScanInputsSimpleController} from './settings/scan-inputs-simple-controller.js';
import {SettingsController} from './settings/settings-controller.js';
import {SettingsDisplayController} from './settings/settings-display-controller.js';
import {StatusFooter} from './settings/status-footer.js';

/** */
async function setupEnvironmentInfo() {
    const {manifest_version: manifestVersion} = chrome.runtime.getManifest();
    const {browser, platform} = await yomitan.api.getEnvironmentInfo();
    document.documentElement.dataset.browser = browser;
    document.documentElement.dataset.os = platform.os;
    document.documentElement.dataset.manifestVersion = `${manifestVersion}`;
}

/**
 * @param {GenericSettingController} genericSettingController
 */
async function setupGenericSettingsController(genericSettingController) {
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

        await yomitan.prepare();

        setupEnvironmentInfo();

        chrome.storage.session.get({'needsCustomTemplatesWarning': false}).then((result) => {
            if (result.needsCustomTemplatesWarning) {
                document.documentElement.dataset.warnCustomTemplates = 'true';
                chrome.storage.session.remove(['needsCustomTemplatesWarning']);
            }
        });

        const preparePromises = [];

        const modalController = new ModalController();
        modalController.prepare();

        const settingsController = new SettingsController();
        await settingsController.prepare();

        const dictionaryController = new DictionaryController(settingsController, modalController, statusFooter);
        dictionaryController.prepare();

        const dictionaryImportController = new DictionaryImportController(settingsController, modalController, statusFooter);
        dictionaryImportController.prepare();

        const genericSettingController = new GenericSettingController(settingsController);
        preparePromises.push(setupGenericSettingsController(genericSettingController));

        const simpleScanningInputController = new ScanInputsSimpleController(settingsController);
        simpleScanningInputController.prepare();

        const recommendedPermissionsController = new RecommendedPermissionsController(settingsController);
        recommendedPermissionsController.prepare();

        await Promise.all(preparePromises);

        document.documentElement.dataset.loaded = 'true';

        const settingsDisplayController = new SettingsDisplayController(settingsController, modalController);
        settingsDisplayController.prepare();
    } catch (e) {
        log.error(e);
    }
}

await main();

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

import {Application} from '../application.js';
import {DocumentFocusController} from '../dom/document-focus-controller.js';
import {querySelectorNotNull} from '../dom/query-selector.js';
import {ExtensionContentController} from './common/extension-content-controller.js';
import {DictionaryController} from './settings/dictionary-controller.js';
import {DictionaryImportController} from './settings/dictionary-import-controller.js';
import {GenericSettingController} from './settings/generic-setting-controller.js';
import {LanguagesController} from './settings/languages-controller.js';
import {ModalController} from './settings/modal-controller.js';
import {RecommendedPermissionsController} from './settings/recommended-permissions-controller.js';
import {ScanInputsSimpleController} from './settings/scan-inputs-simple-controller.js';
import {SettingsController} from './settings/settings-controller.js';
import {SettingsDisplayController} from './settings/settings-display-controller.js';
import {StatusFooter} from './settings/status-footer.js';

/**
 * @param {import('../comm/api.js').API} api
 */
async function setupEnvironmentInfo(api) {
    const {manifest_version: manifestVersion} = chrome.runtime.getManifest();
    const {browser, platform} = await api.getEnvironmentInfo();
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

/** */
async function checkNeedsCustomTemplatesWarning() {
    const key = 'needsCustomTemplatesWarning';
    const result = await chrome.storage.session.get({[key]: false});
    if (!result[key]) { return; }
    document.documentElement.dataset.warnCustomTemplates = 'true';
    await chrome.storage.session.remove([key]);
}

await Application.main(true, async (application) => {
    const modalController = new ModalController();
    modalController.prepare();

    const settingsController = new SettingsController(application);
    await settingsController.prepare();

    const settingsDisplayController = new SettingsDisplayController(settingsController, modalController);
    await settingsDisplayController.prepare();

    document.body.hidden = false;

    const documentFocusController = new DocumentFocusController();
    documentFocusController.prepare();

    const extensionContentController = new ExtensionContentController();
    extensionContentController.prepare();

    /** @type {HTMLElement} */
    const statusFooterElement = querySelectorNotNull(document, '.status-footer-container');
    const statusFooter = new StatusFooter(statusFooterElement);
    statusFooter.prepare();

    void setupEnvironmentInfo(application.api);
    void checkNeedsCustomTemplatesWarning();

    const preparePromises = [];

    const genericSettingController = new GenericSettingController(settingsController);
    preparePromises.push(setupGenericSettingsController(genericSettingController));

    const dictionaryController = new DictionaryController(settingsController, modalController, statusFooter);
    preparePromises.push(dictionaryController.prepare());

    const dictionaryImportController = new DictionaryImportController(settingsController, modalController, statusFooter);
    preparePromises.push(dictionaryImportController.prepare());

    const simpleScanningInputController = new ScanInputsSimpleController(settingsController);
    preparePromises.push(simpleScanningInputController.prepare());

    const recommendedPermissionsController = new RecommendedPermissionsController(settingsController);
    preparePromises.push(recommendedPermissionsController.prepare());

    const languagesController = new LanguagesController(settingsController);
    preparePromises.push(languagesController.prepare());

    await Promise.all(preparePromises);

    document.documentElement.dataset.loaded = 'true';
});

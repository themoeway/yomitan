/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2021-2022  Yomichan Authors
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

import {querySelectorNotNull} from '../../dom/query-selector.js';

export class LanguagesController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {string} */
        this._lastSelectedLanguage = '';
    }

    /** */
    async prepare() {
        const languages = await this._settingsController.application.api.getLanguageSummaries();
        languages.sort((a, b) => a.name.localeCompare(b.name, 'en'));
        const languageSelect = this._fillSelect(languages);
        languageSelect.addEventListener(
            /** @type {string} */ ('settingChanged'),
            /** @type {EventListener} */ (this._onLanguageSelectChanged.bind(this)),
            false,
        );
    }

    /**
     * @param {import('language').LanguageSummary[]} languages
     * @returns {Element}
     */
    _fillSelect(languages) {
        const selectElement = querySelectorNotNull(document, '#language-select');
        for (const {iso, name} of languages) {
            const option = document.createElement('option');
            option.value = iso;
            option.text = `${name} (${iso})`;
            selectElement.appendChild(option);
        }
        return selectElement;
    }

    /**
     * @param {import('dom-data-binder').SettingChangedEvent} settingChangedEvent
     */
    async _onLanguageSelectChanged(settingChangedEvent) {
        const existingSettings = await this._settingsController.getProfileSettings([{path: 'general.language'}]);
        const existingLanguage = existingSettings[0].result;
        const setLanguage = settingChangedEvent.detail.value;
        if (typeof existingLanguage !== 'string' || typeof setLanguage !== 'string') { return; }
        if (this._lastSelectedLanguage === '') {
            this._lastSelectedLanguage = setLanguage;
        } else if (this._lastSelectedLanguage !== setLanguage) {
            this._lastSelectedLanguage = setLanguage;
            const yes = confirm('Changing language to: ' + setLanguage + '. Continue?');
            if (yes) {
                await this._settingsController.applyLanguageSettingOverrides(setLanguage);
            }
        }
    }
}

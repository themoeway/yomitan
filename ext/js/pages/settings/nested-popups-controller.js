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

import {DocumentUtil} from '../../dom/document-util.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';

export class NestedPopupsController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {number} */
        this._popupNestingMaxDepth = 0;
        /** @type {HTMLInputElement} */
        this._nestedPopupsEnabled = querySelectorNotNull(document, '#nested-popups-enabled');
        /** @type {HTMLInputElement} */
        this._nestedPopupsCount = querySelectorNotNull(document, '#nested-popups-count');
        /** @type {HTMLElement} */
        this._nestedPopupsEnabledMoreOptions = querySelectorNotNull(document, '#nested-popups-enabled-more-options');
    }

    /** */
    async prepare() {
        const options = await this._settingsController.getOptions();
        const optionsContext = this._settingsController.getOptionsContext();

        this._nestedPopupsEnabled.addEventListener('change', this._onNestedPopupsEnabledChange.bind(this), false);
        this._nestedPopupsCount.addEventListener('change', this._onNestedPopupsCountChange.bind(this), false);
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));
        this._onOptionsChanged({options, optionsContext});
    }

    // Private

    /**
     * @param {import('settings-controller').EventArgument<'optionsChanged'>} details
     */
    _onOptionsChanged({options}) {
        this._updatePopupNestingMaxDepth(options.scanning.popupNestingMaxDepth);
    }

    /**
     * @param {Event} e
     */
    _onNestedPopupsEnabledChange(e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        const value = node.checked;
        if (value && this._popupNestingMaxDepth > 0) { return; }
        this._setPopupNestingMaxDepth(value ? 1 : 0);
    }

    /**
     * @param {Event} e
     */
    _onNestedPopupsCountChange(e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        const value = Math.max(1, DocumentUtil.convertElementValueToNumber(node.value, node));
        this._setPopupNestingMaxDepth(value);
    }

    /**
     * @param {number} value
     */
    _updatePopupNestingMaxDepth(value) {
        const enabled = (value > 0);
        this._popupNestingMaxDepth = value;
        /** @type {HTMLInputElement} */ (this._nestedPopupsEnabled).checked = enabled;
        /** @type {HTMLInputElement} */ (this._nestedPopupsCount).value = `${value}`;
        /** @type {HTMLElement} */ (this._nestedPopupsEnabledMoreOptions).hidden = !enabled;
    }

    /**
     * @param {number} value
     */
    async _setPopupNestingMaxDepth(value) {
        this._updatePopupNestingMaxDepth(value);
        await this._settingsController.setProfileSetting('scanning.popupNestingMaxDepth', value);
    }
}

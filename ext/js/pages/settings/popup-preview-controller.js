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

import {querySelectorNotNull} from '../../dom/query-selector.js';

export class PopupPreviewController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {string} */
        this._targetOrigin = chrome.runtime.getURL('/').replace(/\/$/, '');
        /** @type {HTMLIFrameElement} */
        this._frame = querySelectorNotNull(document, '#popup-preview-frame');
        /** @type {HTMLTextAreaElement} */
        this._customCss = querySelectorNotNull(document, '#custom-popup-css');
        /** @type {HTMLTextAreaElement} */
        this._customOuterCss = querySelectorNotNull(document, '#custom-popup-outer-css');
        /** @type {HTMLElement} */
        this._previewFrameContainer = querySelectorNotNull(document, '.preview-frame-container');
    }

    /** */
    async prepare() {
        if (new URLSearchParams(location.search).get('popup-preview') === 'false') { return; }

        this._customCss.addEventListener('input', this._onCustomCssChange.bind(this), false);
        this._customCss.addEventListener('settingChanged', this._onCustomCssChange.bind(this), false);
        this._customOuterCss.addEventListener('input', this._onCustomOuterCssChange.bind(this), false);
        this._customOuterCss.addEventListener('settingChanged', this._onCustomOuterCssChange.bind(this), false);
        this._frame.addEventListener('load', this._onFrameLoad.bind(this), false);
        this._settingsController.on('optionsContextChanged', this._onOptionsContextChange.bind(this));

        this._frame.src = '/popup-preview.html';
    }

    // Private

    /** */
    _onFrameLoad() {
        this._onOptionsContextChange();
        this._onCustomCssChange();
        this._onCustomOuterCssChange();
    }

    /** */
    _onCustomCssChange() {
        const css = /** @type {HTMLTextAreaElement} */ (this._customCss).value;
        this._invoke('PopupPreviewFrame.setCustomCss', {css});
    }

    /** */
    _onCustomOuterCssChange() {
        const css = /** @type {HTMLTextAreaElement} */ (this._customOuterCss).value;
        this._invoke('PopupPreviewFrame.setCustomOuterCss', {css});
    }

    /** */
    _onOptionsContextChange() {
        const optionsContext = this._settingsController.getOptionsContext();
        this._invoke('PopupPreviewFrame.updateOptionsContext', {optionsContext});
    }

    /**
     * @param {string} action
     * @param {import('core').SerializableObject} params
     */
    _invoke(action, params) {
        if (this._frame === null || this._frame.contentWindow === null) { return; }
        this._frame.contentWindow.postMessage({action, params}, this._targetOrigin);
    }
}

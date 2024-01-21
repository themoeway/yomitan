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

import * as wanakana from '../../../lib/wanakana.js';
import {Frontend} from '../../app/frontend.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {TextSourceRange} from '../../dom/text-source-range.js';
import {yomitan} from '../../yomitan.js';

export class PopupPreviewFrame {
    /**
     * @param {number} tabId
     * @param {number} frameId
     * @param {import('../../app/popup-factory.js').PopupFactory} popupFactory
     * @param {import('../../input/hotkey-handler.js').HotkeyHandler} hotkeyHandler
     */
    constructor(tabId, frameId, popupFactory, hotkeyHandler) {
        /** @type {number} */
        this._tabId = tabId;
        /** @type {number} */
        this._frameId = frameId;
        /** @type {import('../../app/popup-factory.js').PopupFactory} */
        this._popupFactory = popupFactory;
        /** @type {import('../../input/hotkey-handler.js').HotkeyHandler} */
        this._hotkeyHandler = hotkeyHandler;
        /** @type {?Frontend} */
        this._frontend = null;
        /** @type {?(optionsContext: import('settings').OptionsContext) => Promise<import('settings').ProfileOptions>} */
        this._apiOptionsGetOld = null;
        /** @type {boolean} */
        this._popupShown = false;
        /** @type {?import('core').Timeout} */
        this._themeChangeTimeout = null;
        /** @type {?import('text-source').TextSource} */
        this._textSource = null;
        /** @type {?import('settings').OptionsContext} */
        this._optionsContext = null;
        /** @type {HTMLElement} */
        this._exampleText = querySelectorNotNull(document, '#example-text');
        /** @type {HTMLInputElement} */
        this._exampleTextInput = querySelectorNotNull(document, '#example-text-input');
        /** @type {string} */
        this._targetOrigin = chrome.runtime.getURL('/').replace(/\/$/, '');

        /* eslint-disable no-multi-spaces */
        /** @type {Map<string, (params: import('core').SerializableObjectAny) => void>} */
        this._windowMessageHandlers = new Map(/** @type {[key: string, handler: (params: import('core').SerializableObjectAny) => void][]} */ ([
            ['PopupPreviewFrame.setText',              this._onSetText.bind(this)],
            ['PopupPreviewFrame.setCustomCss',         this._setCustomCss.bind(this)],
            ['PopupPreviewFrame.setCustomOuterCss',    this._setCustomOuterCss.bind(this)],
            ['PopupPreviewFrame.updateOptionsContext', this._updateOptionsContext.bind(this)]
        ]));
        /* eslint-enable no-multi-spaces */
    }

    /** */
    async prepare() {
        if (this._exampleTextInput !== null && typeof wanakana !== 'undefined') {
            wanakana.bind(this._exampleTextInput);
        }

        window.addEventListener('message', this._onMessage.bind(this), false);

        // Setup events
        /** @type {HTMLInputElement} */
        const darkThemeCheckbox = querySelectorNotNull(document, '#theme-dark-checkbox');
        darkThemeCheckbox.addEventListener('change', this._onThemeDarkCheckboxChanged.bind(this), false);
        this._exampleText.addEventListener('click', this._onExampleTextClick.bind(this), false);
        this._exampleTextInput.addEventListener('blur', this._onExampleTextInputBlur.bind(this), false);
        this._exampleTextInput.addEventListener('input', this._onExampleTextInputInput.bind(this), false);

        // Overwrite API functions
        /** @type {?(optionsContext: import('settings').OptionsContext) => Promise<import('settings').ProfileOptions>} */
        this._apiOptionsGetOld = yomitan.api.optionsGet.bind(yomitan.api);
        yomitan.api.optionsGet = this._apiOptionsGet.bind(this);

        // Overwrite frontend
        this._frontend = new Frontend({
            tabId: this._tabId,
            frameId: this._frameId,
            popupFactory: this._popupFactory,
            depth: 0,
            parentPopupId: null,
            parentFrameId: null,
            useProxyPopup: false,
            canUseWindowPopup: false,
            pageType: 'web',
            allowRootFramePopupProxy: false,
            childrenSupported: false,
            hotkeyHandler: this._hotkeyHandler
        });
        this._frontend.setOptionsContextOverride(this._optionsContext);
        await this._frontend.prepare();
        this._frontend.setDisabledOverride(true);
        this._frontend.canClearSelection = false;
        const {popup} = this._frontend;
        if (popup !== null) {
            popup.on('customOuterCssChanged', this._onCustomOuterCssChanged.bind(this));
        }

        // Update search
        this._updateSearch();
    }

    // Private

    /**
     * @param {import('settings').OptionsContext} optionsContext
     * @returns {Promise<import('settings').ProfileOptions>}
     */
    async _apiOptionsGet(optionsContext) {
        const options = await /** @type {(optionsContext: import('settings').OptionsContext) => Promise<import('settings').ProfileOptions>} */ (this._apiOptionsGetOld)(optionsContext);
        options.general.enable = true;
        options.general.debugInfo = false;
        options.general.popupWidth = 400;
        options.general.popupHeight = 250;
        options.general.popupHorizontalOffset = 0;
        options.general.popupVerticalOffset = 10;
        options.general.popupHorizontalOffset2 = 10;
        options.general.popupVerticalOffset2 = 0;
        options.general.popupHorizontalTextPosition = 'below';
        options.general.popupVerticalTextPosition = 'before';
        options.scanning.selectText = false;
        return options;
    }

    /**
     * @param {import('popup').EventArgument<'customOuterCssChanged'>} details
     */
    _onCustomOuterCssChanged({node, inShadow}) {
        if (node === null || inShadow) { return; }

        const node2 = document.querySelector('#popup-outer-css');
        if (node2 === null) { return; }
        const {parentNode} = node2;
        if (parentNode === null) { return; }

        // This simulates the stylesheet priorities when injecting using the web extension API.
        parentNode.insertBefore(node, node2);
    }

    /**
     * @param {MessageEvent<{action: string, params: import('core').SerializableObject}>} e
     */
    _onMessage(e) {
        if (e.origin !== this._targetOrigin) { return; }

        const {action, params} = e.data;
        const handler = this._windowMessageHandlers.get(action);
        if (typeof handler !== 'function') { return; }

        handler(params);
    }

    /**
     * @param {Event} e
     */
    _onThemeDarkCheckboxChanged(e) {
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        document.documentElement.classList.toggle('dark', element.checked);
        if (this._themeChangeTimeout !== null) {
            clearTimeout(this._themeChangeTimeout);
        }
        this._themeChangeTimeout = setTimeout(() => {
            this._themeChangeTimeout = null;
            const popup = /** @type {Frontend} */ (this._frontend).popup;
            if (popup === null) { return; }
            popup.updateTheme();
        }, 300);
    }

    /** */
    _onExampleTextClick() {
        if (this._exampleTextInput === null) { return; }
        const visible = this._exampleTextInput.hidden;
        this._exampleTextInput.hidden = !visible;
        if (!visible) { return; }
        this._exampleTextInput.focus();
        this._exampleTextInput.select();
    }

    /** */
    _onExampleTextInputBlur() {
        if (this._exampleTextInput === null) { return; }
        this._exampleTextInput.hidden = true;
    }

    /**
     * @param {Event} e
     */
    _onExampleTextInputInput(e) {
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        this._setText(element.value, false);
    }

    /**
     * @param {{text: string}} details
     */
    _onSetText({text}) {
        this._setText(text, true);
    }

    /**
     * @param {string} text
     * @param {boolean} setInput
     */
    _setText(text, setInput) {
        if (setInput && this._exampleTextInput !== null) {
            this._exampleTextInput.value = text;
        }

        if (this._exampleText === null) { return; }

        this._exampleText.textContent = text;
        if (this._frontend === null) { return; }
        this._updateSearch();
    }

    /**
     * @param {boolean} visible
     */
    _setInfoVisible(visible) {
        const node = document.querySelector('.placeholder-info');
        if (node === null) { return; }

        node.classList.toggle('placeholder-info-visible', visible);
    }

    /**
     * @param {{css: string}} details
     */
    _setCustomCss({css}) {
        if (this._frontend === null) { return; }
        const popup = this._frontend.popup;
        if (popup === null) { return; }
        popup.setCustomCss(css);
    }

    /**
     * @param {{css: string}} details
     */
    _setCustomOuterCss({css}) {
        if (this._frontend === null) { return; }
        const popup = this._frontend.popup;
        if (popup === null) { return; }
        popup.setCustomOuterCss(css, false);
    }

    /**
     * @param {{optionsContext: import('settings').OptionsContext}} details
     */
    async _updateOptionsContext(details) {
        const {optionsContext} = details;
        this._optionsContext = optionsContext;
        if (this._frontend === null) { return; }
        this._frontend.setOptionsContextOverride(optionsContext);
        await this._frontend.updateOptions();
        await this._updateSearch();
    }

    /** */
    async _updateSearch() {
        if (this._exampleText === null) { return; }

        const textNode = this._exampleText.firstChild;
        if (textNode === null) { return; }

        const range = document.createRange();
        range.selectNodeContents(textNode);
        const source = TextSourceRange.create(range);
        const frontend = /** @type {Frontend} */ (this._frontend);

        try {
            await frontend.setTextSource(source);
        } finally {
            source.cleanup();
        }
        this._textSource = source;
        await frontend.showContentCompleted();

        const popup = frontend.popup;
        if (popup !== null && popup.isVisibleSync()) {
            this._popupShown = true;
        }

        this._setInfoVisible(!this._popupShown);
    }
}

/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2017-2022  Yomichan Authors
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

import {PermissionsUtil} from '../data/permissions-util.js';
import {querySelectorNotNull} from '../dom/query-selector.js';
import {HotkeyHelpController} from '../input/hotkey-help-controller.js';
import {yomitan} from '../yomitan.js';

class DisplayController {
    constructor() {
        /** @type {?import('settings').Options} */
        this._optionsFull = null;
        /** @type {PermissionsUtil} */
        this._permissionsUtil = new PermissionsUtil();
    }

    /** */
    async prepare() {
        const manifest = chrome.runtime.getManifest();

        this._showExtensionInfo(manifest);
        this._setupEnvironment();
        this._setupButtonEvents('.action-open-search', 'openSearchPage', chrome.runtime.getURL('/search.html'), this._onSearchClick.bind(this));
        this._setupButtonEvents('.action-open-info', 'openInfoPage', chrome.runtime.getURL('/info.html'));

        const optionsFull = await yomitan.api.optionsGetFull();
        this._optionsFull = optionsFull;

        this._setupHotkeys();

        const optionsPageUrl = (
            typeof manifest.options_ui === 'object' &&
            manifest.options_ui !== null &&
            typeof manifest.options_ui.page === 'string' ?
            manifest.options_ui.page : ''
        );
        this._setupButtonEvents('.action-open-settings', 'openSettingsPage', chrome.runtime.getURL(optionsPageUrl));
        this._setupButtonEvents('.action-open-permissions', null, chrome.runtime.getURL('/permissions.html'));

        const {profiles, profileCurrent} = optionsFull;
        const primaryProfile = (profileCurrent >= 0 && profileCurrent < profiles.length) ? profiles[profileCurrent] : null;
        if (primaryProfile !== null) {
            this._setupOptions(primaryProfile);
        }

        /** @type {HTMLElement} */
        const profileSelect = querySelectorNotNull(document, '.action-select-profile');
        profileSelect.hidden = (profiles.length <= 1);

        this._updateProfileSelect(profiles, profileCurrent);

        setTimeout(() => {
            document.body.dataset.loaded = 'true';
        }, 10);
    }

    // Private

    /**
     * @param {MouseEvent} e
     */
    _onSearchClick(e) {
        if (!e.shiftKey) { return; }
        e.preventDefault();
        location.href = '/search.html?action-popup=true';
    }

    /**
     * @param {chrome.runtime.Manifest} manifest
     */
    _showExtensionInfo(manifest) {
        const node = document.getElementById('extension-info');
        if (node === null) { return; }

        node.textContent = `${manifest.name} v${manifest.version}`;
    }

    /**
     * @param {string} selector
     * @param {?string} command
     * @param {string} url
     * @param {(event: MouseEvent) => void} [customHandler]
     */
    _setupButtonEvents(selector, command, url, customHandler) {
        /** @type {NodeListOf<HTMLAnchorElement>} */
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
            if (typeof command === 'string') {
                /**
                 * @param {MouseEvent} e
                 */
                const onClick = (e) => {
                    if (e.button !== 0) { return; }
                    if (typeof customHandler === 'function') {
                        const result = customHandler(e);
                        if (typeof result !== 'undefined') { return; }
                    }
                    yomitan.api.commandExec(command, {mode: e.ctrlKey ? 'newTab' : 'existingOrNewTab'});
                    e.preventDefault();
                };
                /**
                 * @param {MouseEvent} e
                 */
                const onAuxClick = (e) => {
                    if (e.button !== 1) { return; }
                    yomitan.api.commandExec(command, {mode: 'newTab'});
                    e.preventDefault();
                };
                node.addEventListener('click', onClick, false);
                node.addEventListener('auxclick', onAuxClick, false);
            }

            if (typeof url === 'string') {
                node.href = url;
                node.target = '_blank';
                node.rel = 'noopener';
            }
        }
    }

    /** */
    async _setupEnvironment() {
        const urlSearchParams = new URLSearchParams(location.search);
        let mode = urlSearchParams.get('mode');
        switch (mode) {
            case 'full':
            case 'mini':
                break;
            default:
                {
                    let tab;
                    try {
                        tab = await this._getCurrentTab();
                        // Safari assigns a tab object to the popup, other browsers do not
                        if (tab && await this._isSafari()) {
                            tab = void 0;
                        }
                    } catch (e) {
                        // NOP
                    }
                    mode = (tab ? 'full' : 'mini');
                }
                break;
        }

        document.documentElement.dataset.mode = mode;
    }

    /**
     * @returns {Promise<chrome.tabs.Tab|undefined>}
     */
    _getCurrentTab() {
        return new Promise((resolve, reject) => {
            chrome.tabs.getCurrent((result) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * @param {import('settings').Profile} profile
     */
    _setupOptions({options}) {
        const extensionEnabled = options.general.enable;
        const onToggleChanged = () => yomitan.api.commandExec('toggleTextScanning');
        for (const toggle of /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('#enable-search,#enable-search2'))) {
            toggle.checked = extensionEnabled;
            toggle.addEventListener('change', onToggleChanged, false);
        }
        this._updateDictionariesEnabledWarnings(options);
        this._updatePermissionsWarnings(options);
    }

    /** */
    async _setupHotkeys() {
        const hotkeyHelpController = new HotkeyHelpController();
        await hotkeyHelpController.prepare();

        const {profiles, profileCurrent} = /** @type {import('settings').Options} */ (this._optionsFull);
        const primaryProfile = (profileCurrent >= 0 && profileCurrent < profiles.length) ? profiles[profileCurrent] : null;
        if (primaryProfile !== null) {
            hotkeyHelpController.setOptions(primaryProfile.options);
        }

        hotkeyHelpController.setupNode(document.documentElement);
    }

    /**
     * @param {import('settings').Profile[]} profiles
     * @param {number} profileCurrent
     */
    _updateProfileSelect(profiles, profileCurrent) {
        /** @type {HTMLSelectElement} */
        const select = querySelectorNotNull(document, '#profile-select');
        /** @type {HTMLElement} */
        const optionGroup = querySelectorNotNull(document, '#profile-select-option-group');
        const fragment = document.createDocumentFragment();
        for (let i = 0, ii = profiles.length; i < ii; ++i) {
            const {name} = profiles[i];
            const option = document.createElement('option');
            option.textContent = name;
            option.value = `${i}`;
            fragment.appendChild(option);
        }
        optionGroup.textContent = '';
        optionGroup.appendChild(fragment);
        select.value = `${profileCurrent}`;

        select.addEventListener('change', this._onProfileSelectChange.bind(this), false);
    }

    /**
     * @param {Event} event
     */
    _onProfileSelectChange(event) {
        const node = /** @type {HTMLInputElement} */ (event.currentTarget);
        const value = parseInt(node.value, 10);
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= /** @type {import('settings').Options} */ (this._optionsFull).profiles.length) {
            this._setPrimaryProfileIndex(value);
        }
    }

    /**
     * @param {number} value
     */
    async _setPrimaryProfileIndex(value) {
        /** @type {import('settings-modifications').ScopedModificationSet} */
        const modification = {
            action: 'set',
            path: 'profileCurrent',
            value,
            scope: 'global',
            optionsContext: null
        };
        await yomitan.api.modifySettings([modification], 'action-popup');
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    async _updateDictionariesEnabledWarnings(options) {
        const noDictionariesEnabledWarnings = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.no-dictionaries-enabled-warning'));
        const dictionaries = await yomitan.api.getDictionaryInfo();

        const enabledDictionaries = new Set();
        for (const {name, enabled} of options.dictionaries) {
            if (enabled) {
                enabledDictionaries.add(name);
            }
        }

        let enabledCount = 0;
        for (const {title} of dictionaries) {
            if (enabledDictionaries.has(title)) {
                ++enabledCount;
            }
        }

        const hasEnabledDictionary = (enabledCount > 0);
        for (const node of noDictionariesEnabledWarnings) {
            node.hidden = hasEnabledDictionary;
        }
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    async _updatePermissionsWarnings(options) {
        const permissions = await this._permissionsUtil.getAllPermissions();
        if (this._permissionsUtil.hasRequiredPermissionsForOptions(permissions, options)) { return; }

        const warnings = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.action-open-permissions,.permissions-required-warning'));
        for (const node of warnings) {
            node.hidden = false;
        }
    }

    /** @returns {Promise<boolean>} */
    async _isSafari() {
        const {browser} = await yomitan.api.getEnvironmentInfo();
        return browser === 'safari';
    }
}

/** Entry point. */
async function main() {
    await yomitan.prepare();

    yomitan.api.logIndicatorClear();

    const displayController = new DisplayController();
    displayController.prepare();

    yomitan.ready();
}

await main();

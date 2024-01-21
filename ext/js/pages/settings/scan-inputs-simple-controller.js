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

import {querySelectorNotNull} from '../../dom/query-selector.js';
import {HotkeyUtil} from '../../input/hotkey-util.js';
import {yomitan} from '../../yomitan.js';
import {ScanInputsController} from './scan-inputs-controller.js';

export class ScanInputsSimpleController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {HTMLInputElement} */
        this._middleMouseButtonScan = querySelectorNotNull(document, '#middle-mouse-button-scan');
        /** @type {HTMLSelectElement} */
        this._mainScanModifierKeyInput = querySelectorNotNull(document, '#main-scan-modifier-key');
        /** @type {boolean} */
        this._mainScanModifierKeyInputHasOther = false;
        /** @type {HotkeyUtil} */
        this._hotkeyUtil = new HotkeyUtil();
    }

    /** */
    async prepare() {
        const {platform: {os}} = await yomitan.api.getEnvironmentInfo();
        this._hotkeyUtil.os = os;

        this._mainScanModifierKeyInputHasOther = false;
        this._populateSelect(this._mainScanModifierKeyInput, this._mainScanModifierKeyInputHasOther);

        const options = await this._settingsController.getOptions();
        const optionsContext = this._settingsController.getOptionsContext();

        this._middleMouseButtonScan.addEventListener('change', this.onMiddleMouseButtonScanChange.bind(this), false);
        this._mainScanModifierKeyInput.addEventListener('change', this._onMainScanModifierKeyInputChange.bind(this), false);

        this._settingsController.on('scanInputsChanged', this._onScanInputsChanged.bind(this));
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));
        this._onOptionsChanged({options, optionsContext});
    }

    /** */
    async refresh() {
        const options = await this._settingsController.getOptions();
        const optionsContext = this._settingsController.getOptionsContext();
        this._onOptionsChanged({options, optionsContext});
    }

    // Private

    /**
     * @param {import('settings-controller').EventArgument<'scanInputsChanged'>} details
     */
    _onScanInputsChanged({source}) {
        if (source === this) { return; }
        this.refresh();
    }

    /**
     * @param {import('settings-controller').EventArgument<'optionsChanged'>} details
     */
    _onOptionsChanged({options}) {
        const {scanning: {inputs}} = options;
        const middleMouseSupportedIndex = this._getIndexOfMiddleMouseButtonScanInput(inputs);
        const mainScanInputIndex = this._getIndexOfMainScanInput(inputs);
        const hasMainScanInput = (mainScanInputIndex >= 0);

        let middleMouseSupported = false;
        if (middleMouseSupportedIndex >= 0) {
            const includeValues = this._splitValue(inputs[middleMouseSupportedIndex].include);
            if (includeValues.includes('mouse2')) {
                middleMouseSupported = true;
            }
        }

        let mainScanInput = 'none';
        if (hasMainScanInput) {
            const includeValues = this._splitValue(inputs[mainScanInputIndex].include);
            if (includeValues.length > 0) {
                mainScanInput = includeValues[0];
            }
        } else {
            mainScanInput = 'other';
        }

        this._setHasMainScanInput(hasMainScanInput);

        /** @type {HTMLInputElement} */ (this._middleMouseButtonScan).checked = middleMouseSupported;
        /** @type {HTMLSelectElement} */ (this._mainScanModifierKeyInput).value = mainScanInput;
    }

    /**
     * @param {Event} e
     */
    onMiddleMouseButtonScanChange(e) {
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        const middleMouseSupported = element.checked;
        this._setMiddleMouseSuppported(middleMouseSupported);
    }

    /**
     * @param {Event} e
     */
    _onMainScanModifierKeyInputChange(e) {
        const element = /** @type {HTMLSelectElement} */ (e.currentTarget);
        const mainScanKey = element.value;
        if (mainScanKey === 'other') { return; }
        const mainScanInputs = (mainScanKey === 'none' ? [] : [mainScanKey]);
        this._setMainScanInputs(mainScanInputs);
    }

    /**
     * @param {HTMLSelectElement} select
     * @param {boolean} hasOther
     */
    _populateSelect(select, hasOther) {
        const modifierKeys = [
            {value: 'none', name: 'No key'}
        ];
        for (const value of /** @type {import('input').ModifierKey[]} */ (['alt', 'ctrl', 'shift', 'meta'])) {
            const name = this._hotkeyUtil.getModifierDisplayValue(value);
            modifierKeys.push({value, name});
        }

        if (hasOther) {
            modifierKeys.push({value: 'other', name: 'Other'});
        }

        const fragment = document.createDocumentFragment();
        for (const {value, name} of modifierKeys) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = name;
            fragment.appendChild(option);
        }
        select.textContent = '';
        select.appendChild(fragment);
    }

    /**
     * @param {string} value
     * @returns {string[]}
     */
    _splitValue(value) {
        return value.split(/[,;\s]+/).map((v) => v.trim().toLowerCase()).filter((v) => v.length > 0);
    }

    /**
     * @param {boolean} value
     */
    async _setMiddleMouseSuppported(value) {
        // Find target index
        const options = await this._settingsController.getOptions();
        const {scanning: {inputs}} = options;
        const index = this._getIndexOfMiddleMouseButtonScanInput(inputs);

        if (value) {
            // Add new
            if (index >= 0) { return; }
            let insertionPosition = this._getIndexOfMainScanInput(inputs);
            insertionPosition = (insertionPosition >= 0 ? insertionPosition + 1 : inputs.length);
            const input = ScanInputsController.createDefaultMouseInput('mouse2', '');
            await this._modifyProfileSettings([{
                action: 'splice',
                path: 'scanning.inputs',
                start: insertionPosition,
                deleteCount: 0,
                items: [input]
            }]);
        } else {
            // Modify existing
            if (index < 0) { return; }
            await this._modifyProfileSettings([{
                action: 'splice',
                path: 'scanning.inputs',
                start: index,
                deleteCount: 1,
                items: []
            }]);
        }
    }

    /**
     * @param {string[]} value
     */
    async _setMainScanInputs(value) {
        const value2 = value.join(', ');

        // Find target index
        const options = await this._settingsController.getOptions();
        const {scanning: {inputs}} = options;
        const index = this._getIndexOfMainScanInput(inputs);

        this._setHasMainScanInput(true);

        if (index < 0) {
            // Add new
            const input = ScanInputsController.createDefaultMouseInput(value2, 'mouse0');
            await this._modifyProfileSettings([{
                action: 'splice',
                path: 'scanning.inputs',
                start: inputs.length,
                deleteCount: 0,
                items: [input]
            }]);
        } else {
            // Modify existing
            await this._modifyProfileSettings([{
                action: 'set',
                path: `scanning.inputs[${index}].include`,
                value: value2
            }]);
        }
    }

    /**
     * @param {import('settings-modifications').Modification[]} targets
     */
    async _modifyProfileSettings(targets) {
        await this._settingsController.modifyProfileSettings(targets);
        /** @type {import('settings-controller').EventArgument<'scanInputsChanged'>} */
        const event = {source: this};
        this._settingsController.trigger('scanInputsChanged', event);
    }

    /**
     * @param {import('settings').ScanningInput[]} inputs
     * @returns {number}
     */
    _getIndexOfMainScanInput(inputs) {
        for (let i = 0, ii = inputs.length; i < ii; ++i) {
            const {include, exclude, types: {mouse}} = inputs[i];
            if (!mouse) { continue; }
            const includeValues = this._splitValue(include);
            const excludeValues = this._splitValue(exclude);
            if (
                (
                    includeValues.length === 0 ||
                    (includeValues.length === 1 && !this._isMouseInput(includeValues[0]))
                ) &&
                excludeValues.length === 1 &&
                excludeValues[0] === 'mouse0'
            ) {
                return i;
            }
        }
        return -1;
    }

    /**
     * @param {import('settings').ScanningInput[]} inputs
     * @returns {number}
     */
    _getIndexOfMiddleMouseButtonScanInput(inputs) {
        for (let i = 0, ii = inputs.length; i < ii; ++i) {
            const {include, exclude, types: {mouse}} = inputs[i];
            if (!mouse) { continue; }
            const includeValues = this._splitValue(include);
            const excludeValues = this._splitValue(exclude);
            if (
                (includeValues.length === 1 && includeValues[0] === 'mouse2') &&
                excludeValues.length === 0
            ) {
                return i;
            }
        }
        return -1;
    }

    /**
     * @param {string} input
     * @returns {boolean}
     */
    _isMouseInput(input) {
        return /^mouse\d+$/.test(input);
    }

    /**
     * @param {boolean} hasMainScanInput
     */
    _setHasMainScanInput(hasMainScanInput) {
        if (this._mainScanModifierKeyInputHasOther !== hasMainScanInput) { return; }
        this._mainScanModifierKeyInputHasOther = !hasMainScanInput;
        if (this._mainScanModifierKeyInput !== null) {
            this._populateSelect(this._mainScanModifierKeyInput, this._mainScanModifierKeyInputHasOther);
        }
    }
}

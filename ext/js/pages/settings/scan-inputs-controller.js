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

import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {DocumentUtil} from '../../dom/document-util.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {yomitan} from '../../yomitan.js';
import {KeyboardMouseInputField} from './keyboard-mouse-input-field.js';

export class ScanInputsController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {?import('environment').OperatingSystem} */
        this._os = null;
        /** @type {HTMLElement} */
        this._container = querySelectorNotNull(document, '#scan-input-list');
        /** @type {HTMLButtonElement} */
        this._addButton = querySelectorNotNull(document, '#scan-input-add');
        /** @type {?NodeListOf<HTMLElement>} */
        this._scanningInputCountNodes = null;
        /** @type {ScanInputField[]} */
        this._entries = [];
    }

    /** */
    async prepare() {
        const {platform: {os}} = await yomitan.api.getEnvironmentInfo();
        this._os = os;

        this._scanningInputCountNodes = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.scanning-input-count'));

        this._addButton.addEventListener('click', this._onAddButtonClick.bind(this), false);
        this._settingsController.on('scanInputsChanged', this._onScanInputsChanged.bind(this));
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));

        this.refresh();
    }

    /**
     * @param {number} index
     * @returns {boolean}
     */
    removeInput(index) {
        if (index < 0 || index >= this._entries.length) { return false; }
        const input = this._entries[index];
        input.cleanup();
        this._entries.splice(index, 1);
        for (let i = index, ii = this._entries.length; i < ii; ++i) {
            this._entries[i].index = i;
        }
        this._updateCounts();
        this._modifyProfileSettings([{
            action: 'splice',
            path: 'scanning.inputs',
            start: index,
            deleteCount: 1,
            items: []
        }]);
        return true;
    }

    /**
     * @param {number} index
     * @param {string} property
     * @param {unknown} value
     * @param {boolean} event
     */
    async setProperty(index, property, value, event) {
        const path = `scanning.inputs[${index}].${property}`;
        await this._settingsController.setProfileSetting(path, value);
        if (event) {
            this._triggerScanInputsChanged();
        }
    }

    /**
     * @param {string} name
     * @returns {Element}
     */
    instantiateTemplate(name) {
        return this._settingsController.instantiateTemplate(name);
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
        const {inputs} = options.scanning;

        for (let i = this._entries.length - 1; i >= 0; --i) {
            this._entries[i].cleanup();
        }
        this._entries.length = 0;

        for (let i = 0, ii = inputs.length; i < ii; ++i) {
            this._addOption(i, inputs[i]);
        }

        this._updateCounts();
    }

    /**
     * @param {MouseEvent} e
     */
    _onAddButtonClick(e) {
        e.preventDefault();

        const index = this._entries.length;
        const scanningInput = ScanInputsController.createDefaultMouseInput('', '');
        this._addOption(index, scanningInput);
        this._updateCounts();
        this._modifyProfileSettings([{
            action: 'splice',
            path: 'scanning.inputs',
            start: index,
            deleteCount: 0,
            items: [scanningInput]
        }]);

        // Scroll to bottom
        const button = /** @type {HTMLElement} */ (e.currentTarget);
        const modalContainer = /** @type {HTMLElement} */ (button.closest('.modal'));
        /** @type {HTMLElement} */
        const scrollContainer = querySelectorNotNull(modalContainer, '.modal-body');
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }

    /**
     * @param {number} index
     * @param {import('settings').ScanningInput} scanningInput
     */
    _addOption(index, scanningInput) {
        if (this._os === null || this._container === null) { return; }
        const field = new ScanInputField(this, index, this._os);
        this._entries.push(field);
        field.prepare(this._container, scanningInput);
    }

    /** */
    _updateCounts() {
        const stringValue = `${this._entries.length}`;
        for (const node of /** @type {NodeListOf<HTMLElement>} */ (this._scanningInputCountNodes)) {
            node.textContent = stringValue;
        }
    }

    /**
     * @param {import('settings-modifications').Modification[]} targets
     */
    async _modifyProfileSettings(targets) {
        await this._settingsController.modifyProfileSettings(targets);
        this._triggerScanInputsChanged();
    }

    /** */
    _triggerScanInputsChanged() {
        /** @type {import('settings-controller').EventArgument<'scanInputsChanged'>} */
        const event = {source: this};
        this._settingsController.trigger('scanInputsChanged', event);
    }

    /**
     * @param {string} include
     * @param {string} exclude
     * @returns {import('settings').ScanningInput}
     */
    static createDefaultMouseInput(include, exclude) {
        return {
            include,
            exclude,
            types: {mouse: true, touch: false, pen: false},
            options: {
                showAdvanced: false,
                searchTerms: true,
                searchKanji: true,
                scanOnTouchMove: true,
                scanOnTouchPress: true,
                scanOnTouchRelease: false,
                scanOnPenMove: true,
                scanOnPenHover: true,
                scanOnPenReleaseHover: false,
                scanOnPenPress: true,
                scanOnPenRelease: false,
                preventTouchScrolling: true,
                preventPenScrolling: true
            }
        };
    }
}

class ScanInputField {
    /**
     * @param {ScanInputsController} parent
     * @param {number} index
     * @param {import('environment').OperatingSystem} os
     */
    constructor(parent, index, os) {
        /** @type {ScanInputsController} */
        this._parent = parent;
        /** @type {number} */
        this._index = index;
        /** @type {import('environment').OperatingSystem} */
        this._os = os;
        /** @type {?HTMLElement} */
        this._node = null;
        /** @type {?KeyboardMouseInputField} */
        this._includeInputField = null;
        /** @type {?KeyboardMouseInputField} */
        this._excludeInputField = null;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
    }

    /** @type {number} */
    get index() {
        return this._index;
    }

    set index(value) {
        this._index = value;
        this._updateDataSettingTargets();
    }

    /**
     * @param {HTMLElement} container
     * @param {import('settings').ScanningInput} scanningInput
     */
    prepare(container, scanningInput) {
        const {include, exclude, options: {showAdvanced}} = scanningInput;

        const node = /** @type {HTMLElement} */ (this._parent.instantiateTemplate('scan-input'));
        /** @type {HTMLInputElement} */
        const includeInputNode = querySelectorNotNull(node, '.scan-input-field[data-property=include]');
        /** @type {HTMLButtonElement} */
        const includeMouseButton = querySelectorNotNull(node, '.mouse-button[data-property=include]');
        /** @type {HTMLInputElement} */
        const excludeInputNode = querySelectorNotNull(node, '.scan-input-field[data-property=exclude]');
        /** @type {HTMLButtonElement} */
        const excludeMouseButton = querySelectorNotNull(node, '.mouse-button[data-property=exclude]');
        /** @type {HTMLButtonElement} */
        const menuButton = querySelectorNotNull(node, '.scanning-input-menu-button');

        node.dataset.showAdvanced = `${showAdvanced}`;

        this._node = node;
        container.appendChild(node);

        const isPointerTypeSupported = this._isPointerTypeSupported.bind(this);
        this._includeInputField = new KeyboardMouseInputField(includeInputNode, includeMouseButton, this._os, isPointerTypeSupported);
        this._excludeInputField = new KeyboardMouseInputField(excludeInputNode, excludeMouseButton, this._os, isPointerTypeSupported);
        this._includeInputField.prepare(null, this._splitModifiers(include), true, false);
        this._excludeInputField.prepare(null, this._splitModifiers(exclude), true, false);

        this._eventListeners.on(this._includeInputField, 'change', this._onIncludeValueChange.bind(this));
        this._eventListeners.on(this._excludeInputField, 'change', this._onExcludeValueChange.bind(this));
        this._eventListeners.addEventListener(menuButton, 'menuOpen', this._onMenuOpen.bind(this));
        this._eventListeners.addEventListener(menuButton, 'menuClose', this._onMenuClose.bind(this));

        this._updateDataSettingTargets();
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();
        if (this._includeInputField !== null) {
            this._includeInputField.cleanup();
            this._includeInputField = null;
        }
        if (this._node !== null) {
            const parent = this._node.parentNode;
            if (parent !== null) { parent.removeChild(this._node); }
            this._node = null;
        }
    }

    // Private

    /**
     * @param {import('keyboard-mouse-input-field').EventArgument<'change'>} details
     */
    _onIncludeValueChange({modifiers}) {
        const modifiers2 = this._joinModifiers(modifiers);
        this._parent.setProperty(this._index, 'include', modifiers2, true);
    }

    /**
     * @param {import('keyboard-mouse-input-field').EventArgument<'change'>} details
     */
    _onExcludeValueChange({modifiers}) {
        const modifiers2 = this._joinModifiers(modifiers);
        this._parent.setProperty(this._index, 'exclude', modifiers2, true);
    }

    /**
     * @param {MouseEvent} e
     */
    _onRemoveClick(e) {
        e.preventDefault();
        this._removeSelf();
    }

    /**
     * @param {import('popup-menu').MenuOpenEvent} e
     */
    _onMenuOpen(e) {
        const bodyNode = e.detail.menu.bodyNode;
        /** @type {?HTMLElement} */
        const showAdvanced = bodyNode.querySelector('.popup-menu-item[data-menu-action="showAdvanced"]');
        /** @type {?HTMLElement} */
        const hideAdvanced = bodyNode.querySelector('.popup-menu-item[data-menu-action="hideAdvanced"]');
        const advancedVisible = (this._node !== null && this._node.dataset.showAdvanced === 'true');
        if (showAdvanced !== null) {
            showAdvanced.hidden = advancedVisible;
        }
        if (hideAdvanced !== null) {
            hideAdvanced.hidden = !advancedVisible;
        }
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onMenuClose(e) {
        switch (e.detail.action) {
            case 'remove':
                this._removeSelf();
                break;
            case 'showAdvanced':
                this._setAdvancedOptionsVisible(true);
                break;
            case 'hideAdvanced':
                this._setAdvancedOptionsVisible(false);
                break;
            case 'clearInputs':
                /** @type {KeyboardMouseInputField} */ (this._includeInputField).clearInputs();
                /** @type {KeyboardMouseInputField} */ (this._excludeInputField).clearInputs();
                break;
        }
    }

    /**
     * @param {string} pointerType
     * @returns {boolean}
     */
    _isPointerTypeSupported(pointerType) {
        if (this._node === null) { return false; }
        const node = /** @type {?HTMLInputElement} */ (this._node.querySelector(`input.scan-input-settings-checkbox[data-property="types.${pointerType}"]`));
        return node !== null && node.checked;
    }

    /** */
    _updateDataSettingTargets() {
        if (this._node === null) { return; }
        const index = this._index;
        for (const typeCheckbox of /** @type {NodeListOf<HTMLElement>} */ (this._node.querySelectorAll('.scan-input-settings-checkbox'))) {
            const {property} = typeCheckbox.dataset;
            typeCheckbox.dataset.setting = `scanning.inputs[${index}].${property}`;
        }
    }

    /** */
    _removeSelf() {
        this._parent.removeInput(this._index);
    }

    /**
     * @param {boolean} showAdvanced
     */
    _setAdvancedOptionsVisible(showAdvanced) {
        showAdvanced = !!showAdvanced;
        if (this._node !== null) {
            this._node.dataset.showAdvanced = `${showAdvanced}`;
        }
        this._parent.setProperty(this._index, 'options.showAdvanced', showAdvanced, false);
    }

    /**
     * @param {string} modifiersString
     * @returns {import('input').Modifier[]}
     */
    _splitModifiers(modifiersString) {
        /** @type {import('input').Modifier[]} */
        const results = [];
        for (const modifier of modifiersString.split(/[,;\s]+/)) {
            const modifier2 = DocumentUtil.normalizeModifier(modifier.trim().toLowerCase());
            if (modifier2 === null) { continue; }
            results.push(modifier2);
        }
        return results;
    }

    /**
     * @param {import('input').Modifier[]} modifiersArray
     * @returns {string}
     */
    _joinModifiers(modifiersArray) {
        return modifiersArray.join(', ');
    }
}

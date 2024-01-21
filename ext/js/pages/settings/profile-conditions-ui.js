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

import {EventDispatcher} from '../../core/event-dispatcher.js';
import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {DocumentUtil} from '../../dom/document-util.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {KeyboardMouseInputField} from './keyboard-mouse-input-field.js';

/**
 * @augments EventDispatcher<import('profile-conditions-ui').Events>
 */
export class ProfileConditionsUI extends EventDispatcher {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        super();
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {?import('environment').OperatingSystem} */
        this._os = null;
        /** @type {HTMLElement} */
        this._conditionGroupsContainer = querySelectorNotNull(document, '#profile-condition-groups');
        /** @type {HTMLElement} */
        this._addConditionGroupButton = querySelectorNotNull(document, '#profile-add-condition-group');
        /** @type {ProfileConditionGroupUI[]} */
        this._children = [];
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {import('profile-conditions-ui').DescriptorType} */
        this._defaultType = 'popupLevel';
        /** @type {number} */
        this._profileIndex = 0;
        const validateInteger = this._validateInteger.bind(this);
        const normalizeInteger = this._normalizeInteger.bind(this);
        const validateFlags = this._validateFlags.bind(this);
        const normalizeFlags = this._normalizeFlags.bind(this);
        /* eslint-disable no-multi-spaces */
        /** @type {Map<import('profile-conditions-ui').DescriptorType, import('profile-conditions-ui').Descriptor>} */
        this._descriptors = new Map([
            [
                'popupLevel',
                {
                    displayName: 'Popup Level',
                    defaultOperator: 'equal',
                    operators: new Map([
                        ['equal',              {displayName: '=',      type: 'integer', defaultValue: '0', validate: validateInteger, normalize: normalizeInteger}],
                        ['notEqual',           {displayName: '\u2260', type: 'integer', defaultValue: '0', validate: validateInteger, normalize: normalizeInteger}],
                        ['lessThan',           {displayName: '<',      type: 'integer', defaultValue: '0', validate: validateInteger, normalize: normalizeInteger}],
                        ['greaterThan',        {displayName: '>',      type: 'integer', defaultValue: '0', validate: validateInteger, normalize: normalizeInteger}],
                        ['lessThanOrEqual',    {displayName: '\u2264', type: 'integer', defaultValue: '0', validate: validateInteger, normalize: normalizeInteger}],
                        ['greaterThanOrEqual', {displayName: '\u2265', type: 'integer', defaultValue: '0', validate: validateInteger, normalize: normalizeInteger}]
                    ])
                }
            ],
            [
                'url',
                {
                    displayName: 'URL',
                    defaultOperator: 'matchDomain',
                    operators: new Map([
                        ['matchDomain', {displayName: 'Matches Domain', type: 'string', defaultValue: 'example.com',   resetDefaultOnChange: true, validate: this._validateDomains.bind(this), normalize: this._normalizeDomains.bind(this)}],
                        ['matchRegExp', {displayName: 'Matches RegExp', type: 'string', defaultValue: 'example\\.com', resetDefaultOnChange: true, validate: this._validateRegExp.bind(this)}]
                    ])
                }
            ],
            [
                'modifierKeys',
                {
                    displayName: 'Modifier Keys',
                    defaultOperator: 'are',
                    operators: new Map([
                        ['are',        {displayName: 'Are',            type: 'modifierKeys', defaultValue: ''}],
                        ['areNot',     {displayName: 'Are Not',        type: 'modifierKeys', defaultValue: ''}],
                        ['include',    {displayName: 'Include',        type: 'modifierKeys', defaultValue: ''}],
                        ['notInclude', {displayName: 'Don\'t Include', type: 'modifierKeys', defaultValue: ''}]
                    ])
                }
            ],
            [
                'flags',
                {
                    displayName: 'Flags',
                    defaultOperator: 'are',
                    operators: new Map([
                        ['are',        {displayName: 'Are',            type: 'string', defaultValue: '', validate: validateFlags, normalize: normalizeFlags}],
                        ['areNot',     {displayName: 'Are Not',        type: 'string', defaultValue: '', validate: validateFlags, normalize: normalizeFlags}],
                        ['include',    {displayName: 'Include',        type: 'string', defaultValue: '', validate: validateFlags, normalize: normalizeFlags}],
                        ['notInclude', {displayName: 'Don\'t Include', type: 'string', defaultValue: '', validate: validateFlags, normalize: normalizeFlags}]
                    ])
                }
            ]
        ]);
        /* eslint-enable no-multi-spaces */
        /** @type {Set<string>} */
        this._validFlags = new Set([
            'clipboard'
        ]);
    }

    /** @type {import('./settings-controller.js').SettingsController} */
    get settingsController() {
        return this._settingsController;
    }

    /** @type {number} */
    get profileIndex() {
        return this._profileIndex;
    }

    /** @type {?import('environment').OperatingSystem} */
    get os() {
        return this._os;
    }

    set os(value) {
        this._os = value;
    }

    /**
     * @param {number} profileIndex
     */
    async prepare(profileIndex) {
        const options = await this._settingsController.getOptionsFull();
        const {profiles} = options;
        if (profileIndex < 0 || profileIndex >= profiles.length) { return; }
        const {conditionGroups} = profiles[profileIndex];

        this._profileIndex = profileIndex;

        for (let i = 0, ii = conditionGroups.length; i < ii; ++i) {
            this._addConditionGroup(conditionGroups[i], i);
        }

        this._eventListeners.addEventListener(this._addConditionGroupButton, 'click', this._onAddConditionGroupButtonClick.bind(this), false);
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();

        for (const child of this._children) {
            child.cleanup();
        }
        this._children = [];
    }

    /**
     * @param {string} name
     * @returns {HTMLElement}
     */
    instantiateTemplate(name) {
        return /** @type {HTMLElement} */ (this._settingsController.instantiateTemplate(name));
    }

    /**
     * @returns {import('profile-conditions-ui').DescriptorInfo[]}
     */
    getDescriptorTypes() {
        const results = [];
        for (const [name, {displayName}] of this._descriptors.entries()) {
            results.push({name, displayName});
        }
        return results;
    }

    /**
     * @param {import('profile-conditions-ui').DescriptorType} type
     * @returns {import('profile-conditions-ui').OperatorInfo[]}
     */
    getDescriptorOperators(type) {
        const info = this._descriptors.get(type);
        const results = [];
        if (typeof info !== 'undefined') {
            for (const [name, {displayName}] of info.operators.entries()) {
                results.push({name, displayName});
            }
        }
        return results;
    }

    /**
     * @returns {import('profile-conditions-ui').DescriptorType}
     */
    getDefaultType() {
        return this._defaultType;
    }

    /**
     * @param {import('profile-conditions-ui').DescriptorType} type
     * @returns {string}
     */
    getDefaultOperator(type) {
        const info = this._descriptors.get(type);
        return (typeof info !== 'undefined' ? info.defaultOperator : '');
    }

    /**
     * @param {import('profile-conditions-ui').DescriptorType} type
     * @param {string} operator
     * @returns {import('profile-conditions-ui').Operator}
     */
    getOperatorDetails(type, operator) {
        const info = this._getOperatorDetails(type, operator);

        const {
            displayName = operator,
            type: type2 = 'string',
            defaultValue = '',
            resetDefaultOnChange = false,
            validate = null,
            normalize = null
        } = (typeof info === 'undefined' ? {} : info);

        return {
            displayName,
            type: type2,
            defaultValue,
            resetDefaultOnChange,
            validate,
            normalize
        };
    }

    /**
     * @returns {import('settings').ProfileCondition}
     */
    getDefaultCondition() {
        const type = this.getDefaultType();
        const operator = this.getDefaultOperator(type);
        const {defaultValue: value} = this.getOperatorDetails(type, operator);
        return {type, operator, value};
    }

    /**
     * @param {ProfileConditionGroupUI} child
     * @returns {boolean}
     */
    removeConditionGroup(child) {
        const index = child.index;
        if (index < 0 || index >= this._children.length) { return false; }

        const child2 = this._children[index];
        if (child !== child2) { return false; }

        this._children.splice(index, 1);
        child.cleanup();

        for (let i = index, ii = this._children.length; i < ii; ++i) {
            this._children[i].index = i;
        }

        this.settingsController.modifyGlobalSettings([{
            action: 'splice',
            path: this.getPath('conditionGroups'),
            start: index,
            deleteCount: 1,
            items: []
        }]);

        this._triggerConditionGroupCountChanged(this._children.length);

        return true;
    }

    /**
     * @param {string} value
     * @returns {string[]}
     */
    splitValue(value) {
        return value.split(/[,;\s]+/).map((v) => v.trim().toLowerCase()).filter((v) => v.length > 0);
    }

    /**
     * @param {string} property
     * @returns {string}
     */
    getPath(property) {
        property = (typeof property === 'string' ? `.${property}` : '');
        return `profiles[${this.profileIndex}]${property}`;
    }

    /**
     * @param {HTMLInputElement} inputNode
     * @param {?HTMLButtonElement} mouseButton
     * @returns {KeyboardMouseInputField}
     */
    createKeyboardMouseInputField(inputNode, mouseButton) {
        return new KeyboardMouseInputField(inputNode, mouseButton, this._os);
    }

    /**
     * @param {string} value
     * @returns {?import('settings').ProfileConditionType}
     */
    static normalizeProfileConditionType(value) {
        switch (value) {
            case 'popupLevel':
            case 'url':
            case 'modifierKeys':
            case 'flags':
                return value;
            default:
                return null;
        }
    }

    // Private

    /** */
    _onAddConditionGroupButtonClick() {
        /** @type {import('settings').ProfileConditionGroup} */
        const conditionGroup = {
            conditions: [this.getDefaultCondition()]
        };
        const index = this._children.length;

        this._addConditionGroup(conditionGroup, index);

        this.settingsController.modifyGlobalSettings([{
            action: 'splice',
            path: this.getPath('conditionGroups'),
            start: index,
            deleteCount: 0,
            items: [conditionGroup]
        }]);

        this._triggerConditionGroupCountChanged(this._children.length);
    }

    /**
     * @param {import('settings').ProfileConditionGroup} conditionGroup
     * @param {number} index
     * @returns {ProfileConditionGroupUI}
     */
    _addConditionGroup(conditionGroup, index) {
        const child = new ProfileConditionGroupUI(this, index);
        child.prepare(conditionGroup);
        this._children.push(child);
        this._conditionGroupsContainer.appendChild(child.node);
        return child;
    }

    /**
     * @param {import('profile-conditions-ui').DescriptorType} type
     * @param {string} operator
     * @returns {import('profile-conditions-ui').OperatorInternal|undefined}
     */
    _getOperatorDetails(type, operator) {
        const info = this._descriptors.get(type);
        return (typeof info !== 'undefined' ? info.operators.get(operator) : void 0);
    }

    /**
     * @param {string} value
     * @returns {boolean}
     */
    _validateInteger(value) {
        const number = Number.parseFloat(value);
        return Number.isFinite(number) && Math.floor(number) === number;
    }

    /**
     * @param {string} value
     * @returns {boolean}
     */
    _validateDomains(value) {
        return this.splitValue(value).length > 0;
    }

    /**
     * @param {string} value
     * @returns {boolean}
     */
    _validateRegExp(value) {
        try {
            // eslint-disable-next-line no-new
            new RegExp(value, 'i');
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * @param {string} value
     * @returns {string}
     */
    _normalizeInteger(value) {
        const number = Number.parseFloat(value);
        return `${number}`;
    }

    /**
     * @param {string} value
     * @returns {string}
     */
    _normalizeDomains(value) {
        return this.splitValue(value).join(', ');
    }

    /**
     * @param {string} value
     * @returns {boolean}
     */
    _validateFlags(value) {
        const flags = this.splitValue(value);
        for (const flag of flags) {
            if (!this._validFlags.has(flag)) {
                return false;
            }
        }
        return flags.length > 0;
    }

    /**
     * @param {string} value
     * @returns {string}
     */
    _normalizeFlags(value) {
        return [...new Set(this.splitValue(value))].join(', ');
    }

    /**
     * @param {number} count
     */
    _triggerConditionGroupCountChanged(count) {
        this.trigger('conditionGroupCountChanged', {count, profileIndex: this._profileIndex});
    }
}

class ProfileConditionGroupUI {
    /**
     * @param {ProfileConditionsUI} parent
     * @param {number} index
     */
    constructor(parent, index) {
        /** @type {ProfileConditionsUI} */
        this._parent = parent;
        /** @type {number} */
        this._index = index;
        /** @type {HTMLElement} */
        this._node = /** @type {HTMLElement} */ (this._parent.instantiateTemplate('profile-condition-group'));
        /** @type {HTMLElement} */
        this._conditionContainer = querySelectorNotNull(this._node, '.profile-condition-list');
        /** @type {HTMLElement} */
        this._addConditionButton = querySelectorNotNull(this._node, '.profile-condition-add-button');
        /** @type {ProfileConditionUI[]} */
        this._children = [];
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
    }

    /** @type {import('./settings-controller.js').SettingsController} */
    get settingsController() {
        return this._parent.settingsController;
    }

    /** @type {ProfileConditionsUI} */
    get parent() {
        return this._parent;
    }

    /** @type {number} */
    get index() {
        return this._index;
    }

    set index(value) {
        this._index = value;
    }

    /** @type {HTMLElement} */
    get node() {
        return this._node;
    }

    /** @type {number} */
    get childCount() {
        return this._children.length;
    }

    /**
     * @param {import('settings').ProfileConditionGroup} conditionGroup
     */
    prepare(conditionGroup) {
        const conditions = conditionGroup.conditions;
        for (let i = 0, ii = conditions.length; i < ii; ++i) {
            this._addCondition(conditions[i], i);
        }

        this._eventListeners.addEventListener(this._addConditionButton, 'click', this._onAddConditionButtonClick.bind(this), false);
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();

        for (const child of this._children) {
            child.cleanup();
        }
        this._children = [];

        if (this._node === null) { return; }

        const node = this._node;
        if (node.parentNode !== null) {
            node.parentNode.removeChild(node);
        }
    }

    /**
     * @param {ProfileConditionUI} child
     * @returns {boolean}
     */
    removeCondition(child) {
        const index = child.index;
        if (index < 0 || index >= this._children.length) { return false; }

        const child2 = this._children[index];
        if (child !== child2) { return false; }

        this._children.splice(index, 1);
        child.cleanup();

        for (let i = index, ii = this._children.length; i < ii; ++i) {
            this._children[i].index = i;
        }

        this.settingsController.modifyGlobalSettings([{
            action: 'splice',
            path: this.getPath('conditions'),
            start: index,
            deleteCount: 1,
            items: []
        }]);

        if (this._children.length === 0) {
            this.removeSelf();
        }

        return true;
    }

    /**
     * @param {string} property
     * @returns {string}
     */
    getPath(property) {
        property = (typeof property === 'string' ? `.${property}` : '');
        return this._parent.getPath(`conditionGroups[${this._index}]${property}`);
    }

    /** */
    removeSelf() {
        this._parent.removeConditionGroup(this);
    }

    // Private

    /** */
    _onAddConditionButtonClick() {
        const condition = this._parent.getDefaultCondition();
        const index = this._children.length;

        this._addCondition(condition, index);

        this.settingsController.modifyGlobalSettings([{
            action: 'splice',
            path: this.getPath('conditions'),
            start: index,
            deleteCount: 0,
            items: [condition]
        }]);
    }

    /**
     * @param {import('settings').ProfileCondition} condition
     * @param {number} index
     * @returns {ProfileConditionUI}
     */
    _addCondition(condition, index) {
        const child = new ProfileConditionUI(this, index);
        child.prepare(condition);
        this._children.push(child);
        this._conditionContainer.appendChild(child.node);
        return child;
    }
}

class ProfileConditionUI {
    /**
     * @param {ProfileConditionGroupUI} parent
     * @param {number} index
     */
    constructor(parent, index) {
        /** @type {ProfileConditionGroupUI} */
        this._parent = parent;
        /** @type {number} */
        this._index = index;
        /** @type {HTMLElement} */
        this._node = this._parent.parent.instantiateTemplate('profile-condition');
        /** @type {HTMLSelectElement} */
        this._typeInput = querySelectorNotNull(this._node, '.profile-condition-type');
        /** @type {HTMLSelectElement} */
        this._operatorInput = querySelectorNotNull(this._node, '.profile-condition-operator');
        /** @type {HTMLButtonElement} */
        this._mouseButton = querySelectorNotNull(this._node, '.mouse-button');
        /** @type {HTMLElement} */
        this._mouseButtonContainer = querySelectorNotNull(this._node, '.mouse-button-container');
        /** @type {HTMLButtonElement} */
        this._menuButton = querySelectorNotNull(this._node, '.profile-condition-menu-button');
        /** @type {HTMLElement} */
        this._typeOptionContainer = querySelectorNotNull(this._typeInput, 'optgroup');
        /** @type {HTMLElement} */
        this._operatorOptionContainer = querySelectorNotNull(this._operatorInput, 'optgroup');
        /** @type {HTMLInputElement} */
        this._valueInput = querySelectorNotNull(this._node, '.profile-condition-input');
        /** @type {string} */
        this._value = '';
        /** @type {?KeyboardMouseInputField} */
        this._kbmInputField = null;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {EventListenerCollection} */
        this._inputEventListeners = new EventListenerCollection();
    }

    /** @type {import('./settings-controller.js').SettingsController} */
    get settingsController() {
        return this._parent.parent.settingsController;
    }

    /** @type {ProfileConditionGroupUI} */
    get parent() {
        return this._parent;
    }

    /** @type {number} */
    get index() {
        return this._index;
    }

    set index(value) {
        this._index = value;
    }

    /** @type {HTMLElement} */
    get node() {
        return this._node;
    }

    /**
     * @param {import('settings').ProfileCondition} condition
     */
    prepare(condition) {
        const {type, operator, value} = condition;

        const operatorDetails = this._getOperatorDetails(type, operator);
        this._updateTypes(type);
        this._updateOperators(type, operator);
        this._updateValueInput(value, operatorDetails);

        this._eventListeners.addEventListener(this._typeInput, 'change', this._onTypeChange.bind(this), false);
        this._eventListeners.addEventListener(this._operatorInput, 'change', this._onOperatorChange.bind(this), false);
        this._eventListeners.addEventListener(this._menuButton, 'menuOpen', this._onMenuOpen.bind(this), false);
        this._eventListeners.addEventListener(this._menuButton, 'menuClose', this._onMenuClose.bind(this), false);
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();
        this._value = '';

        if (this._node === null) { return; }

        const node = this._node;
        if (node.parentNode !== null) {
            node.parentNode.removeChild(node);
        }
    }

    /**
     * @param {string} property
     * @returns {string}
     */
    getPath(property) {
        property = (typeof property === 'string' ? `.${property}` : '');
        return this._parent.getPath(`conditions[${this._index}]${property}`);
    }

    // Private

    /**
     * @param {Event} e
     */
    _onTypeChange(e) {
        const element = /** @type {HTMLSelectElement} */ (e.currentTarget);
        const type = ProfileConditionsUI.normalizeProfileConditionType(element.value);
        if (type === null) { return; }
        this._setType(type);
    }

    /**
     * @param {Event} e
     */
    _onOperatorChange(e) {
        const element = /** @type {HTMLSelectElement} */ (e.currentTarget);
        const type = ProfileConditionsUI.normalizeProfileConditionType(this._typeInput.value);
        if (type === null) { return; }
        const operator = element.value;
        this._setOperator(type, operator);
    }

    /**
     * @param {import('profile-conditions-ui').InputData} details
     * @param {Event} e
     */
    _onValueInputChange({validate, normalize}, e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        const value = node.value;
        const okay = this._validateValue(value, validate);
        this._value = value;
        if (okay) {
            const normalizedValue = this._normalizeValue(value, normalize);
            node.value = normalizedValue;
            this.settingsController.setGlobalSetting(this.getPath('value'), normalizedValue);
        }
    }

    /**
     * @param {import('profile-conditions-ui').InputData} details
     * @param {import('keyboard-mouse-input-field').EventArgument<'change'>} event
     */
    _onModifierInputChange({validate, normalize}, event) {
        const modifiers = this._joinModifiers(event.modifiers);
        const okay = this._validateValue(modifiers, validate);
        this._value = modifiers;
        if (okay) {
            const normalizedValue = this._normalizeValue(modifiers, normalize);
            this.settingsController.setGlobalSetting(this.getPath('value'), normalizedValue);
        }
    }

    /**
     * @param {import('popup-menu').MenuOpenEvent} e
     */
    _onMenuOpen(e) {
        const bodyNode = e.detail.menu.bodyNode;
        /** @type {HTMLElement} */
        const deleteGroup = /** @type {HTMLElement} */ (bodyNode.querySelector('.popup-menu-item[data-menu-action="deleteGroup"]'));
        if (deleteGroup !== null) {
            deleteGroup.hidden = (this._parent.childCount <= 1);
        }
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onMenuClose(e) {
        switch (e.detail.action) {
            case 'delete':
                this._removeSelf();
                break;
            case 'deleteGroup':
                this._parent.removeSelf();
                break;
            case 'resetValue':
                this._resetValue();
                break;
        }
    }

    /**
     * @returns {import('profile-conditions-ui').DescriptorInfo[]}
     */
    _getDescriptorTypes() {
        return this._parent.parent.getDescriptorTypes();
    }

    /**
     * @param {import('profile-conditions-ui').DescriptorType} type
     * @returns {import('profile-conditions-ui').OperatorInfo[]}
     */
    _getDescriptorOperators(type) {
        return this._parent.parent.getDescriptorOperators(type);
    }

    /**
     * @param {import('profile-conditions-ui').DescriptorType} type
     * @param {string} operator
     * @returns {import('profile-conditions-ui').Operator}
     */
    _getOperatorDetails(type, operator) {
        return this._parent.parent.getOperatorDetails(type, operator);
    }

    /**
     * @param {import('profile-conditions-ui').DescriptorType} type
     */
    _updateTypes(type) {
        const types = this._getDescriptorTypes();
        this._updateSelect(this._typeInput, this._typeOptionContainer, types, type);
    }

    /**
     * @param {import('profile-conditions-ui').DescriptorType} type
     * @param {string} operator
     */
    _updateOperators(type, operator) {
        const operators = this._getDescriptorOperators(type);
        this._updateSelect(this._operatorInput, this._operatorOptionContainer, operators, operator);
    }

    /**
     * @param {HTMLSelectElement} select
     * @param {HTMLElement} optionContainer
     * @param {import('profile-conditions-ui').DescriptorInfo[]|import('profile-conditions-ui').OperatorInfo[]} values
     * @param {string} value
     */
    _updateSelect(select, optionContainer, values, value) {
        optionContainer.textContent = '';
        for (const {name, displayName} of values) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = displayName;
            optionContainer.appendChild(option);
        }
        select.value = value;
    }

    /**
     * @param {string} value
     * @param {import('profile-conditions-ui').Operator} operator
     * @returns {boolean}
     */
    _updateValueInput(value, {type, validate, normalize}) {
        this._inputEventListeners.removeAllEventListeners();
        if (this._kbmInputField !== null) {
            this._kbmInputField.cleanup();
            this._kbmInputField = null;
        }

        let inputType = 'text';
        /** @type {?string} */
        let inputValue = value;
        let inputStep = null;
        let showMouseButton = false;
        /** @type {import('profile-conditions-ui').InputData} */
        const inputData = {validate, normalize};
        const node = this._valueInput;

        switch (type) {
            case 'integer':
                inputType = 'number';
                inputStep = '1';
                break;
            case 'modifierKeys':
            case 'modifierInputs':
                inputValue = null;
                showMouseButton = (type === 'modifierInputs');
                this._kbmInputField = this._parent.parent.createKeyboardMouseInputField(node, this._mouseButton);
                this._kbmInputField.prepare(null, this._splitModifiers(value), showMouseButton, false);
                break;
        }

        this._value = value;
        delete node.dataset.invalid;
        node.type = inputType;
        if (inputValue !== null) {
            node.value = inputValue;
        }
        if (typeof inputStep === 'string') {
            node.step = inputStep;
        } else {
            node.removeAttribute('step');
        }
        this._mouseButtonContainer.hidden = !showMouseButton;

        switch (type) {
            case 'modifierKeys':
            case 'modifierInputs':
                if (this._kbmInputField !== null) {
                    this._inputEventListeners.on(this._kbmInputField, 'change', this._onModifierInputChange.bind(this, inputData));
                }
                break;
            default: // 'integer', 'string'
                this._inputEventListeners.addEventListener(node, 'change', this._onValueInputChange.bind(this, inputData), false);
                break;
        }

        return this._validateValue(value, validate);
    }

    /**
     * @param {string} value
     * @param {?import('profile-conditions-ui').ValidateFunction} validate
     * @returns {boolean}
     */
    _validateValue(value, validate) {
        const okay = (validate === null || validate(value));
        this._valueInput.dataset.invalid = `${!okay}`;
        return okay;
    }

    /**
     * @param {string} value
     * @param {?import('profile-conditions-ui').NormalizeFunction} normalize
     * @returns {value}
     */
    _normalizeValue(value, normalize) {
        return (normalize !== null ? normalize(value) : value);
    }

    /** */
    _removeSelf() {
        this._parent.removeCondition(this);
    }

    /**
     * @param {string} modifiersString
     * @returns {import('input').Modifier[]}
     */
    _splitModifiers(modifiersString) {
        /** @type {import('input').Modifier[]} */
        const results = [];
        for (const item of modifiersString.split(/[,;\s]+/)) {
            const modifier = DocumentUtil.normalizeModifier(item.trim().toLowerCase());
            if (modifier !== null) { results.push(modifier); }
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

    /**
     * @param {import('profile-conditions-ui').DescriptorType} type
     * @param {string} [operator]
     */
    async _setType(type, operator) {
        const operators = this._getDescriptorOperators(type);
        if (typeof operator === 'undefined') {
            operator = operators.length > 0 ? operators[0].name : '';
        }
        const operatorDetails = this._getOperatorDetails(type, operator);
        const {defaultValue} = operatorDetails;
        this._updateSelect(this._operatorInput, this._operatorOptionContainer, operators, operator);
        this._updateValueInput(defaultValue, operatorDetails);
        await this.settingsController.modifyGlobalSettings([
            {action: 'set', path: this.getPath('type'), value: type},
            {action: 'set', path: this.getPath('operator'), value: operator},
            {action: 'set', path: this.getPath('value'), value: defaultValue}
        ]);
    }

    /**
     * @param {import('profile-conditions-ui').DescriptorType} type
     * @param {string} operator
     */
    async _setOperator(type, operator) {
        const operatorDetails = this._getOperatorDetails(type, operator);
        /** @type {import('settings-modifications').Modification[]} */
        const settingsModifications = [{action: 'set', path: this.getPath('operator'), value: operator}];
        if (operatorDetails.resetDefaultOnChange) {
            const {defaultValue} = operatorDetails;
            const okay = this._updateValueInput(defaultValue, operatorDetails);
            if (okay) {
                settingsModifications.push({action: 'set', path: this.getPath('value'), value: defaultValue});
            }
        }
        await this.settingsController.modifyGlobalSettings(settingsModifications);
    }

    /** */
    async _resetValue() {
        const type = ProfileConditionsUI.normalizeProfileConditionType(this._typeInput.value);
        if (type === null) { return; }
        const operator = this._operatorInput.value;
        await this._setType(type, operator);
    }
}

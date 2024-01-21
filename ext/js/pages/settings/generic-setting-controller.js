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

import {ExtensionError} from '../../core/extension-error.js';
import {parseJson} from '../../core/json.js';
import {DocumentUtil} from '../../dom/document-util.js';
import {DOMDataBinder} from '../../dom/dom-data-binder.js';

export class GenericSettingController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {import('settings-modifications').OptionsScopeType} */
        this._defaultScope = 'profile';
        /** @type {DOMDataBinder<import('generic-setting-controller').ElementMetadata>} */
        this._dataBinder = new DOMDataBinder({
            selector: '[data-setting]',
            createElementMetadata: this._createElementMetadata.bind(this),
            compareElementMetadata: this._compareElementMetadata.bind(this),
            getValues: this._getValues.bind(this),
            setValues: this._setValues.bind(this)
        });
        /** @type {Map<import('generic-setting-controller').TransformType, import('generic-setting-controller').TransformFunction>} */
        this._transforms = new Map(/** @type {[key: import('generic-setting-controller').TransformType, value: import('generic-setting-controller').TransformFunction][]} */ ([
            ['setAttribute', this._setAttribute.bind(this)],
            ['setVisibility', this._setVisibility.bind(this)],
            ['splitTags', this._splitTags.bind(this)],
            ['joinTags', this._joinTags.bind(this)],
            ['toNumber', this._toNumber.bind(this)],
            ['toBoolean', this._toBoolean.bind(this)],
            ['toString', this._toString.bind(this)],
            ['conditionalConvert', this._conditionalConvert.bind(this)]
        ]));
    }

    /** */
    async prepare() {
        this._dataBinder.observe(document.body);
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));
    }

    /** */
    async refresh() {
        await this._dataBinder.refresh();
    }

    // Private

    /** */
    _onOptionsChanged() {
        this._dataBinder.refresh();
    }

    /**
     * @param {Element} element
     * @returns {import('generic-setting-controller').ElementMetadata|undefined}
     */
    _createElementMetadata(element) {
        if (!(element instanceof HTMLElement)) { return void 0; }
        const {setting: path, scope, transform: transformRaw} = element.dataset;
        if (typeof path !== 'string') { return void 0; }
        const scope2 = this._normalizeScope(scope);
        return {
            path,
            scope: scope2 !== null ? scope2 : this._defaultScope,
            transforms: this._getTransformDataArray(transformRaw),
            transformRaw
        };
    }

    /**
     * @param {import('generic-setting-controller').ElementMetadata} metadata1
     * @param {import('generic-setting-controller').ElementMetadata} metadata2
     * @returns {boolean}
     */
    _compareElementMetadata(metadata1, metadata2) {
        return (
            metadata1.path === metadata2.path &&
            metadata1.scope === metadata2.scope &&
            metadata1.transformRaw === metadata2.transformRaw
        );
    }

    /**
     * @param {import('dom-data-binder').GetValuesDetails<import('generic-setting-controller').ElementMetadata>[]} targets
     * @returns {Promise<import('dom-data-binder').TaskResult[]>}
     */
    async _getValues(targets) {
        const defaultScope = this._defaultScope;
        /** @type {import('settings-modifications').ScopedRead[]} */
        const settingsTargets = [];
        for (const {metadata: {path, scope}} of targets) {
            /** @type {import('settings-modifications').ScopedRead} */
            const target = {
                path,
                scope: typeof scope === 'string' ? scope : defaultScope,
                optionsContext: null
            };
            settingsTargets.push(target);
        }
        return this._transformResults(await this._settingsController.getSettings(settingsTargets), targets);
    }

    /**
     * @param {import('dom-data-binder').SetValuesDetails<import('generic-setting-controller').ElementMetadata>[]} targets
     * @returns {Promise<import('dom-data-binder').TaskResult[]>}
     */
    async _setValues(targets) {
        const defaultScope = this._defaultScope;
        /** @type {import('settings-modifications').ScopedModification[]} */
        const settingsTargets = [];
        for (const {metadata: {path, scope, transforms}, value, element} of targets) {
            const transformedValue = this._applyTransforms(value, transforms, 'pre', element);
            /** @type {import('settings-modifications').ScopedModification} */
            const target = {
                path,
                scope: typeof scope === 'string' ? scope : defaultScope,
                action: 'set',
                value: transformedValue,
                optionsContext: null
            };
            settingsTargets.push(target);
        }
        return this._transformResults(await this._settingsController.modifySettings(settingsTargets), targets);
    }

    /**
     * @param {import('settings-controller').ModifyResult[]} values
     * @param {import('dom-data-binder').GetValuesDetails<import('generic-setting-controller').ElementMetadata>[]|import('dom-data-binder').SetValuesDetails<import('generic-setting-controller').ElementMetadata>[]} targets
     * @returns {import('dom-data-binder').TaskResult[]}
     */
    _transformResults(values, targets) {
        return values.map((value, i) => {
            const error = value.error;
            if (error) { return {error: ExtensionError.deserialize(error)}; }
            const {metadata: {transforms}, element} = targets[i];
            const result = this._applyTransforms(value.result, transforms, 'post', element);
            return {result};
        });
    }

    /**
     * @param {unknown} value
     * @param {import('generic-setting-controller').TransformData[]} transforms
     * @param {import('generic-setting-controller').TransformStep} step
     * @param {Element} element
     * @returns {unknown}
     */
    _applyTransforms(value, transforms, step, element) {
        for (const transform of transforms) {
            const transformStep = transform.step;
            if (typeof transformStep !== 'undefined' && transformStep !== step) { continue; }

            const transformFunction = this._transforms.get(transform.type);
            if (typeof transformFunction === 'undefined') { continue; }

            value = transformFunction(value, transform, element);
        }
        return value;
    }

    /**
     * @param {?Node} node
     * @param {number} ancestorDistance
     * @returns {?Node}
     */
    _getAncestor(node, ancestorDistance) {
        if (ancestorDistance < 0) {
            return document.documentElement;
        }
        for (let i = 0; i < ancestorDistance && node !== null; ++i) {
            node = node.parentNode;
        }
        return node;
    }

    /**
     * @param {?Node} node
     * @param {number|undefined} ancestorDistance
     * @param {string|undefined} selector
     * @returns {?Node}
     */
    _getRelativeElement(node, ancestorDistance, selector) {
        const selectorRoot = (
            typeof ancestorDistance === 'number' ?
            this._getAncestor(node, ancestorDistance) :
            document
        );
        if (selectorRoot === null) { return null; }

        return (
            typeof selector === 'string' && (selectorRoot instanceof Element || selectorRoot instanceof Document) ?
            selectorRoot.querySelector(selector) :
            (selectorRoot === document ? document.documentElement : selectorRoot)
        );
    }

    /**
     * @param {import('generic-setting-controller').OperationData} operationData
     * @param {unknown} lhs
     * @returns {unknown}
     */
    _evaluateSimpleOperation(operationData, lhs) {
        const {op: operation, value: rhs} = operationData;
        switch (operation) {
            case '!': return !lhs;
            case '!!': return !!lhs;
            case '===': return lhs === rhs;
            case '!==': return lhs !== rhs;
            case '>=': return /** @type {number} */ (lhs) >= /** @type {number} */ (rhs);
            case '<=': return /** @type {number} */ (lhs) <= /** @type {number} */ (rhs);
            case '>': return /** @type {number} */ (lhs) > /** @type {number} */ (rhs);
            case '<': return /** @type {number} */ (lhs) < /** @type {number} */ (rhs);
            case '&&':
                for (const operationData2 of /** @type {import('generic-setting-controller').OperationData[]} */ (rhs)) {
                    const result = this._evaluateSimpleOperation(operationData2, lhs);
                    if (!result) { return result; }
                }
                return true;
            case '||':
                for (const operationData2 of /** @type {import('generic-setting-controller').OperationData[]} */ (rhs)) {
                    const result = this._evaluateSimpleOperation(operationData2, lhs);
                    if (result) { return result; }
                }
                return false;
            default:
                return false;
        }
    }

    /**
     * @param {string|undefined} value
     * @returns {?import('settings-modifications').OptionsScopeType}
     */
    _normalizeScope(value) {
        switch (value) {
            case 'profile':
            case 'global':
                return value;
            default:
                return null;
        }
    }

    /**
     * @param {string|undefined} transformRaw
     * @returns {import('generic-setting-controller').TransformData[]}
     */
    _getTransformDataArray(transformRaw) {
        if (typeof transformRaw === 'string') {
            const transforms = parseJson(transformRaw);
            return Array.isArray(transforms) ? transforms : [transforms];
        }
        return [];
    }

    // Transforms

    /**
     * @param {unknown} value
     * @param {import('generic-setting-controller').SetAttributeTransformData} data
     * @param {Element} element
     * @returns {unknown}
     */
    _setAttribute(value, data, element) {
        const {ancestorDistance, selector, attribute} = data;
        const relativeElement = this._getRelativeElement(element, ancestorDistance, selector);
        if (relativeElement !== null && relativeElement instanceof Element) {
            relativeElement.setAttribute(attribute, `${value}`);
        }
        return value;
    }

    /**
     * @param {unknown} value
     * @param {import('generic-setting-controller').SetVisibilityTransformData} data
     * @param {Element} element
     * @returns {unknown}
     */
    _setVisibility(value, data, element) {
        const {ancestorDistance, selector, condition} = data;
        const relativeElement = this._getRelativeElement(element, ancestorDistance, selector);
        if (relativeElement !== null && relativeElement instanceof HTMLElement) {
            relativeElement.hidden = !this._evaluateSimpleOperation(condition, value);
        }
        return value;
    }

    /**
     * @param {unknown} value
     * @returns {string[]}
     */
    _splitTags(value) {
        return `${value}`.split(/[,; ]+/).filter((v) => !!v);
    }

    /**
     * @param {unknown} value
     * @returns {string}
     */
    _joinTags(value) {
        return Array.isArray(value) ? value.join(' ') : '';
    }

    /**
     * @param {unknown} value
     * @param {import('generic-setting-controller').ToNumberConstraintsTransformData} data
     * @returns {number}
     */
    _toNumber(value, data) {
        /** @type {import('document-util').ToNumberConstraints} */
        const constraints = typeof data.constraints === 'object' && data.constraints !== null ? data.constraints : {};
        return typeof value === 'string' ? DocumentUtil.convertElementValueToNumber(value, constraints) : 0;
    }

    /**
     * @param {string} value
     * @returns {boolean}
     */
    _toBoolean(value) {
        return (value === 'true');
    }

    /**
     * @param {unknown} value
     * @returns {string}
     */
    _toString(value) {
        return `${value}`;
    }

    /**
     * @param {unknown} value
     * @param {import('generic-setting-controller').ConditionalConvertTransformData} data
     * @returns {unknown}
     */
    _conditionalConvert(value, data) {
        const {cases} = data;
        if (Array.isArray(cases)) {
            for (const caseData of cases) {
                if (caseData.default === true) {
                    value = caseData.result;
                } else if (this._evaluateSimpleOperation(caseData, value)) {
                    value = caseData.result;
                    break;
                }
            }
        }
        return value;
    }
}

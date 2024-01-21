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

import {TaskAccumulator} from '../general/task-accumulator.js';
import {DocumentUtil} from './document-util.js';
import {SelectorObserver} from './selector-observer.js';

/**
 * @template [T=unknown]
 */
export class DOMDataBinder {
    /**
     * @param {import('dom-data-binder').ConstructorDetails<T>} details
     */
    constructor({selector, createElementMetadata, compareElementMetadata, getValues, setValues, onError = null}) {
        /** @type {string} */
        this._selector = selector;
        /** @type {import('dom-data-binder').CreateElementMetadataCallback<T>} */
        this._createElementMetadata = createElementMetadata;
        /** @type {import('dom-data-binder').CompareElementMetadataCallback<T>} */
        this._compareElementMetadata = compareElementMetadata;
        /** @type {import('dom-data-binder').GetValuesCallback<T>} */
        this._getValues = getValues;
        /** @type {import('dom-data-binder').SetValuesCallback<T>} */
        this._setValues = setValues;
        /** @type {?import('dom-data-binder').OnErrorCallback<T>} */
        this._onError = onError;
        /** @type {TaskAccumulator<import('dom-data-binder').ElementObserver<T>, import('dom-data-binder').UpdateTaskValue>} */
        this._updateTasks = new TaskAccumulator(this._onBulkUpdate.bind(this));
        /** @type {TaskAccumulator<import('dom-data-binder').ElementObserver<T>, import('dom-data-binder').AssignTaskValue>} */
        this._assignTasks = new TaskAccumulator(this._onBulkAssign.bind(this));
        /** @type {SelectorObserver<import('dom-data-binder').ElementObserver<T>>} */
        this._selectorObserver = /** @type {SelectorObserver<import('dom-data-binder').ElementObserver<T>>} */ (new SelectorObserver({
            selector,
            ignoreSelector: null,
            onAdded: this._createObserver.bind(this),
            onRemoved: this._removeObserver.bind(this),
            onChildrenUpdated: this._onObserverChildrenUpdated.bind(this),
            isStale: this._isObserverStale.bind(this)
        }));
    }

    /**
     * @param {Element} element
     */
    observe(element) {
        this._selectorObserver.observe(element, true);
    }

    /** */
    disconnect() {
        this._selectorObserver.disconnect();
    }

    /** */
    async refresh() {
        await this._updateTasks.enqueue(null, {all: true});
    }

    // Private

    /**
     * @param {import('dom-data-binder').UpdateTask<T>[]} tasks
     */
    async _onBulkUpdate(tasks) {
        let all = false;
        /** @type {import('dom-data-binder').ApplyTarget<T>[]} */
        const targets = [];
        for (const [observer, task] of tasks) {
            if (observer === null) {
                if (task.data.all) {
                    all = true;
                    break;
                }
            } else {
                targets.push([observer, task]);
            }
        }
        if (all) {
            targets.length = 0;
            for (const observer of this._selectorObserver.datas()) {
                targets.push([observer, null]);
            }
        }

        const args = targets.map(([observer]) => ({
            element: observer.element,
            metadata: observer.metadata
        }));
        const responses = await this._getValues(args);
        this._applyValues(targets, responses, true);
    }

    /**
     * @param {import('dom-data-binder').AssignTask<T>[]} tasks
     */
    async _onBulkAssign(tasks) {
        /** @type {import('dom-data-binder').ApplyTarget<T>[]} */
        const targets = [];
        const args = [];
        for (const [observer, task] of tasks) {
            if (observer === null) { continue; }
            args.push({
                element: observer.element,
                metadata: observer.metadata,
                value: task.data.value
            });
            targets.push([observer, task]);
        }
        const responses = await this._setValues(args);
        this._applyValues(targets, responses, false);
    }

    /**
     * @param {import('dom-data-binder').ElementObserver<T>} observer
     */
    _onElementChange(observer) {
        const value = this._getElementValue(observer.element);
        observer.value = value;
        observer.hasValue = true;
        this._assignTasks.enqueue(observer, {value});
    }

    /**
     * @param {import('dom-data-binder').ApplyTarget<T>[]} targets
     * @param {import('dom-data-binder').TaskResult[]} response
     * @param {boolean} ignoreStale
     */
    _applyValues(targets, response, ignoreStale) {
        for (let i = 0, ii = targets.length; i < ii; ++i) {
            const [observer, task] = targets[i];
            const {error, result} = response[i];
            const stale = (task !== null && task.stale);

            if (error) {
                if (typeof this._onError === 'function') {
                    this._onError(error, stale, observer.element, observer.metadata);
                }
                continue;
            }

            if (stale && !ignoreStale) { continue; }

            observer.value = result;
            observer.hasValue = true;
            this._setElementValue(observer.element, result);
        }
    }

    /**
     * @param {Element} element
     * @returns {import('dom-data-binder').ElementObserver<T>|undefined}
     */
    _createObserver(element) {
        const metadata = this._createElementMetadata(element);
        if (typeof metadata === 'undefined') { return void 0; }
        /** @type {import('dom-data-binder').ElementObserver<T>} */
        const observer = {
            element,
            type: this._getNormalizedElementType(element),
            value: null,
            hasValue: false,
            onChange: null,
            metadata
        };
        observer.onChange = this._onElementChange.bind(this, observer);

        element.addEventListener('change', observer.onChange, false);

        this._updateTasks.enqueue(observer, {all: false});

        return observer;
    }

    /**
     * @param {Element} element
     * @param {import('dom-data-binder').ElementObserver<T>} observer
     */
    _removeObserver(element, observer) {
        if (observer.onChange === null) { return; }
        element.removeEventListener('change', observer.onChange, false);
        observer.onChange = null;
    }

    /**
     * @param {Element} element
     * @param {import('dom-data-binder').ElementObserver<T>} observer
     */
    _onObserverChildrenUpdated(element, observer) {
        if (observer.hasValue) {
            this._setElementValue(element, observer.value);
        }
    }

    /**
     * @param {Element} element
     * @param {import('dom-data-binder').ElementObserver<T>} observer
     * @returns {boolean}
     */
    _isObserverStale(element, observer) {
        const {type, metadata} = observer;
        if (type !== this._getNormalizedElementType(element)) { return false; }
        const newMetadata = this._createElementMetadata(element);
        return typeof newMetadata === 'undefined' || !this._compareElementMetadata(metadata, newMetadata);
    }

    /**
     * @param {Element} element
     * @param {unknown} value
     */
    _setElementValue(element, value) {
        switch (this._getNormalizedElementType(element)) {
            case 'checkbox':
                /** @type {HTMLInputElement} */ (element).checked = typeof value === 'boolean' && value;
                break;
            case 'text':
            case 'number':
            case 'textarea':
            case 'select':
                /** @type {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} */ (element).value = typeof value === 'string' ? value : `${value}`;
                break;
        }

        /** @type {number|string|boolean} */
        let safeValue;
        switch (typeof value) {
            case 'number':
            case 'string':
            case 'boolean':
                safeValue = value;
                break;
            default:
                safeValue = `${value}`;
                break;
        }
        /** @type {import('dom-data-binder').SettingChangedEvent} */
        const event = new CustomEvent('settingChanged', {detail: {value: safeValue}});
        element.dispatchEvent(event);
    }

    /**
     * @param {Element} element
     * @returns {boolean|string|number|null}
     */
    _getElementValue(element) {
        switch (this._getNormalizedElementType(element)) {
            case 'checkbox':
                return !!(/** @type {HTMLInputElement} */ (element).checked);
            case 'text':
                return `${/** @type {HTMLInputElement} */ (element).value}`;
            case 'number':
                return DocumentUtil.convertElementValueToNumber(/** @type {HTMLInputElement} */ (element).value, /** @type {HTMLInputElement} */ (element));
            case 'textarea':
                return /** @type {HTMLTextAreaElement} */ (element).value;
            case 'select':
                return /** @type {HTMLSelectElement} */ (element).value;
        }
        return null;
    }

    /**
     * @param {Element} element
     * @returns {import('dom-data-binder').NormalizedElementType}
     */
    _getNormalizedElementType(element) {
        switch (element.nodeName.toUpperCase()) {
            case 'INPUT':
            {
                const {type} = /** @type {HTMLInputElement} */ (element);
                switch (type) {
                    case 'text':
                    case 'password':
                        return 'text';
                    case 'number':
                    case 'checkbox':
                        return type;
                }
                break;
            }
            case 'TEXTAREA':
                return 'textarea';
            case 'SELECT':
                return 'select';
        }
        return null;
    }
}

/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2016-2022  Yomichan Authors
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

import {Handlebars} from '../../../lib/handlebars.js';
import {ExtensionError} from '../../core/extension-error.js';

export class TemplateRenderer {
    constructor() {
        /** @type {Map<string, import('handlebars').TemplateDelegate<import('anki-templates').NoteData>>} */
        this._cache = new Map();
        /** @type {number} */
        this._cacheMaxSize = 5;
        /** @type {Map<import('anki-templates').RenderMode, import('template-renderer').DataType>} */
        this._dataTypes = new Map();
        /** @type {?((noteData: import('anki-templates').NoteData) => import('template-renderer').SetupCallbackResult)} */
        this._renderSetup = null;
        /** @type {?((noteData: import('anki-templates').NoteData) => import('template-renderer').CleanupCallbackResult)} */
        this._renderCleanup = null;
    }

    /**
     * @param {import('template-renderer').HelperFunctionsDescriptor} helpers
     */
    registerHelpers(helpers) {
        for (const [name, helper] of helpers) {
            this._registerHelper(name, helper);
        }
    }

    /**
     * @param {import('anki-templates').RenderMode} name
     * @param {import('template-renderer').DataType} details
     */
    registerDataType(name, {modifier, composeData}) {
        this._dataTypes.set(name, {modifier, composeData});
    }

    /**
     * @param {?((noteData: import('anki-templates').NoteData) => import('template-renderer').SetupCallbackResult)} setup
     * @param {?((noteData: import('anki-templates').NoteData) => import('template-renderer').CleanupCallbackResult)} cleanup
     */
    setRenderCallbacks(setup, cleanup) {
        this._renderSetup = setup;
        this._renderCleanup = cleanup;
    }

    /**
     * @param {string} template
     * @param {import('template-renderer').PartialOrCompositeRenderData} data
     * @param {import('anki-templates').RenderMode} type
     * @returns {import('template-renderer').RenderResult}
     */
    render(template, data, type) {
        const instance = this._getTemplateInstance(template);
        const modifiedData = this._getModifiedData(data, void 0, type);
        return this._renderTemplate(instance, modifiedData);
    }

    /**
     * @param {import('template-renderer').RenderMultiItem[]} items
     * @returns {import('core').Response<import('template-renderer').RenderResult>[]}
     */
    renderMulti(items) {
        /** @type {import('core').Response<import('template-renderer').RenderResult>[]} */
        const results = [];
        for (const {template, templateItems} of items) {
            const instance = this._getTemplateInstance(template);
            for (const {type, commonData, datas} of templateItems) {
                for (const data of datas) {
                    let result;
                    try {
                        const data2 = this._getModifiedData(data, commonData, type);
                        const renderResult = this._renderTemplate(instance, data2);
                        result = {result: renderResult};
                    } catch (error) {
                        result = {error: ExtensionError.serialize(error)};
                    }
                    results.push(result);
                }
            }
        }
        return results;
    }

    /**
     * @param {import('template-renderer').CompositeRenderData} data
     * @param {import('anki-templates').RenderMode} type
     * @returns {import('anki-templates').NoteData}
     */
    getModifiedData(data, type) {
        return this._getModifiedData(data, void 0, type);
    }

    // Private

    /**
     * @param {string} template
     * @returns {import('handlebars').TemplateDelegate<import('anki-templates').NoteData>}
     */
    _getTemplateInstance(template) {
        const cache = this._cache;
        let instance = cache.get(template);
        if (typeof instance === 'undefined') {
            this._updateCacheSize(this._cacheMaxSize - 1);
            instance = /** @type {import('handlebars').TemplateDelegate<import('anki-templates').NoteData>} */ (Handlebars.compileAST(template));
            cache.set(template, instance);
        }

        return instance;
    }

    /**
     * @param {import('handlebars').TemplateDelegate<import('anki-templates').NoteData>} instance
     * @param {import('anki-templates').NoteData} data
     * @returns {import('template-renderer').RenderResult}
     */
    _renderTemplate(instance, data) {
        const renderSetup = this._renderSetup;
        const renderCleanup = this._renderCleanup;
        /** @type {string} */
        let result;
        /** @type {?import('template-renderer').SetupCallbackResult} */
        let additions1;
        /** @type {?import('template-renderer').CleanupCallbackResult} */
        let additions2;
        try {
            additions1 = (typeof renderSetup === 'function' ? renderSetup(data) : null);
            result = instance(data).trim();
        } finally {
            additions2 = (typeof renderCleanup === 'function' ? renderCleanup(data) : null);
        }
        return /** @type {import('template-renderer').RenderResult} */ (Object.assign({result}, additions1, additions2));
    }

    /**
     * @param {import('template-renderer').PartialOrCompositeRenderData} data
     * @param {import('anki-note-builder').CommonData|undefined} commonData
     * @param {import('anki-templates').RenderMode} type
     * @returns {import('anki-templates').NoteData}
     * @throws {Error}
     */
    _getModifiedData(data, commonData, type) {
        if (typeof type === 'string') {
            const typeInfo = this._dataTypes.get(type);
            if (typeof typeInfo !== 'undefined') {
                if (typeof commonData !== 'undefined') {
                    const {composeData} = typeInfo;
                    data = composeData(data, commonData);
                } else if (typeof data.commonData === 'undefined') {
                    throw new Error('Incomplete data');
                }
                const {modifier} = typeInfo;
                return modifier(/** @type {import('template-renderer').CompositeRenderData} */ (data));
            }
        }
        throw new Error(`Invalid type: ${type}`);
    }

    /**
     * @param {number} maxSize
     */
    _updateCacheSize(maxSize) {
        const cache = this._cache;
        let removeCount = cache.size - maxSize;
        if (removeCount <= 0) { return; }

        for (const key of cache.keys()) {
            cache.delete(key);
            if (--removeCount <= 0) { break; }
        }
    }

    /**
     * @param {string} name
     * @param {import('template-renderer').HelperFunction} helper
     */
    _registerHelper(name, helper) {
        /**
         * @this {unknown}
         * @param {unknown[]} args
         * @returns {unknown}
         */
        function wrapper(...args) {
            const argCountM1 = Math.max(0, args.length - 1);
            const options = /** @type {import('handlebars').HelperOptions} */ (args[argCountM1]);
            args.length = argCountM1;
            return helper(args, this, options);
        }
        Handlebars.registerHelper(name, wrapper);
    }
}

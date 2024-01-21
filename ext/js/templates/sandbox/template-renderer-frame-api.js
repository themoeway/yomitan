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

import {createApiMap, invokeApiMapHandler} from '../../core/api-map.js';
import {parseJson} from '../../core/json.js';

export class TemplateRendererFrameApi {
    /**
     * @param {import('./template-renderer.js').TemplateRenderer} templateRenderer
     */
    constructor(templateRenderer) {
        /** @type {import('./template-renderer.js').TemplateRenderer} */
        this._templateRenderer = templateRenderer;
        /** @type {import('template-renderer-proxy').FrontendApiMap} */
        this._windowMessageHandlers = createApiMap([
            ['render', this._onRender.bind(this)],
            ['renderMulti', this._onRenderMulti.bind(this)],
            ['getModifiedData', this._onGetModifiedData.bind(this)]
        ]);
    }

    /**
     * @returns {void}
     */
    prepare() {
        window.addEventListener('message', this._onWindowMessage.bind(this), false);
        this._postMessage(window.parent, 'ready', void 0, null);
    }

    // Private

    /**
     * @param {MessageEvent<import('template-renderer-proxy').FrontendMessageAny>} e
     */
    _onWindowMessage(e) {
        const {source, data: {action, params, id}} = e;
        invokeApiMapHandler(this._windowMessageHandlers, action, params, [], (response) => {
            this._postMessage(/** @type {Window} */ (source), 'response', response, id);
        });
    }

    /**
     * @param {{template: string, data: import('template-renderer').PartialOrCompositeRenderData, type: import('anki-templates').RenderMode}} event
     * @returns {import('template-renderer').RenderResult}
     */
    _onRender({template, data, type}) {
        return this._templateRenderer.render(template, data, type);
    }

    /**
     * @param {{items: import('template-renderer').RenderMultiItem[]}} event
     * @returns {import('core').Response<import('template-renderer').RenderResult>[]}
     */
    _onRenderMulti({items}) {
        return this._templateRenderer.renderMulti(items);
    }

    /**
     * @param {{data: import('template-renderer').CompositeRenderData, type: import('anki-templates').RenderMode}} event
     * @returns {import('anki-templates').NoteData}
     */
    _onGetModifiedData({data, type}) {
        const result = this._templateRenderer.getModifiedData(data, type);
        return this._clone(result);
    }

    /**
     * @template [T=unknown]
     * @param {T} value
     * @returns {T}
     */
    _clone(value) {
        return parseJson(JSON.stringify(value));
    }

    /**
     * @template {import('template-renderer-proxy').BackendApiNames} TName
     * @param {Window} target
     * @param {TName} action
     * @param {import('template-renderer-proxy').BackendApiParams<TName>} params
     * @param {?string} id
     */
    _postMessage(target, action, params, id) {
        /** @type {import('template-renderer-proxy').BackendMessageAny} */
        const data = {action, params, id};
        target.postMessage(data, '*');
    }
}

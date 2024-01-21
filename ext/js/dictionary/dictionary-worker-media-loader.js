/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2021-2022  Yomichan Authors
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

import {generateId} from '../core/utilities.js';
import {ExtensionError} from '../core/extension-error.js';

/**
 * Class used for loading and validating media from a worker thread
 * during the dictionary import process.
 */
export class DictionaryWorkerMediaLoader {
    /**
     * Creates a new instance of the media loader.
     */
    constructor() {
        /** @type {Map<string, {resolve: (result: import('dictionary-worker-media-loader').ImageDetails) => void, reject: (reason?: import('core').RejectionReason) => void}>} */
        this._requests = new Map();
    }

    /**
     * Handles a response message posted to the worker thread.
     * @param {import('dictionary-worker-media-loader').HandleMessageParams} params Details of the response.
     */
    handleMessage(params) {
        const {id} = params;
        const request = this._requests.get(id);
        if (typeof request === 'undefined') { return; }
        this._requests.delete(id);
        const {error} = params;
        if (typeof error !== 'undefined') {
            request.reject(ExtensionError.deserialize(error));
        } else {
            request.resolve(params.result);
        }
    }

    /** @type {import('dictionary-importer-media-loader').GetImageDetailsFunction} */
    getImageDetails(content, mediaType) {
        return new Promise((resolve, reject) => {
            const id = generateId(16);
            this._requests.set(id, {resolve, reject});
            // This is executed in a Worker context, so the self needs to be force cast
            /** @type {Worker} */ (/** @type {unknown} */ (self)).postMessage({
                action: 'getImageDetails',
                params: {id, content, mediaType}
            }, [content]);
        });
    }
}

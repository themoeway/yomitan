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

import {EventListenerCollection} from '../core/event-listener-collection.js';

/**
 * Class used for loading and validating media during the dictionary import process.
 */
export class DictionaryImporterMediaLoader {
    /** @type {import('dictionary-importer-media-loader').GetImageDetailsFunction} */
    getImageDetails(content, mediaType, transfer) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            const eventListeners = new EventListenerCollection();
            const cleanup = () => {
                image.removeAttribute('src');
                URL.revokeObjectURL(url);
                eventListeners.removeAllEventListeners();
            };
            eventListeners.addEventListener(image, 'load', () => {
                const {naturalWidth: width, naturalHeight: height} = image;
                if (Array.isArray(transfer)) { transfer.push(content); }
                cleanup();
                resolve({content, width, height});
            }, false);
            eventListeners.addEventListener(image, 'error', () => {
                cleanup();
                reject(new Error('Image failed to load'));
            }, false);
            const blob = new Blob([content], {type: mediaType});
            const url = URL.createObjectURL(blob);
            image.src = url;
        });
    }
}

/*
 * Copyright (C) 2023-2024  Yomitan Authors
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

import {ExtensionError} from './extension-error.js';

/**
 * @template {import('api-map').ApiSurface} [TApiSurface=never]
 * @template {unknown[]} [TExtraParams=[]]
 * @param {import('api-map').ApiMapInit<TApiSurface, TExtraParams>} init
 * @returns {import('api-map').ApiMap<TApiSurface, TExtraParams>}
 */
export function createApiMap(init) {
    return new Map(init);
}

/**
 * @template {import('api-map').ApiSurface} [TApiSurface=never]
 * @template {unknown[]} [TExtraParams=[]]
 * @param {import('api-map').ApiMap<TApiSurface, TExtraParams>} map
 * @param {import('api-map').ApiMapInit<TApiSurface, TExtraParams>} init
 * @throws {Error}
 */
export function extendApiMap(map, init) {
    for (const [key, value] of init) {
        if (map.has(key)) { throw new Error(`The handler for ${String(key)} has already been registered`); }
        map.set(key, value);
    }
}

/**
 * @template {import('api-map').ApiSurface} [TApiSurface=never]
 * @template {unknown[]} [TExtraParams=[]]
 * @param {import('api-map').ApiMap<TApiSurface, TExtraParams>} map
 * @param {string} name
 * @returns {import('api-map').ApiHandlerAny<TApiSurface, TExtraParams>|undefined}
 */
export function getApiMapHandler(map, name) {
    return map.get(/** @type {import('api-map').ApiNames<TApiSurface>} */ (name));
}

/**
 * @template {import('api-map').ApiSurface} [TApiSurface=never]
 * @template {unknown[]} [TExtraParams=[]]
 * @param {import('api-map').ApiMap<TApiSurface, TExtraParams>} map
 * @param {string} name
 * @param {import('api-map').ApiParamsAny<TApiSurface>} params
 * @param {TExtraParams} extraParams
 * @param {(response: import('core').Response<import('api-map').ApiReturnAny<TApiSurface>>) => void} callback
 * @param {() => void} [handlerNotFoundCallback]
 * @returns {boolean} `true` if async, `false` otherwise.
 */
export function invokeApiMapHandler(map, name, params, extraParams, callback, handlerNotFoundCallback) {
    const handler = getApiMapHandler(map, name);
    if (typeof handler === 'undefined') {
        if (typeof handlerNotFoundCallback === 'function') {
            try {
                handlerNotFoundCallback();
            } catch (error) {
                // NOP
            }
        }
        return false;
    }
    try {
        const promiseOrResult = handler(/** @type {import('core').SafeAny} */ (params), ...extraParams);
        if (promiseOrResult instanceof Promise) {
            /** @type {Promise<unknown>} */ (promiseOrResult).then(
                (result) => { callback({result}); },
                (error) => { callback({error: ExtensionError.serialize(error)}); }
            );
            return true;
        } else {
            callback({result: promiseOrResult});
            return false;
        }
    } catch (error) {
        callback({error: ExtensionError.serialize(error)});
        return false;
    }
}

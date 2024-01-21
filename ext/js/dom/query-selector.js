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

import {ExtensionError} from '../core/extension-error.js';

/**
 * @param {Element|Document|DocumentFragment} element
 * @param {string} selector
 * @returns {ExtensionError}
 */
function createError(element, selector) {
    const error = new ExtensionError(`Performing querySelectorNotNull(element, ${JSON.stringify(selector)}) returned null`);
    error.data = {element, selector};
    return error;
}

/**
 * @template {Element} T
 * @param {Element|Document|DocumentFragment} element
 * @param {string} selector
 * @returns {T}
 * @throws {Error}
 */
export function querySelectorNotNull(element, selector) {
    /** @type {?T} */
    const result = element.querySelector(selector);
    if (result === null) { throw createError(element, selector); }
    return result;
}

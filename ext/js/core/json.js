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

/**
 * This function is used to ensure more safe usage of `JSON.parse`.
 * By default, `JSON.parse` returns a value with type `any`, which is easy to misuse.
 * By changing the default to `unknown` and allowing it to be templatized,
 * this improves how the return type is used.
 * @template [T=unknown]
 * @param {string} value
 * @returns {T}
 */
export function parseJson(value) {
    // eslint-disable-next-line no-restricted-syntax
    return JSON.parse(value);
}

/**
 * This function is used to ensure more safe usage of `Response.json`,
 * which returns the `any` type.
 * @template [T=unknown]
 * @param {Response} response
 * @returns {Promise<T>}
 */
export async function readResponseJson(response) {
    // eslint-disable-next-line no-restricted-syntax
    return await response.json();
}

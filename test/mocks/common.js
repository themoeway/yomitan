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

import {readFileSync} from 'fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join, resolve} from 'path';
import {parseJson} from '../../dev/json.js';

const extDir = join(dirname(fileURLToPath(import.meta.url)), '../../ext');

/** @type {import('test/mocks').ChromeMock} */
export const chrome = {
    runtime: {
        getURL: (path) => {
            return pathToFileURL(join(extDir, path.replace(/^\//, ''))).href;
        }
    }
};

/** @type {import('test/mocks').FetchMock} */
export async function fetch(url) {
    let filePath;
    try {
        filePath = fileURLToPath(url);
    } catch (e) {
        filePath = resolve(extDir, url.replace(/^[/\\]/, ''));
    }
    await Promise.resolve();
    const content = readFileSync(filePath, {encoding: null});
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => content.toString('utf8'),
        json: async () => parseJson(content.toString('utf8'))
    };
}

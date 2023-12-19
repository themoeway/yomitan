/*
 * Copyright (C) 2023  Yomitan Authors
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

import type {Schema} from 'ajv';

export type JsonInfo = {
    files: JsonFileInfo[];
};

export type JsonFileInfo = JsonFileIgnoreInfo | JsonFileParseInfo | JsonFileParseInfoNull;

export type JsonFileIgnoreInfo = {
    path: string;
    ignore: true;
};

// TODO : Remove this
export type JsonFileParseInfoNull = {
    path: string;
    ignore?: undefined;
    typeFile: null;
    type: null;
};

export type JsonFileParseInfo = {
    path: string;
    ignore?: undefined;
    typeFile: string;
    type: string;
    schema?: string;
};

export type AjvSchema = Schema;

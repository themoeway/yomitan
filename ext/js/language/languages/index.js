/*
 * Copyright (C) 2024  Yomitan Authors
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

// English
import {textTransformations as textTransformationsEN} from './en/textTransformations.js';
import {textTransformations as textTransformationsJA} from './ja/textTransformations.js';
import {textTransformations as textTransformationsPT} from './pt/textTransformations.js';
/** @type {Map<string, import('language').LanguageFeatures>} */
export const languageParts = new Map([
    ['ja', {
        textTransformations: textTransformationsJA
    }],
    ['en', {
        textTransformations: textTransformationsEN
    }],
    ['pt', {
        textTransformations: textTransformationsPT
    }]
]);



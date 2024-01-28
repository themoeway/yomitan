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

/** @type {import('language').TextTransformationOption<boolean>[]} */
export const basicTextTransformationOptions = [
    ['false', 'Disabled', [false]],
    ['true', 'Enabled', [true]],
    ['variant', 'Use both variants', [false, true]]
];

/** @type {import('language').TextTransformation} */
export const decapitalize = {
    id: 'decapitalize',
    name: 'Decapitalize text',
    description: 'CAPITALIZED TEXT → capitalized text',
    options: basicTextTransformationOptions,
    transform: (str, setting) => setting ? str.toLowerCase() : str
};

/** @type {import('language').TextTransformation} */
export const capitalizeFirstLetter = {
    id: 'capitalizeFirstLetter',
    name: 'Capitalize first letter',
    description: 'lowercase text → Lowercase text',
    options: basicTextTransformationOptions,
    transform: (str, setting) => setting ? str.charAt(0).toUpperCase() + str.slice(1) : str
};


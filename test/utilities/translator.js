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


/**
 * TODO : This function is not very type safe at the moment, could be improved.
 * @template {import('translation').FindTermsOptions|import('translation').FindKanjiOptions} T
 * @param {string} dictionaryName
 * @param {import('test/translator').OptionsPresetObject} optionsPresets
 * @param {import('test/translator').OptionsList} optionsArray
 * @returns {T}
 * @throws {Error}
 */
export function createFindOptions(dictionaryName, optionsPresets, optionsArray) {
    /** @type {import('core').UnknownObject} */
    const options = {};
    if (!Array.isArray(optionsArray)) { optionsArray = [optionsArray]; }
    for (const entry of optionsArray) {
        switch (typeof entry) {
            case 'string':
                if (!Object.prototype.hasOwnProperty.call(optionsPresets, entry)) {
                    throw new Error('Invalid options preset');
                }
                Object.assign(options, structuredClone(optionsPresets[entry]));
                break;
            case 'object':
                Object.assign(options, structuredClone(entry));
                break;
            default:
                throw new Error('Invalid options type');
        }
    }

    // Construct regex
    if (Array.isArray(options.textReplacements)) {
        options.textReplacements = options.textReplacements.map((value) => {
            if (Array.isArray(value)) {
                value = value.map(({pattern, flags, replacement}) => ({pattern: new RegExp(pattern, flags), replacement}));
            }
            return value;
        });
    }

    // Update structure
    const placeholder = '${title}';
    if (options.mainDictionary === placeholder) {
        options.mainDictionary = dictionaryName;
    }
    let {enabledDictionaryMap} = options;
    if (Array.isArray(enabledDictionaryMap)) {
        for (const entry of enabledDictionaryMap) {
            if (entry[0] === placeholder) {
                entry[0] = dictionaryName;
            }
        }
        enabledDictionaryMap = new Map(enabledDictionaryMap);
        options.enabledDictionaryMap = enabledDictionaryMap;
    }
    const {excludeDictionaryDefinitions} = options;
    options.excludeDictionaryDefinitions = (
        Array.isArray(excludeDictionaryDefinitions) ?
        new Set(excludeDictionaryDefinitions) :
        null
    );

    return /** @type {T} */ (options);
}

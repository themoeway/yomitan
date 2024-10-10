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

import {basicTextProcessorOptions} from '../text-processors.js';
import {convertAlphabeticToKana} from './japanese-wanakana.js';
import {
    collapseEmphaticSequences as collapseEmphaticSequencesFunction,
    convertAlphanumericToFullWidth,
    convertFullWidthAlphanumericToNormal,
    convertHalfWidthKanaToFullWidth,
    convertHiraganaToKatakana as convertHiraganaToKatakanaFunction,
    convertKatakanaToHiragana as convertKatakanaToHiraganaFunction,
    normalizeCombiningCharacters as normalizeCombiningCharactersFunction,
} from './japanese.js';
import {convertShinjitai as convertShinjitaiFunction} from './shinjitai-converter.js';

/** @type {import('language').TextProcessor<boolean>} */
export const convertHalfWidthCharacters = {
    name: 'Convert half width characters to full width',
    description: 'ﾖﾐﾁｬﾝ → ヨミチャン',
    options: basicTextProcessorOptions,
    process: (str, setting) => (setting ? convertHalfWidthKanaToFullWidth(str) : str),
};


/** @type {import('language').TextProcessor<boolean>} */
export const alphabeticToHiragana = {
    name: 'Convert alphabetic characters to hiragana',
    description: 'yomichan → よみちゃん',
    options: basicTextProcessorOptions,
    process: (str, setting) => (setting ? convertAlphabeticToKana(str) : str),
};

/** @type {import('language').BidirectionalConversionPreprocessor} */
export const alphanumericWidthVariants = {
    name: 'Convert between alphabetic width variants',
    description: 'ｙｏｍｉｔａｎ → yomitan and vice versa',
    options: ['off', 'direct', 'inverse'],
    process: (str, setting) => {
        switch (setting) {
            case 'off':
                return str;
            case 'direct':
                return convertFullWidthAlphanumericToNormal(str);
            case 'inverse':
                return convertAlphanumericToFullWidth(str);
        }
    },
};

/** @type {import('language').BidirectionalConversionPreprocessor} */
export const convertHiraganaToKatakana = {
    name: 'Convert hiragana to katakana',
    description: 'よみちゃん → ヨミチャン and vice versa',
    options: ['off', 'direct', 'inverse'],
    process: (str, setting) => {
        switch (setting) {
            case 'off':
                return str;
            case 'direct':
                return convertHiraganaToKatakanaFunction(str);
            case 'inverse':
                return convertKatakanaToHiraganaFunction(str);
        }
    },
};

/** @type {import('language').TextProcessor<[collapseEmphatic: boolean, collapseEmphaticFull: boolean]>} */
export const collapseEmphaticSequences = {
    name: 'Collapse emphatic character sequences',
    description: 'すっっごーーい → すっごーい / すごい',
    options: [[false, false], [true, false], [true, true]],
    process: (str, setting) => {
        const [collapseEmphatic, collapseEmphaticFull] = setting;
        if (collapseEmphatic) {
            str = collapseEmphaticSequencesFunction(str, collapseEmphaticFull);
        }
        return str;
    },
};

/** @type {import('language').TextProcessor<boolean>} */
export const normalizeCombiningCharacters = {
    name: 'Normalize combining characters',
    description: 'ド → ド (U+30C8 U+3099 → U+30C9)',
    options: basicTextProcessorOptions,
    process: (str, setting) => (setting ? normalizeCombiningCharactersFunction(str) : str),
};

/** @type {import('language').TextProcessor<boolean>} */
export const convertShinjitai = {
    name: 'Convert Kyujitai to Shinjitai',
    description: '萬 → 万',
    options: basicTextProcessorOptions,
    process: (str, setting) => (setting ? convertShinjitaiFunction(str) : str),
};

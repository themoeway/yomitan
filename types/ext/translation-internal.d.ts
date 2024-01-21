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

import type * as DictionaryDatabase from './dictionary-database';
import type * as Dictionary from './dictionary';
import type * as Translation from './translation';

export type TextDeinflectionOptions = [
    textReplacements: Translation.FindTermsTextReplacement[] | null,
    halfWidth: boolean,
    numeric: boolean,
    alphabetic: boolean,
    katakana: boolean,
    hiragana: boolean,
    emphatic: [collapseEmphatic: boolean, collapseEmphaticFull: boolean],
];

export type TextDeinflectionOptionsArrays = [
    textReplacements: (Translation.FindTermsTextReplacement[] | null)[],
    halfWidth: boolean[],
    numeric: boolean[],
    alphabetic: boolean[],
    katakana: boolean[],
    hiragana: boolean[],
    emphatic: [collapseEmphatic: boolean, collapseEmphaticFull: boolean][],
];

export enum DeinflectionRuleFlags {
    None = 0x0,
    VerbIchidan = 0b00000001,
    VerbGodan = 0b00000010,
    VerbSuru = 0b00000100,
    VerbKuru = 0b00001000,
    VerbZuru = 0b00010000,
    AdjectiveI = 0b00100000,
    IruEndingIntermediate = 0b01000000,
}

export type Deinflection = {
    term: string;
    rules: DeinflectionRuleFlags;
    reasons: Dictionary.InflectionRuleChain;
};

export type DatabaseDeinflection = {
    originalText: string;
    transformedText: string;
    deinflectedText: string;
    rules: DeinflectionRuleFlags;
    inflectionRuleChainCandidates: Dictionary.InflectionRuleChainCandidate[];
    databaseEntries: DictionaryDatabase.TermEntry[];
};

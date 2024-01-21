/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2022  Yomichan Authors
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

import type * as Dictionary from './dictionary';
import type {SearchResolution} from 'settings';

// Kanji

/**
 * An options object for use with `Translator.findKanji`.
 */
export type FindKanjiOptions = {
    /**
     * The mapping of dictionaries to search for kanji in.
     * The key is the dictionary name.
     */
    enabledDictionaryMap: KanjiEnabledDictionaryMap;
    /**
     * Whether or not non-Japanese characters should be searched.
     */
    removeNonJapaneseCharacters: boolean;
};

/**
 * Details about a dictionary.
 */
export type FindKanjiDictionary = {
    /**
     * The index of the dictionary
     */
    index: number;
    /**
     * The priority of the dictionary
     */
    priority: number;
};

// Terms

/**
 * An options object for use with `Translator.findTerms`.
 */
export type FindTermsOptions = {
    /**
     * The matching type for looking up terms.
     */
    matchType: FindTermsMatchType;
    /**
     * Whether or not deinflection should be performed.
     */
    deinflect: boolean;
    /**
     * The name of the primary dictionary to search.
     */
    mainDictionary: string;
    /**
     * The name of the frequency dictionary used for sorting
     */
    sortFrequencyDictionary: string | null;
    /**
     * The order used when using a sorting dictionary.
     */
    sortFrequencyDictionaryOrder: FindTermsSortOrder;
    /**
     * Whether or not non-Japanese characters should be searched.
     */
    removeNonJapaneseCharacters: boolean;
    /**
     * Whether or not half-width characters should be converted to full-width characters.
     */
    convertHalfWidthCharacters: FindTermsVariantMode;
    /**
     * Whether or not ASCII numeric characters should be converted to full-width numeric characters.
     */
    convertNumericCharacters: FindTermsVariantMode;
    /**
     * Whether or not alphabetic characters should be converted to kana.
     */
    convertAlphabeticCharacters: FindTermsVariantMode;
    /**
     * Whether or not hiragana characters should be converted to katakana.
     */
    convertHiraganaToKatakana: FindTermsVariantMode;
    /**
     * Whether or not katakana characters should be converted to hiragana.
     */
    convertKatakanaToHiragana: FindTermsVariantMode;
    /**
     * How emphatic character sequences should be collapsed.
     */
    collapseEmphaticSequences: FindTermsEmphaticSequencesMode;
    /**
     * An iterable sequence of text replacements to be applied during the term lookup process.
     */
    textReplacements: (FindTermsTextReplacement[] | null)[];
    /**
     * The mapping of dictionaries to search for terms in.
     * The key is the dictionary name.
     */
    enabledDictionaryMap: TermEnabledDictionaryMap;
    /**
     * A set of dictionary names which should have definitions removed.
     */
    excludeDictionaryDefinitions: Set<string> | null;
    /**
     * Whether every substring should be searched for, or only whole words.
     */
    searchResolution: SearchResolution;
};

/**
 * The matching type for looking up terms.
 */
export type FindTermsMatchType = Dictionary.TermSourceMatchType;

/**
 * A sorting order to use when finding terms.
 */
export type FindTermsSortOrder = 'ascending' | 'descending';

/**
 * Mode describing how to handle variations.
 */
export type FindTermsVariantMode = 'false' | 'true' | 'variant';

/**
 * Mode describing how to handle emphatic sequence variations.
 */
export type FindTermsEmphaticSequencesMode = 'false' | 'true' | 'full';

/**
 * Information about how text should be replaced when looking up terms.
 */
export type FindTermsTextReplacement = {
    /**
     * The pattern to replace.
     */
    pattern: RegExp;
    /**
     * The replacement string. This can contain special sequences, such as `$&`.
     */
    replacement: string;
};

/**
 * Details about a dictionary.
 */
export type FindTermDictionary = {
    /**
     * The index of the dictionary
     */
    index: number;
    /**
     * The priority of the dictionary
     */
    priority: number;
    /**
     * Whether or not secondary term searches are allowed for this dictionary.
     */
    allowSecondarySearches: boolean;
    /**
     * Whether this dictionary's part of speech rules should be used to filter results.
     */
    partsOfSpeechFilter: boolean;
    /**
     * Whether to use the deinflections from this dictionary.
     */
    useDeinflections: boolean;
};

export type TermEnabledDictionaryMap = Map<string, FindTermDictionary>;

export type KanjiEnabledDictionaryMap = Map<string, FindKanjiDictionary>;

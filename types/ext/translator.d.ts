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

import type {DictionaryDatabase} from '../../ext/js/dictionary/dictionary-database';
import type {JapaneseUtil} from '../../ext/js/language/sandbox/japanese-util';
import type * as Dictionary from './dictionary';
import type * as DictionaryDatabaseTypes from './dictionary-database';

export type ConstructorDetails = {
    /** An instance of JapaneseUtil. */
    japaneseUtil: JapaneseUtil;
    /** An instance of DictionaryDatabase. */
    database: DictionaryDatabase;
};

/**
 * Information about how popup content should be shown, specifically related to the outer popup frame.
 */
export type TermFrequencySimple = {
    /** The term. */
    term: string;
    /** The reading of the term. */
    reading: string | null;
    /** The name of the dictionary that the term frequency originates from. */
    dictionary: string;
    /** Whether or not a reading was specified. */
    hasReading: boolean;
    /** The frequency value for the term. */
    frequency: number;
    /** The display value for the frequency, or `null` if none is specified. */
    displayValue: string | null;
    /** Whether or not the `frequency` field is derived from a parsed string. */
    displayValueParsed: boolean;
};

export type TagGroup = {
    dictionary: string;
    tagNames: string[];
};

export type TagExpansionTarget = {
    tags: Dictionary.Tag[];
    tagGroups: TagGroup[];
};

export type DictionaryTagCache = Map<string, TagCache>;

export type TagCache = Map<string, DictionaryDatabaseTypes.Tag | null>;

export type TagTargetMap = Map<string, Map<string, TagTargetItem>>;

export type TagTargetItem = {
    query: string;
    dictionary: string;
    tagName: string;
    cache: TagCache | null;
    databaseTag: DictionaryDatabaseTypes.Tag | null;
    targets: Dictionary.Tag[][];
};

export type DictionaryEntryGroup = {
    ids: Set<number>;
    dictionaryEntries: Dictionary.TermDictionaryEntry[];
};

export type SequenceQuery = {
    query: number;
    dictionary: string;
};

export type FindTermsMode = 'simple' | 'group' | 'merge' | 'split';

export type TermReadingItem = {
    term: string;
    reading: string | null;
};

export type TermReadingList = TermReadingItem[];

export type FindTermsResult = {
    dictionaryEntries: Dictionary.TermDictionaryEntry[];
    originalTextLength: number;
};

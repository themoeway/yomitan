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

import type * as Dictionary from './dictionary';

export type FrequencyData = {
    frequency: number;
    displayValue: string | null;
};

export type KanjiFrequenciesMap3 = Map<string, FrequencyData>;

export type TermFrequenciesMap1 = Map<string, TermFrequenciesMap2>;

export type TermFrequenciesMap2 = Map<string, TermFrequenciesMap2Data>;

export type TermFrequenciesMap2Data = {
    term: string;
    reading: string | null;
    values: TermFrequenciesMap3;
};

export type KanjiFrequenciesMap1 = Map<string, KanjiFrequenciesMap2>;

export type KanjiFrequenciesMap2 = Map<string, KanjiFrequenciesMap2Data>;

export type KanjiFrequenciesMap2Data = {
    character: string;
    values: KanjiFrequenciesMap3;
};

export type TermFrequenciesMap3 = Map<string, FrequencyData>;

export type DictionaryFrequency<T = unknown> = {
    dictionary: string;
    frequencies: T[];
};

export type TermFrequency = {
    term: string;
    reading: string | null;
    values: FrequencyData[];
};

export type KanjiFrequency = {
    character: string;
    values: FrequencyData[];
};

export type TermFrequencyType = 'popular' | 'rare' | 'normal';

export type GroupedPronunciationInternal = {
    pronunciation: Dictionary.Pronunciation;
    terms: Set<string>;
    reading: string;
};

export type GroupedPronunciation = {
    pronunciation: Dictionary.Pronunciation;
    terms: string[];
    reading: string;
    exclusiveTerms: string[];
    exclusiveReadings: string[];
};

export type DictionaryGroupedPronunciations = {
    dictionary: string;
    pronunciations: GroupedPronunciation[];
};

export type TagGroup = {
    tag: Dictionary.Tag;
    headwordIndices: number[];
};

/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2021-2022  Yomichan Authors
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

import type * as DictionaryData from './dictionary-data';

// Common

/**
 * A generic dictionary entry which is used as the base interface.
 */
export type DictionaryEntry = KanjiDictionaryEntry | TermDictionaryEntry;

export type DictionaryEntryType = DictionaryEntry['type'];

/**
 * A tag represents some brief information about part of a dictionary entry.
 */
export type Tag = {
    /**
     * The name of the tag.
     */
    name: string;
    /**
     * The category of the tag.
     */
    category: string;
    /**
     * A number indicating the sorting order of the tag.
     */
    order: number;
    /**
     * A score value for the tag.
     */
    score: number;
    /**
     * An array of descriptions for the tag. * If there are multiple entries,
     * the values will typically have originated from different dictionaries.
     * However, there is no correlation between the length of this array and
     * the length of the `dictionaries` field, as duplicates are removed.
     */
    content: string[];
    /**
     * An array of dictionary names that contained a tag with this name and category.
     */
    dictionaries: string[];
    /**
     * Whether or not this tag is redundant with previous tags.
     */
    redundant: boolean;
};

// Kanji

/**
 * A dictionary entry for a kanji character.
 */
export type KanjiDictionaryEntry = {
    /**
     * The type of the entry.
     */
    type: 'kanji';
    /**
     * The kanji character that was looked up.
     */
    character: string;
    /**
     * The name of the dictionary that the information originated from.
     */
    dictionary: string;
    /**
     * Onyomi readings for the kanji character.
     */
    onyomi: string[];
    /**
     * Kunyomi readings for the kanji character.
     */
    kunyomi: string[];
    /**
     * Tags for the kanji character.
     */
    tags: Tag[];
    /**
     * An object containing stats about the kanji character.
     */
    stats: KanjiStatGroups;
    /**
     * Definitions for the kanji character.
     */
    definitions: string[];
    /**
     * Frequency information for the kanji character.
     */
    frequencies: KanjiFrequency[];
};

/**
 * An object with groups of stats about a kanji character.
 */
export type KanjiStatGroups = {
    /**
     * A group of stats.
     * @param propName The name of the group.
     */
    [propName: string]: KanjiStat[];
};

/**
 * A stat represents a generic piece of information about a kanji character.
 */
export type KanjiStat = {
    /**
     * The name of the stat.
     */
    name: string;
    /**
     * The category of the stat.
     */
    category: string;
    /**
     * A description of the stat.
     */
    content: string;
    /**
     * A number indicating the sorting order of the stat.
     */
    order: number;
    /**
     * A score value for the stat.
     */
    score: number;
    /**
     * The name of the dictionary that the stat originated from.
     */
    dictionary: string;
    /**
     * A value for the stat.
     */
    value: number | string;
};

/**
 * Frequency information corresponds to how frequently a character appears in a corpus,
 * which can be a number of occurrences or an overall rank.
 */
export type KanjiFrequency = {
    /**
     * The original order of the frequency, which is usually used for sorting.
     */
    index: number;
    /**
     * The name of the dictionary that the frequency information originated from.
     */
    dictionary: string;
    /**
     * The index of the dictionary in the original list of dictionaries used for the lookup.
     */
    dictionaryIndex: number;
    /**
     * The priority of the dictionary.
     */
    dictionaryPriority: number;
    /**
     * The kanji character for the frequency.
     */
    character: string;
    /**
     * The frequency for the character, as a number of occurrences or an overall rank.
     */
    frequency: number;
    /**
     * A display value to show to the user.
     */
    displayValue: string | null;
    /**
     * Whether or not the displayValue string was parsed to determine the frequency value.
     */
    displayValueParsed: boolean;
};

// Terms

/**
 * A dictionary entry for a term or group of terms.
 */
export type TermDictionaryEntry = {
    /**
     * The type of the entry.
     */
    type: 'term';
    /**
     * Whether or not any of the sources is a primary source. Primary sources are derived from the
     * original search text, while non-primary sources originate from related terms.
     */
    isPrimary: boolean;
    /**
     * Ways that a looked-up word might be an inflected form of this term.
     */
    inflectionRuleChainCandidates: InflectionRuleChainCandidate[];
    /**
     * A score for the dictionary entry.
     */
    score: number;
    /**
     * The sorting value based on the determined term frequency.
     */
    frequencyOrder: number;
    /**
     * The index of the dictionary in the original list of dictionaries used for the lookup.
     */
    dictionaryIndex: number;
    /**
     * The priority of the dictionary.
     */
    dictionaryPriority: number;
    /**
     * The number of primary sources that had an exact text match for the term.
     */
    sourceTermExactMatchCount: number;
    /**
     * The maximum length of the transformed text for all primary sources.
     */
    maxTransformedTextLength: number;
    /**
     * Headwords for the entry.
     */
    headwords: TermHeadword[];
    /**
     * Definitions for the entry.
     */
    definitions: TermDefinition[];
    /**
     * Pronunciations for the entry.
     */
    pronunciations: TermPronunciation[];
    /**
     * Frequencies for the entry.
     */
    frequencies: TermFrequency[];
};

export type InflectionRuleChainCandidate = {
    source: InflectionSource;
    inflectionRules: InflectionRuleChain;
};

export type InflectionRuleChain = string[];

export type InflectionSource = 'algorithm' | 'dictionary' | 'both';

/**
 * A term headword is a combination of a term, reading, and auxiliary information.
 */
export type TermHeadword = {
    /**
     * The original order of the headword, which is usually used for sorting.
     */
    index: number;
    /**
     * The text for the term.
     */
    term: string;
    /**
     * The reading of the term.
     */
    reading: string;
    /**
     * The sources of the term.
     */
    sources: TermSource[];
    /**
     * Tags for the headword.
     */
    tags: Tag[];
    /**
     * List of word classes (part of speech) for the headword.
     */
    wordClasses: string[];
};

/**
 * A definition contains a list of entries and information about what what terms it corresponds to.
 */
export type TermDefinition = {
    /**
     * The original order of the definition, which is usually used for sorting.
     */
    index: number;
    /**
     * A list of headwords that this definition corresponds to.
     */
    headwordIndices: number[];
    /**
     * The name of the dictionary that the definition information originated from.
     */
    dictionary: string;
    /**
     * The index of the dictionary in the original list of dictionaries used for the lookup.
     */
    dictionaryIndex: number;
    /**
     * The priority of the dictionary.
     */
    dictionaryPriority: number;
    /**
     * Database ID for the definition.
     */
    id: number;
    /**
     * A score for the definition.
     */
    score: number;
    /**
     * The sorting value based on the determined term frequency.
     */
    frequencyOrder: number;
    /**
     * A list of database sequence numbers for the term. A value of `-1` corresponds to no sequence.
     * The list can have multiple values if multiple definitions with different sequences have been merged.
     * The list should always have at least one item.
     */
    sequences: number[];
    /**
     * Whether or not any of the sources is a primary source. Primary sources are derived from the
     * original search text, while non-primary sources originate from related terms.
     */
    isPrimary: boolean;
    /**
     * Tags for the definition.
     */
    tags: Tag[];
    /**
     * The definition entries.
     */
    entries: DictionaryData.TermGlossaryContent[];
};

/**
 * A term pronunciation represents different ways to pronounce one of the headwords.
 */
export type TermPronunciation = {
    /**
     * The original order of the pronunciation, which is usually used for sorting.
     */
    index: number;
    /**
     * Which headword this pronunciation corresponds to.
     */
    headwordIndex: number;
    /**
     * The name of the dictionary that the proununciation information originated from.
     */
    dictionary: string;
    /**
     * The index of the dictionary in the original list of dictionaries used for the lookup.
     */
    dictionaryIndex: number;
    /**
     * The priority of the dictionary.
     */
    dictionaryPriority: number;
    /**
     * The pronunciations for the term.
     */
    pronunciations: Pronunciation[];
};

export type Pronunciation = PitchAccent | PhoneticTranscription;

/**
 * Pitch accent information for a term, represented as the position of the downstep.
 */
export type PitchAccent = {
    /**
     * Type of the pronunciation, for disambiguation between union type members.
     */
    type: 'pitch-accent';
    /**
     * Position of the downstep, as a number of mora.
     */
    position: number;
    /**
     * Positions of morae with a nasal sound.
     */
    nasalPositions: number[];
    /**
     * Positions of morae with a devoiced sound.
     */
    devoicePositions: number[];
    /**
     * Tags for the pitch accent.
     */
    tags: Tag[];
};

export type PhoneticTranscription = {
    /**
     * Type of the pronunciation, for disambiguation between union type members.
     */
    type: 'phonetic-transcription';
    /**
     * An IPA transcription.
     */
    ipa: string;
    /**
     * Tags for the IPA transcription.
     */
    tags: Tag[];
};

export type PronunciationType = Pronunciation['type'];

export type PronunciationGeneric<T extends PronunciationType> = Extract<Pronunciation, {type: T}>;

/**
 * Frequency information corresponds to how frequently a term appears in a corpus,
 * which can be a number of occurrences or an overall rank.
 */
export type TermFrequency = {
    /**
     * The original order of the frequency, which is usually used for sorting.
     */
    index: number;
    /**
     * Which headword this frequency corresponds to.
     */
    headwordIndex: number;
    /**
     * The name of the dictionary that the frequency information originated from.
     */
    dictionary: string;
    /**
     * The index of the dictionary in the original list of dictionaries used for the lookup.
     */
    dictionaryIndex: number;
    /**
     * The priority of the dictionary.
     */
    dictionaryPriority: number;
    /**
     * Whether or not the frequency had an explicit reading specified.
     */
    hasReading: boolean;
    /**
     * The frequency for the term, as a number of occurrences or an overall rank.
     */
    frequency: number;
    /**
     * A display value to show to the user.
     */
    displayValue: string | null;
    /**
     * Whether or not the displayValue string was parsed to determine the frequency value.
     */
    displayValueParsed: boolean;
};

/**
 * Enum representing how the search term relates to the final term.
 */
export type TermSourceMatchType = 'exact' | 'prefix' | 'suffix';

/**
 * Enum representing what database field was used to match the source term.
 */
export type TermSourceMatchSource = 'term' | 'reading' | 'sequence';

/**
 * Source information represents how the original text was transformed to get to the final term.
 */
export type TermSource = {
    /**
     * The original text that was searched.
     */
    originalText: string;
    /**
     * The original text after being transformed, but before applying deinflections.
     */
    transformedText: string;
    /**
     * The final text after applying deinflections.
     */
    deinflectedText: string;
    /**
     * How the deinflected text matches the value from the database.
     */
    matchType: TermSourceMatchType;
    /**
     * Which field was used to match the database entry.
     */
    matchSource: TermSourceMatchSource;
    /**
     * Whether or not this source is a primary source. Primary sources are derived from the
     * original search text, while non-primary sources originate from related terms.
     */
    isPrimary: boolean;
};

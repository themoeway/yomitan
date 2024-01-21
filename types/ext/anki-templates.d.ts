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
import type * as DictionaryData from './dictionary-data';
import type * as DictionaryDataUtil from './dictionary-data-util';

export type RenderMode = 'ankiNote';

export type Context = {
    query: string;
    fullQuery: string;
    document: {title: string};
};

export type Media = {
    audio?: MediaObject;
    screenshot?: MediaObject;
    clipboardImage?: MediaObject;
    clipboardText?: MediaObject;
    selectionText?: MediaObject;
    textFurigana?: TextFuriganaSegment[];
    dictionaryMedia?: DictionaryMedia;
};

export type MediaObject = {value: string};

export type MediaSimpleType = (
    'audio' |
    'screenshot' |
    'clipboardImage' |
    'clipboardText' |
    'selectionText'
);

export type TextFuriganaSegment = {
    text: string;
    readingMode: TextFuriganaReadingMode;
    details: MediaObject;
};

export type TextFuriganaReadingMode = 'hiragana' | 'katakana' | null;

export type DictionaryMedia = {
    [dictionary: string]: {
        [path: string]: MediaObject;
    };
};

export type NoteData = {
    marker: string;
    readonly definition: DictionaryEntry;
    glossaryLayoutMode: string;
    compactTags: boolean;
    group: boolean;
    merge: boolean;
    modeTermKanji: boolean;
    modeTermKana: boolean;
    modeKanji: boolean;
    compactGlossaries: boolean;
    readonly uniqueExpressions: string[];
    readonly uniqueReadings: string[];
    readonly pitches: PitchGroup[];
    readonly pitchCount: number;
    readonly phoneticTranscriptions: TranscriptionGroup[];
    readonly context: Context;
    media: Media;
    readonly dictionaryEntry: Dictionary.DictionaryEntry;
};

export type PitchGroup = {
    dictionary: string;
    pitches: Pitch[];
};

export type Pitch = {
    expressions: string[];
    reading: string;
    position: number;
    nasalPositions: number[];
    devoicePositions: number[];
    tags: PitchTag[];
    exclusiveExpressions: string[];
    exclusiveReadings: string[];
};

export type TranscriptionGroup = {
    dictionary: string;
    phoneticTranscriptions: Transcription[];
};

export type Transcription = {
    expressions: string[];
    reading: string;
    ipa: string;
    tags: Dictionary.Tag[];
    exclusiveExpressions: string[];
    exclusiveReadings: string[];
};

/**
 * For legacy reasons, {@link Pitch} has a custom tag type that resembles {@link Dictionary.Tag}.
 */
export type PitchTag = {
    name: string;
    category: string;
    order: number;
    score: number;
    content: string[];
    dictionaries: string[];
    redundant: boolean;
};

export type KanjiDictionaryEntry = {
    type: 'kanji';
    character: string;
    dictionary: string;
    onyomi: string[];
    kunyomi: string[];
    glossary: string[];
    readonly tags: Tag[];
    readonly stats: KanjiStatGroups;
    readonly frequencies: KanjiFrequency[];
    url: string;
    readonly cloze: Cloze;
};

export type KanjiStatGroups = {
    [propName: string]: KanjiStat[];
};

export type KanjiStat = {
    name: string;
    category: string;
    notes: string;
    order: number;
    score: number;
    dictionary: string;
    value: number | string;
};

export type KanjiFrequency = {
    index: number;
    dictionary: string;
    dictionaryOrder: {
        index: number;
        priority: number;
    };
    character: string;
    frequency: number | string;
};

export type TermDictionaryEntryType = 'term' | 'termGrouped' | 'termMerged';

export type TermDictionaryEntry = {
    type: TermDictionaryEntryType;
    id?: number;
    source: string | null;
    rawSource: string | null;
    sourceTerm?: string | null;
    inflectionRuleChainCandidates: Dictionary.InflectionRuleChainCandidate[];
    score: number;
    isPrimary?: boolean;
    readonly sequence: number;
    readonly dictionary: string;
    dictionaryOrder: {
        index: number;
        priority: number;
    };
    readonly dictionaryNames: string[];
    readonly expression: string | string[];
    readonly reading: string | string[];
    readonly expressions: TermHeadword[];
    readonly glossary?: DictionaryData.TermGlossary[];
    readonly definitionTags?: Tag[];
    readonly termTags?: Tag[];
    readonly definitions?: TermDefinition[];
    readonly frequencies: TermFrequency[];
    readonly pitches: TermPitchAccent[];
    readonly phoneticTranscriptions: TermPhoneticTranscription[];
    sourceTermExactMatchCount: number;
    url: string;
    readonly cloze: Cloze;
    readonly furiganaSegments?: FuriganaSegment[];
};

export type TermDictionaryEntryCommonInfo = {
    uniqueTerms: string[];
    uniqueReadings: string[];
    definitionTags: Tag[];
    definitions?: TermDefinition[];
};

export type UnknownDictionaryEntry = Record<string, never>;

export type DictionaryEntry = KanjiDictionaryEntry | TermDictionaryEntry | UnknownDictionaryEntry;

export type Tag = {
    name: string;
    category: string;
    order: number;
    score: number;
    notes: string;
    dictionary: string;
    redundant: boolean;
};

export type TermDefinition = {
    sequence: number;
    dictionary: string;
    glossary: DictionaryData.TermGlossary[];
    definitionTags: Tag[];
    only?: string[];
};

export type TermFrequency = {
    index: number;
    expressionIndex: number;
    dictionary: string;
    dictionaryOrder: {
        index: number;
        priority: number;
    };
    expression: string;
    reading: string;
    hasReading: boolean;
    frequency: number | string;
};

export type TermPitchAccent = {
    index: number;
    expressionIndex: number;
    dictionary: string;
    dictionaryOrder: {
        index: number;
        priority: number;
    };
    expression: string;
    reading: string;
    readonly pitches: PitchAccent[];
};

export type PitchAccent = {
    position: number;
    tags: Tag[];
};

export type TermPhoneticTranscription = {
    index: number;
    expressionIndex: number;
    dictionary: string;
    dictionaryOrder: {
        index: number;
        priority: number;
    };
    expression: string;
    reading: string;
    readonly phoneticTranscriptions: PhoneticTranscription[];
};

export type PhoneticTranscription = {
    ipa: string;
    tags: Tag[];
};

export type TermFrequencyType = DictionaryDataUtil.TermFrequencyType;

export type TermHeadword = {
    sourceTerm: string;
    expression: string;
    reading: string;
    readonly termTags: Tag[];
    readonly frequencies: TermFrequency[];
    readonly pitches: TermPitchAccent[];
    readonly furiganaSegments: FuriganaSegment[];
    readonly termFrequency: TermFrequencyType;
    wordClasses: string[];
};

export type FuriganaSegment = {
    text: string;
    furigana: string;
};

export type Cloze = {
    sentence: string;
    prefix: string;
    body: string;
    suffix: string;
};

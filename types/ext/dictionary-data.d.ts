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

import type * as StructuredContent from './structured-content';

export type IndexVersion = 1 | 2 | 3;

export type Index = {
    format?: IndexVersion;
    version?: IndexVersion;
    title: string;
    revision: string;
    sequenced?: boolean;
    author?: string;
    url?: string;
    description?: string;
    attribution?: string;
    frequencyMode?: 'occurrence-based' | 'rank-based';
    tagMeta?: IndexTagMeta;
};

export type IndexTagMeta = {
    [name: string]: IndexTag;
};

export type IndexTag = {
    category: string;
    order: number;
    notes: string;
    score: number;
};

export type TermV1Array = TermV1[];

export type TermV1 = [
    expression: string,
    reading: string,
    definitionTags: string | null,
    rules: string,
    score: number,
    ...glossary: string[],
];

export type TermV3Array = TermV3[];

export type TermV3 = [
    expression: string,
    reading: string,
    definitionTags: string | null,
    rules: string,
    score: number,
    glossary: TermGlossary[],
    sequence: number,
    termTags: string,
];

export type KanjiV1Array = KanjiV1[];

export type KanjiV1 = [
    character: string,
    onyomi: string,
    kunyomi: string,
    tags: string,
    ...meanings: string[],
];

export type KanjiV3Array = KanjiV3[];

export type KanjiV3 = [
    character: string,
    onyomi: string,
    kunyomi: string,
    tags: string,
    meanings: string[],
    stats: {[name: string]: string},
];

export type TermGlossary = (
    TermGlossaryContent |
    TermGlossaryDeinflection
);

export type TermGlossaryContent = (
    TermGlossaryString |
    TermGlossaryText |
    TermGlossaryImage |
    TermGlossaryStructuredContent
);

export type TermGlossaryString = string;
export type TermGlossaryText = {type: 'text', text: string};
export type TermGlossaryImage = {type: 'image'} & TermImage;
export type TermGlossaryStructuredContent = {type: 'structured-content', content: StructuredContent.Content};
export type TermGlossaryDeinflection = [
    uninflected: string,
    inflectionRuleChain: string[],
];

export type TermImage = StructuredContent.ImageElementBase & {
    // Compatibility properties
    verticalAlign?: undefined;
    sizeUnits?: undefined;
};

export type TagArray = Tag[];

export type Tag = [
    name: string,
    category: string,
    order: number,
    notes: string,
    score: number,
];

export type GenericFrequencyData = string | number | {
    value: number;
    displayValue?: string;
    reading?: undefined; // Used for type disambiguation, field does not actually exist
};

export type TermMetaArray = TermMeta[];

export type TermMeta = TermMetaFrequency | TermMetaPitch | TermMetaPhonetic;

export type TermMetaFrequencyDataWithReading = {
    reading: string;
    frequency: GenericFrequencyData;
};

export type TermMetaFrequency = [
    expression: string,
    mode: 'freq',
    data: GenericFrequencyData | TermMetaFrequencyDataWithReading,
];

export type TermMetaPitchData = {
    reading: string;
    pitches: {
        position: number;
        nasal?: number | number[];
        devoice?: number | number[];
        tags?: string[];
    }[];
};

export type TermMetaPitch = [
    expression: string,
    mode: 'pitch',
    data: TermMetaPitchData,
];

export type TermMetaPhonetic = [
    expression: string,
    mode: 'ipa',
    data: TermMetaPhoneticData,
];

export type TermMetaPhoneticData = {
    reading: string;
    transcriptions: {
        ipa: string;
        tags?: string[];
    }[];
};

export type KanjiMetaArray = KanjiMeta[];

export type KanjiMeta = KanjiMetaFrequency;

export type KanjiMetaFrequency = [
    character: string,
    mode: 'freq',
    data: GenericFrequencyData,
];

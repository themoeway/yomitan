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

import type {Summary} from '../ext/dictionary-importer';
import type {Tag, MatchType, TermMetaType, KanjiMetaType, TermExactRequest, DictionaryCounts} from '../ext/dictionary-database';

export type DatabaseTestData = {
    expectedSummary: Summary;
    expectedCounts: DictionaryCounts;
    tests: {
        findTermsBulk: FindTermsBulkTestCase[];
        findTermsExactBulk: FindTermsExactBulkTestCase[];
        findTermsBySequenceBulk: FindTermsBySequenceBulkTestCase[];
        findTermMetaBulk: FindTermMetaBulkTestCase[];
        findKanjiBulk: FindKanjiBulkTestCase[];
        findKanjiMetaBulk: FindKanjiMetaBulkTestCase[];
        findTagForTitle: FindTagForTitleTestCase[];
    };
};

export type ItemCount<TKey = unknown> = [key: TKey, count: number];

export type FindTermsBulkTestCase = {
    inputs: {
        matchType: MatchType;
        termList: string[];
    }[];
    expectedResults: {
        total: number;
        terms: ItemCount<string>[];
        readings: ItemCount<string>[];
    };
};

export type FindTermsExactBulkTestCase = {
    inputs: {
        termList: TermExactRequest[];
    }[];
    expectedResults: {
        total: number;
        terms: ItemCount<string>[];
        readings: ItemCount<string>[];
    };
};

export type FindTermsBySequenceBulkTestCase = {
    inputs: {
        sequenceList: number[];
    }[];
    expectedResults: {
        total: number;
        terms: ItemCount<string>[];
        readings: ItemCount<string>[];
    };
};

export type FindTermMetaBulkTestCase = {
    inputs: {
        termList: string[];
    }[];
    expectedResults: {
        total: number;
        modes: ItemCount<TermMetaType>[];
    };
};

export type FindKanjiBulkTestCase = {
    inputs: {
        kanjiList: string[];
    }[];
    expectedResults: {
        total: number;
        kanji: ItemCount<string>[];
    };
};

export type FindKanjiMetaBulkTestCase = {
    inputs: {
        kanjiList: string[];
    }[];
    expectedResults: {
        total: number;
        modes: ItemCount<KanjiMetaType>[];
    };
};

export type FindTagForTitleTestCase = {
    inputs: {
        name: string;
    }[];
    expectedResults: {
        value: Tag | null;
    };
};

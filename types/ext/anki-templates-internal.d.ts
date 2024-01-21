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

import type * as AnkiTemplates from './anki-templates';
import type * as Dictionary from './dictionary';
import type * as Settings from './settings';

export type Context = {
    url: string;
    documentTitle: string;
    query: string;
    fullQuery: string;
    sentence: ContextSentence;
};

export type ContextSentence = {
    text?: string;
    offset?: number;
};

export type CreateModeNoTest = 'kanji' | 'term-kanji' | 'term-kana';

export type CreateMode = CreateModeNoTest | 'test';

export type CreateDetails = {
    /** The dictionary entry. */
    dictionaryEntry: Dictionary.DictionaryEntry;
    /** The result output mode. */
    resultOutputMode: Settings.ResultOutputMode;
    /** The mode being used to generate the Anki data. */
    mode: CreateMode;
    /** The glossary layout mode. */
    glossaryLayoutMode: Settings.GlossaryLayoutMode;
    /** Whether or not compact tags mode is enabled. */
    compactTags: boolean;
    /** Contextual information about the source of the dictionary entry. */
    context: Context;
    /** Media data. */
    media?: AnkiTemplates.Media;
};

export type CachedValue<T = unknown> = {
    getter: () => T;
    hasValue: boolean;
    value: T | undefined;
};

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

import type {TextSourceMap} from '../../ext/js/general/text-source-map.js';
import type {SafeAny} from './core';

export type TextPreprocessorOptions<T = unknown> = T[];

export type TextPreprocessorFunction<T = unknown> = (str: string, setting: T, sourceMap: TextSourceMap) => string;

export type TextPreprocessor<T = unknown> = {
    name: string;
    description: string;
    options: TextPreprocessorOptions<T>;
    process: TextPreprocessorFunction<T>;
};

export type LanguageAndPreprocessors = {
    iso: string;
    textPreprocessors: TextPreprocessorWithId<unknown>[];
};

export type TextPreprocessorWithId<T = unknown> = {
    id: string;
    textPreprocessor: TextPreprocessor<T>;
};

export type LanguageSummary = {
    name: string;
    iso: string;
    exampleText: string;
};

export type LanguageDescriptor<TTextPreprocessorDescriptor extends TextPreprocessorDescriptor> = {
    name: string;
    iso: string;
    exampleText: string;
    textPreprocessors: TTextPreprocessorDescriptor;
};

export type TextPreprocessorDescriptor = {
    [key: string]: TextPreprocessor<SafeAny>;
};
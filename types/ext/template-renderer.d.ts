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

import type * as AnkiNoteBuilder from './anki-note-builder';
import type * as AnkiTemplates from './anki-templates';
import type * as Core from './core';

export type RenderResult = {
    result: string;
    requirements: AnkiNoteBuilder.Requirement[];
};

export type RenderMultiItem = {
    template: string;
    templateItems: RenderMultiTemplateItem[];
};

export type RenderMultiTemplateItem = {
    type: AnkiTemplates.RenderMode;
    commonData: AnkiNoteBuilder.CommonData;
    datas: PartialOrCompositeRenderData[];
};

export type PartialRenderData = {
    marker: string;
    commonData?: undefined;
};

export type CompositeRenderData = {
    marker: string;
    commonData: AnkiNoteBuilder.CommonData;
};

export type PartialOrCompositeRenderData = PartialRenderData | CompositeRenderData;

export type DataType = {
    modifier: (data: CompositeRenderData) => AnkiTemplates.NoteData;
    composeData: (data: PartialOrCompositeRenderData, commonData: AnkiNoteBuilder.CommonData) => CompositeRenderData;
};

export type HelperOptionsFunction<TResult = unknown> = (context: unknown) => TResult;

export type HelperOptions = {
    fn?: HelperOptionsFunction;
    inverse?: HelperOptionsFunction;
    hash: Core.SafeAny;
    data?: Core.SafeAny;
};

export type HelperFunction<TReturn = unknown> = (args: unknown[], context: unknown, options: HelperOptions) => TReturn;

export type HelperFunctionsDescriptor = [
    name: string,
    helper: HelperFunction<unknown>,
][];

export type SetupCallbackResult = {
    requirements: AnkiNoteBuilder.Requirement[];
};

export type CleanupCallbackResult = void;

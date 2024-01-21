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

import type {Response} from 'core';
import type {RenderMode, NoteData} from 'anki-templates';
import type {CompositeRenderData, PartialOrCompositeRenderData, RenderMultiItem, RenderResult} from 'template-renderer';
import type {
    ApiMap as BaseApiMap,
    ApiMapInit as BaseApiMapInit,
    ApiHandler as BaseApiHandler,
    ApiParams as BaseApiParams,
    ApiNames as BaseApiNames,
    ApiReturn as BaseApiReturn,
    ApiReturnAny as BaseApiReturnAny,
} from './api-map';

// Frontend API

type FrontendApiSurface = {
    render: {
        params: {
            template: string;
            data: PartialOrCompositeRenderData;
            type: RenderMode;
        };
        return: RenderResult;
    };
    renderMulti: {
        params: {
            items: RenderMultiItem[];
        };
        return: Response<RenderResult>[];
    };
    getModifiedData: {
        params: {
            data: CompositeRenderData;
            type: RenderMode;
        };
        return: NoteData;
    };
};

type FrontendApiParams<TName extends FrontendApiNames> = BaseApiParams<FrontendApiSurface[TName]>;

type FrontendApiNames = BaseApiNames<FrontendApiSurface>;

type FrontendApiReturnAny = BaseApiReturnAny<FrontendApiSurface>;

export type FrontendMessage<TName extends FrontendApiNames> = {
    action: TName;
    params: FrontendApiParams<TName>;
    id: string;
};

export type FrontendMessageAny = FrontendMessage<FrontendApiNames>;

export type FrontendApiReturn<TName extends FrontendApiNames> = BaseApiReturn<FrontendApiSurface[TName]>;

export type FrontendApiMap = BaseApiMap<FrontendApiSurface>;

export type FrontendApiMapInit = BaseApiMapInit<FrontendApiSurface>;

export type FrontendApiHandler<TName extends FrontendApiNames> = BaseApiHandler<FrontendApiSurface[TName]>;

// Backend API

export type BackendApiSurface = {
    ready: {
        params: void;
        return: void;
    };
    response: {
        params: Response<FrontendApiReturnAny>;
        return: void;
    };
};

type BackendApiNames = BaseApiNames<BackendApiSurface>;

type BackendApiParams<TName extends BackendApiNames> = BaseApiParams<BackendApiSurface[TName]>;

export type BackendMessage<TName extends BackendApiNames> = {
    action: TName;
    params: BackendApiParams<TName>;
    id: string | null;
};

export type BackendMessageAny = BackendMessage<BackendApiNames>;

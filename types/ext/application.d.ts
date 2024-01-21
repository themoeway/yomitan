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

import type {TokenString} from './core';
import type {SearchMode} from './display';
import type {FrameEndpointReadyDetails, FrameEndpointConnectedDetails} from './frame-client';
import type {DatabaseUpdateType, DatabaseUpdateCause} from './backend';
import type {EventNames, EventArgument as BaseEventArgument} from './core';
import type {
    ApiMap as BaseApiMap,
    ApiHandler as BaseApiHandler,
    ApiParams as BaseApiParams,
    ApiNames as BaseApiNames,
    ApiReturn as BaseApiReturn,
} from './api-map';

export type ApiSurface = {
    searchDisplayControllerGetMode: {
        params: void;
        return: SearchMode;
    };
    searchDisplayControllerSetMode: {
        params: {
            mode: SearchMode;
        };
        return: void;
    };
    searchDisplayControllerUpdateSearchQuery: {
        params: {
            text: string;
            animate?: boolean;
        };
        return: void;
    };
    applicationIsReady: {
        params: void;
        return: boolean;
    };
    applicationBackendReady: {
        params: void;
        return: void;
    };
    applicationGetUrl: {
        params: void;
        return: {
            url: string;
        };
    };
    applicationOptionsUpdated: {
        params: {
            source: string;
        };
        return: void;
    };
    applicationDatabaseUpdated: {
        params: {
            type: DatabaseUpdateType;
            cause: DatabaseUpdateCause;
        };
        return: void;
    };
    applicationZoomChanged: {
        params: {
            oldZoomFactor: number;
            newZoomFactor: number;
        };
        return: void;
    };
    frontendRequestReadyBroadcast: {
        params: {
            frameId: number;
        };
        return: void;
    };
    frontendSetAllVisibleOverride: {
        params: {
            value: boolean;
            priority: number;
            awaitFrame: boolean;
        };
        return: TokenString;
    };
    frontendClearAllVisibleOverride: {
        params: {
            token: TokenString;
        };
        return: boolean;
    };
    frontendReady: {
        params: {
            frameId: number;
        };
        return: void;
    };
    frameEndpointReady: {
        params: FrameEndpointReadyDetails;
        return: void;
    };
    frameEndpointConnected: {
        params: FrameEndpointConnectedDetails;
        return: void;
    };
};

export type ApiParams<TName extends ApiNames> = BaseApiParams<ApiSurface[TName]>;

export type ApiNames = BaseApiNames<ApiSurface>;

export type ApiMessageNoFrameId<TName extends ApiNames> = (
    ApiParams<TName> extends void ?
        {action: TName, params?: never} :
        {action: TName, params: ApiParams<TName>}
);

export type ApiMessage<TName extends ApiNames> = ApiMessageNoFrameId<TName> & {
    /**
     * The origin frameId that sent this message.
     * If sent from the backend, this value will be undefined.
     */
    frameId?: number;
};

export type ApiMessageNoFrameIdAny = {[name in ApiNames]: ApiMessageNoFrameId<name>}[ApiNames];

export type ApiMessageAny = {[name in ApiNames]: ApiMessage<name>}[ApiNames];

export type ApiMap = BaseApiMap<ApiSurface>;

export type ApiHandler<TName extends ApiNames> = BaseApiHandler<ApiSurface[TName]>;

export type ApiReturn<TName extends ApiNames> = BaseApiReturn<ApiSurface[TName]>;

export type Events = {
    extensionUnloaded: Record<string, never>;
    optionsUpdated: {
        source: string;
    };
    databaseUpdated: {
        type: DatabaseUpdateType;
        cause: DatabaseUpdateCause;
    };
    zoomChanged: {
        oldZoomFactor: number;
        newZoomFactor: number;
    };
    closePopups: Record<string, never>;
    storageChanged: Record<string, never>;
};

export type EventArgument<TName extends EventNames<Events>> = BaseEventArgument<Events, TName>;

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

import type {CrossFrameAPIPort} from '../../ext/js/comm/cross-frame-api.js';
import type {Response, Timeout, TokenString} from './core';
import type {ModifierKey} from './input';
import type {ContentDetails as PopupContentDetails, ValidSize} from './popup';
import type {GetOrCreatePopupDetails} from './popup-factory';
import type {OptionsContext} from './settings';
import type {
    ApiMap as BaseApiMap,
    ApiParams as BaseApiParams,
    ApiNames as BaseApiNames,
    ApiMapInit as BaseApiMapInit,
    ApiHandler as BaseApiHandler,
    ApiReturn as BaseApiReturn,
    ApiReturnAny as BaseApiReturnAny,
} from './api-map';
import type {
    DirectApiFrameClientMessageAny as DisplayDirectApiFrameClientMessageAny,
    DirectApiMessageAny as DisplayDirectApiMessageAny,
    DirectApiReturnAny as DisplayDirectApiReturnAny,
    ContentDetails as DisplayContentDetails,
} from './display';
import type {ChildFrameRect} from 'frame-offset-forwarder';
import type {RequestFrameInfoResponseParams, RequestFrameInfoResponseReturn} from './frame-ancestry-handler';

export type CrossFrameAPIPortEvents = {
    disconnect: CrossFrameAPIPort;
};

export type AcknowledgeMessage = {
    type: 'ack';
    id: number;
};

export type ResultMessage = {
    type: 'result';
    id: number;
    data: Response<ApiReturnAny>;
};

export type InvokeMessage = {
    type: 'invoke';
    id: number;
    data: ApiMessageAny;
};

export type Message = AcknowledgeMessage | ResultMessage | InvokeMessage;

export type Invocation = {
    id: number;
    resolve: (value: ApiReturnAny) => void;
    reject: (reason: Error) => void;
    responseTimeout: number;
    action: string;
    ack: boolean;
    timer: Timeout | null;
};

export type PortDetails = CrossFrameCommunicationPortDetails;

export type CrossFrameCommunicationPortDetails = {
    name: 'cross-frame-communication-port';
    otherTabId: number;
    otherFrameId: number;
};

type ApiSurface = {
    displayPopupMessage1: {
        params: DisplayDirectApiFrameClientMessageAny;
        return: DisplayDirectApiReturnAny;
    };
    displayPopupMessage2: {
        params: DisplayDirectApiMessageAny;
        return: DisplayDirectApiReturnAny;
    };
    frontendClosePopup: {
        params: void;
        return: void;
    };
    frontendCopySelection: {
        params: void;
        return: void;
    };
    frontendGetSelectionText: {
        params: void;
        return: string;
    };
    frontendGetPopupInfo: {
        params: void;
        return: {
            popupId: string | null;
        };
    };
    frontendGetPageInfo: {
        params: void;
        return: {
            url: string;
            documentTitle: string;
        };
    };
    frameOffsetForwarderGetChildFrameRect: {
        params: {
            frameId: number;
        };
        return: ChildFrameRect | null;
    };
    hotkeyHandlerForwardHotkey: {
        params: {
            key: string;
            modifiers: ModifierKey[];
        };
        return: boolean;
    };
    popupFactoryGetOrCreatePopup: {
        params: GetOrCreatePopupDetails;
        return: {id: string, depth: number, frameId: number};
    };
    popupFactorySetOptionsContext: {
        params: {
            id: string;
            optionsContext: OptionsContext;
        };
        return: void;
    };
    popupFactoryHide: {
        params: {
            id: string;
            changeFocus: boolean;
        };
        return: void;
    };
    popupFactoryIsVisible: {
        params: {
            id: string;
        };
        return: boolean;
    };
    popupFactorySetVisibleOverride: {
        params: {
            id: string;
            value: boolean;
            priority: number;
        };
        return: TokenString | null;
    };
    popupFactoryClearVisibleOverride: {
        params: {
            id: string;
            token: TokenString;
        };
        return: boolean;
    };
    popupFactoryContainsPoint: {
        params: {
            id: string;
            x: number;
            y: number;
        };
        return: boolean;
    };
    popupFactoryShowContent: {
        params: {
            id: string;
            details: PopupContentDetails;
            displayDetails: DisplayContentDetails | null;
        };
        return: void;
    };
    popupFactorySetCustomCss: {
        params: {
            id: string;
            css: string;
        };
        return: void;
    };
    popupFactoryClearAutoPlayTimer: {
        params: {
            id: string;
        };
        return: void;
    };
    popupFactorySetContentScale: {
        params: {
            id: string;
            scale: number;
        };
        return: void;
    };
    popupFactoryUpdateTheme: {
        params: {
            id: string;
        };
        return: void;
    };
    popupFactorySetCustomOuterCss: {
        params: {
            id: string;
            css: string;
            useWebExtensionApi: boolean;
        };
        return: void;
    };
    popupFactoryGetFrameSize: {
        params: {
            id: string;
        };
        return: ValidSize;
    };
    popupFactorySetFrameSize: {
        params: {
            id: string;
            width: number;
            height: number;
        };
        return: boolean;
    };
    frameAncestryHandlerRequestFrameInfoResponse: {
        params: RequestFrameInfoResponseParams;
        return: RequestFrameInfoResponseReturn;
    };
};

export type ApiNames = BaseApiNames<ApiSurface>;

export type ApiMapInit = BaseApiMapInit<ApiSurface>;

export type ApiMap = BaseApiMap<ApiSurface, []>;

export type ApiHandler<TName extends ApiNames> = BaseApiHandler<ApiSurface[TName]>;

export type ApiParams<TName extends ApiNames> = BaseApiParams<ApiSurface[TName]>;

export type ApiReturn<TName extends ApiNames> = BaseApiReturn<ApiSurface[TName]>;

export type ApiReturnAny = BaseApiReturnAny<ApiSurface>;

export type ApiMessageAny = {[name in ApiNames]: ApiMessage<name>}[ApiNames];

type ApiMessage<TName extends ApiNames> = {
    action: TName;
    params: ApiParams<TName>;
};

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

import type {DisplayContentManager} from '../../ext/js/display/display-content-manager';
import type {HotkeyHelpController} from '../../ext/js/input/hotkey-help-controller';
import type {JapaneseUtil} from '../../ext/js/language/sandbox/japanese-util';
import type * as Dictionary from './dictionary';
import type * as Extension from './extension';
import type * as Settings from './settings';
import type * as TextScannerTypes from './text-scanner';
import type {EventNames, EventArgument as BaseEventArgument} from './core';
import type {Message as FrameClientMessage} from './frame-client';
import type {
    ApiMap as BaseApiMap,
    ApiParams as BaseApiParams,
    ApiNames as BaseApiNames,
    ApiMapInit as BaseApiMapInit,
    ApiParamsAny as BaseApiParamsAny,
    ApiHandler as BaseApiHandler,
    ApiReturn as BaseApiReturn,
} from './api-map';

export type HistoryMode = 'clear' | 'overwrite' | 'new';

export type DisplayPageType = 'search' | 'popup';

export type PageType = 'terms' | 'kanji' | 'unloaded' | 'clear';

/**
 * Information about how popup content should be shown, specifically related to the inner popup content.
 */
export type ContentDetails = {
    /** Whether or not the frame should be `focus()`'d. */
    focus: boolean;
    /** An object containing key-value pairs representing the URL search params. */
    params: HistoryParams;
    /** The semi-persistent state assigned to the navigation entry. */
    state: HistoryState | null;
    /** The non-persistent content assigned to the navigation entry. */
    content: HistoryContent | null;
    /** How the navigation history should be modified. */
    historyMode: HistoryMode;
};

/**
 * An object containing key-value pairs representing the URL search params.
 */
export type HistoryParams = {
    /** The type of content that is being shown. */
    type?: PageType;
    /** The search query. */
    query?: string;
    /** Whether or not wildcards can be used for the search query. */
    wildcards?: 'on' | 'off';
    /** The start position of the `query` string as an index into the `full` query string. */
    offset?: string;
    /** The full search text. If absent, `query` is the full search text. */
    full?: string;
    /** Whether or not the full search query should be forced to be visible. */
    ['full-visible']?: 'true' | 'false';
    /** Whether or not the query should be looked up. If it is not looked up, the content should be provided. */
    lookup?: 'true' | 'false';
    /** Other values; only used for assignment. */
    [otherKey: string]: unknown;
};

/**
 * The semi-persistent state assigned to the navigation entry.
 */
export type HistoryState = {
    /** What was the cause of the navigation. */
    cause?: 'queryParser';
    /** The sentence context. */
    sentence?: HistoryStateSentence;
    /** The index of the dictionary entry to focus. */
    focusEntry?: number;
    /** The horizontal scroll position. */
    scrollX?: number;
    /** The vertical scroll position. */
    scrollY?: number;
    /** The options context which should be used for lookups. */
    optionsContext?: Settings.OptionsContext;
    /** The originating URL of the content. */
    url?: string;
    /** The originating document title of the content. */
    documentTitle?: string;
};

/**
 * The sentence context.
 */
export type HistoryStateSentence = {
    /** The full string. */
    text: string;
    /** The offset from the start of `text` to the full search query. */
    offset: number;
};

/**
 * The non-persistent content assigned to the navigation entry.
 */
export type HistoryContent = {
    /** Whether or not any CSS animations should occur. */
    animate?: boolean;
    /** An array of dictionary entries to display as content. */
    dictionaryEntries?: Dictionary.DictionaryEntry[];
    /** The identifying information for the frame the content originated from. */
    contentOrigin?: Extension.ContentOrigin;
};

export type SearchMode = null | 'popup' | 'action-popup';

export type GetSearchContextCallback = TextScannerTypes.GetSearchContextCallbackSync;

export type QueryParserConstructorDetails = {
    getSearchContext: GetSearchContextCallback;
    japaneseUtil: JapaneseUtil;
};

export type QueryParserOptions = {
    selectedParser: string | null;
    termSpacing: boolean;
    readingMode: Settings.ParsingReadingMode;
    useInternalParser: boolean;
    useMecabParser: boolean;
    scanning: TextScannerTypes.Options;
};

export type Events = {
    optionsUpdated: {
        options: Settings.ProfileOptions;
    };
    frameVisibilityChange: {
        value: boolean;
    };
    logDictionaryEntryData: {
        dictionaryEntry: Dictionary.DictionaryEntry;
        promises: Promise<unknown>[];
    };
    contentClear: Record<string, never>;
    contentUpdateStart: {
        type: PageType;
        query: string;
    };
    contentUpdateEntry: {
        dictionaryEntry: Dictionary.DictionaryEntry;
        element: Element;
        index: number;
    };
    contentUpdateComplete: {
        type: PageType;
    };
};

export type EventArgument<TName extends EventNames<Events>> = BaseEventArgument<Events, TName>;

export type DisplayGeneratorConstructorDetails = {
    japaneseUtil: JapaneseUtil;
    contentManager: DisplayContentManager;
    hotkeyHelpController?: HotkeyHelpController | null;
};

// Direct API

export type DirectApiSurface = {
    displayAudioClearAutoPlayTimer: {
        params: void;
        return: void;
    };
    displaySetOptionsContext: {
        params: {
            optionsContext: Settings.OptionsContext;
        };
        return: void;
    };
    displaySetContent: {
        params: {
            details: ContentDetails;
        };
        return: void;
    };
    displaySetCustomCss: {
        params: {
            css: string;
        };
        return: void;
    };
    displaySetContentScale: {
        params: {
            scale: number;
        };
        return: void;
    };
    displayConfigure: {
        params: {
            depth: number;
            parentPopupId: string;
            parentFrameId: number;
            childrenSupported: boolean;
            scale: number;
            optionsContext: Settings.OptionsContext;
        };
        return: void;
    };
    displayVisibilityChanged: {
        params: {
            value: boolean;
        };
        return: void;
    };
};

export type DirectApiNames = BaseApiNames<DirectApiSurface>;

export type DirectApiMapInit = BaseApiMapInit<DirectApiSurface>;

export type DirectApiMap = BaseApiMap<DirectApiSurface, []>;

export type DirectApiHandler<TName extends DirectApiNames> = BaseApiHandler<DirectApiSurface[TName]>;

export type DirectApiParams<TName extends DirectApiNames> = BaseApiParams<DirectApiSurface[TName]>;

export type DirectApiReturn<TName extends DirectApiNames> = BaseApiReturn<DirectApiSurface[TName]>;

export type DirectApiMessageAny = {[name in DirectApiNames]: DirectApiMessage<name>}[DirectApiNames];

export type DirectApiReturnAny = BaseApiParamsAny<DirectApiSurface>;

type DirectApiMessage<TName extends DirectApiNames> = {
    action: TName;
    params: DirectApiParams<TName>;
};

export type DirectApiFrameClientMessageAny = {[name in DirectApiNames]: FrameClientMessage<DirectApiMessage<name>>}[DirectApiNames];

// Window API

export type WindowApiSurface = {
    displayExtensionUnloaded: {
        params: void;
        return: void;
    };
};

type WindowApiNames = BaseApiNames<WindowApiSurface>;

export type WindowApiMapInit = BaseApiMapInit<WindowApiSurface>;

export type WindowApiMap = BaseApiMap<WindowApiSurface, []>;

export type WindowApiHandler<TName extends WindowApiNames> = BaseApiHandler<WindowApiSurface[TName]>;

type WindowApiParams<TName extends WindowApiNames> = BaseApiParams<WindowApiSurface[TName]>;

export type WindowApiMessageAny = {[name in WindowApiNames]: WindowApiMessage<name>}[WindowApiNames];

type WindowApiMessage<TName extends WindowApiNames> = {
    action: TName;
    params: WindowApiParams<TName>;
};

export type WindowApiFrameClientMessageAny = {[name in WindowApiNames]: FrameClientMessage<WindowApiMessage<name>>}[WindowApiNames];
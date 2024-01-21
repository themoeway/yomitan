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

import type * as Anki from './anki';
import type * as AnkiNoteBuilder from './anki-note-builder';
import type * as Audio from './audio';
import type * as AudioDownloader from './audio-downloader';
import type * as Backend from './backend';
import type * as Core from './core';
import type * as Dictionary from './dictionary';
import type * as DictionaryDatabase from './dictionary-database';
import type * as DictionaryImporter from './dictionary-importer';
import type * as Environment from './environment';
import type * as Extension from './extension';
import type * as Log from './log';
import type * as Settings from './settings';
import type * as SettingsModifications from './settings-modifications';
import type * as Translation from './translation';
import type * as Translator from './translator';
import type {ApiMessageNoFrameIdAny as ApplicationApiMessageNoFrameIdAny} from './application';
import type {
    ApiMap as BaseApiMap,
    ApiMapInit as BaseApiMapInit,
    ApiHandler as BaseApiHandler,
    ApiParams as BaseApiParams,
    ApiReturn as BaseApiReturn,
    ApiNames as BaseApiNames,
    ApiParam as BaseApiParam,
    ApiParamNames as BaseApiParamNames,
    ApiParamsAny as BaseApiParamsAny,
} from './api-map';

export type FindTermsDetails = {
    matchType?: Translation.FindTermsMatchType;
    deinflect?: boolean;
};

export type ParseTextResultItem = {
    id: string;
    source: 'scanning-parser' | 'mecab';
    dictionary: null | string;
    content: ParseTextLine[];
};

export type ParseTextSegment = {
    text: string;
    reading: string;
};

export type ParseTextLine = ParseTextSegment[];

export type InjectAnkiNoteMediaTermDefinitionDetails = {
    type: 'term';
    term: string;
    reading: string;
};

export type InjectAnkiNoteMediaKanjiDefinitionDetails = {
    type: 'kanji';
    character: string;
};

export type InjectAnkiNoteMediaDefinitionDetails = InjectAnkiNoteMediaTermDefinitionDetails | InjectAnkiNoteMediaKanjiDefinitionDetails;

export type InjectAnkiNoteMediaAudioDetails = AnkiNoteBuilder.AudioMediaOptions;

export type InjectAnkiNoteMediaScreenshotDetails = {
    tabId: number;
    frameId: number;
    format: Settings.AnkiScreenshotFormat;
    quality: number;
};

export type InjectAnkiNoteMediaClipboardDetails = {
    image: boolean;
    text: boolean;
};

export type InjectAnkiNoteMediaDictionaryMediaDetails = {
    dictionary: string;
    path: string;
};

export type InjectAnkiNoteDictionaryMediaResult = {
    dictionary: string;
    path: string;
    fileName: string | null;
};

export type GetMediaDetailsTarget = {
    path: string;
    dictionary: string;
};

export type GetTermFrequenciesDetailsTermReadingListItem = {
    term: string;
    reading: string | null;
};

type ApiSurface = {
    applicationReady: {
        params: void;
        return: void;
    };
    optionsGet: {
        params: {
            optionsContext: Settings.OptionsContext;
        };
        return: Settings.ProfileOptions;
    };
    optionsGetFull: {
        params: void;
        return: Settings.Options;
    };
    termsFind: {
        params: {
            text: string;
            details: FindTermsDetails;
            optionsContext: Settings.OptionsContext;
        };
        return: {
            dictionaryEntries: Dictionary.TermDictionaryEntry[];
            originalTextLength: number;
        };
    };
    parseText: {
        params: {
            text: string;
            optionsContext: Settings.OptionsContext;
            scanLength: number;
            useInternalParser: boolean;
            useMecabParser: boolean;
        };
        return: ParseTextResultItem[];
    };
    kanjiFind: {
        params: {
            text: string;
            optionsContext: Settings.OptionsContext;
        };
        return: Dictionary.KanjiDictionaryEntry[];
    };
    isAnkiConnected: {
        params: void;
        return: boolean;
    };
    getAnkiConnectVersion: {
        params: void;
        return: number | null;
    };
    addAnkiNote: {
        params: {
            note: Anki.Note;
        };
        return: Anki.NoteId | null;
    };
    getAnkiNoteInfo: {
        params: {
            notes: Anki.Note[];
            fetchAdditionalInfo: boolean;
        };
        return: Anki.NoteInfoWrapper[];
    };
    injectAnkiNoteMedia: {
        params: {
            timestamp: number;
            definitionDetails: InjectAnkiNoteMediaDefinitionDetails;
            audioDetails: InjectAnkiNoteMediaAudioDetails | null;
            screenshotDetails: InjectAnkiNoteMediaScreenshotDetails | null;
            clipboardDetails: InjectAnkiNoteMediaClipboardDetails | null;
            dictionaryMediaDetails: InjectAnkiNoteMediaDictionaryMediaDetails[];
        };
        return: {
            screenshotFileName: string | null;
            clipboardImageFileName: string | null;
            clipboardText: string | null;
            audioFileName: string | null;
            dictionaryMedia: InjectAnkiNoteDictionaryMediaResult[];
            errors: Core.SerializedError[];
        };
    };
    noteView: {
        params: {
            noteId: Anki.NoteId;
            mode: Settings.AnkiNoteGuiMode;
            allowFallback: boolean;
        };
        return: Settings.AnkiNoteGuiMode;
    };
    suspendAnkiCardsForNote: {
        params: {
            noteId: Anki.NoteId;
        };
        return: number;
    };
    getTermAudioInfoList: {
        params: {
            source: Audio.AudioSourceInfo;
            term: string;
            reading: string;
        };
        return: AudioDownloader.Info[];
    };
    commandExec: {
        params: {
            command: string;
            params?: Core.SerializableObject;
        };
        return: boolean;
    };
    sendMessageToFrame: {
        params: {
            frameId: number;
            message: ApplicationApiMessageNoFrameIdAny;
        };
        return: boolean;
    };
    broadcastTab: {
        params: {
            message: ApplicationApiMessageNoFrameIdAny;
        };
        return: boolean;
    };
    frameInformationGet: {
        params: void;
        return: Extension.ContentOrigin;
    };
    injectStylesheet: {
        params: {
            type: 'file' | 'code';
            value: string;
        };
        return: void;
    };
    getStylesheetContent: {
        params: {
            url: string;
        };
        return: string;
    };
    getEnvironmentInfo: {
        params: void;
        return: Environment.Info;
    };
    clipboardGet: {
        params: void;
        return: string;
    };
    getDisplayTemplatesHtml: {
        params: void;
        return: string;
    };
    getZoom: {
        params: void;
        return: {
            zoomFactor: number;
        };
    };
    getDefaultAnkiFieldTemplates: {
        params: void;
        return: string;
    };
    getDictionaryInfo: {
        params: void;
        return: DictionaryImporter.Summary[];
    };
    purgeDatabase: {
        params: void;
        return: void;
    };
    getMedia: {
        params: {
            targets: GetMediaDetailsTarget[];
        };
        return: DictionaryDatabase.MediaDataStringContent[];
    };
    log: {
        params: {
            error: Core.SerializedError;
            level: Log.LogLevel;
            context: Log.LogContext | undefined;
        };
        return: void;
    };
    logIndicatorClear: {
        params: void;
        return: void;
    };
    modifySettings: {
        params: {
            targets: SettingsModifications.ScopedModification[];
            source: string;
        };
        return: Core.Response<SettingsModifications.ModificationResult>[];
    };
    getSettings: {
        params: {
            targets: SettingsModifications.ScopedRead[];
        };
        return: Core.Response<SettingsModifications.ModificationResult>[];
    };
    setAllSettings: {
        params: {
            value: Settings.Options;
            source: string;
        };
        return: void;
    };
    getOrCreateSearchPopup: {
        params: {
            focus?: boolean | 'ifCreated';
            text?: string;
        };
        return: {
            tabId: number | null;
            windowId: number;
        };
    };
    isTabSearchPopup: {
        params: {
            tabId: number;
        };
        return: boolean;
    };
    triggerDatabaseUpdated: {
        params: {
            type: Backend.DatabaseUpdateType;
            cause: Backend.DatabaseUpdateCause;
        };
        return: void;
    };
    testMecab: {
        params: void;
        return: true;
    };
    textHasJapaneseCharacters: {
        params: {
            text: string;
        };
        return: boolean;
    };
    getTermFrequencies: {
        params: {
            termReadingList: GetTermFrequenciesDetailsTermReadingListItem[];
            dictionaries: string[];
        };
        return: Translator.TermFrequencySimple[];
    };
    findAnkiNotes: {
        params: {
            query: string;
        };
        return: Anki.NoteId[];
    };
    openCrossFramePort: {
        params: {
            targetTabId: number;
            targetFrameId: number;
        };
        return: {
            targetTabId: number;
            targetFrameId: number;
        };
    };
    requestBackendReadySignal: {
        params: void;
        return: boolean;
    };
};

type ApiExtraArgs = [sender: chrome.runtime.MessageSender];

export type ApiNames = BaseApiNames<ApiSurface>;

export type ApiMap = BaseApiMap<ApiSurface, ApiExtraArgs>;

export type ApiMapInit = BaseApiMapInit<ApiSurface, ApiExtraArgs>;

export type ApiHandler<TName extends ApiNames> = BaseApiHandler<ApiSurface[TName], ApiExtraArgs>;

export type ApiHandlerNoExtraArgs<TName extends ApiNames> = BaseApiHandler<ApiSurface[TName], []>;

export type ApiParams<TName extends ApiNames> = BaseApiParams<ApiSurface[TName]>;

export type ApiParam<TName extends ApiNames, TParamName extends BaseApiParamNames<ApiSurface[TName]>> = BaseApiParam<ApiSurface[TName], TParamName>;

export type ApiReturn<TName extends ApiNames> = BaseApiReturn<ApiSurface[TName]>;

export type ApiParamsAny = BaseApiParamsAny<ApiSurface>;

export type ApiMessageAny = {[name in ApiNames]: ApiMessage<name>}[ApiNames];

type ApiMessage<TName extends ApiNames> = {
    action: TName;
    params: ApiParams<TName>;
};

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

import type * as Dictionary from './dictionary';
import type * as DictionaryDatabase from './dictionary-database';
import type * as DictionaryImporter from './dictionary-importer';
import type * as Environment from './environment';
import type * as Translation from './translation';
import type * as Translator from './translator';
import type {
    ApiMap as BaseApiMap,
    ApiMapInit as BaseApiMapInit,
    ApiHandler as BaseApiHandler,
    ApiParams as BaseApiParams,
    ApiReturn as BaseApiReturn,
    ApiNames as BaseApiNames,
} from './api-map';
import type {LanguageTransformDescriptor} from './language-transformer';

type ApiSurface = {
    databasePrepareOffscreen: {
        params: void;
        return: void;
    };
    getDictionaryInfoOffscreen: {
        params: void;
        return: DictionaryImporter.Summary[];
    };
    databasePurgeOffscreen: {
        params: void;
        return: boolean;
    };
    databaseGetMediaOffscreen: {
        params: {
            targets: DictionaryDatabase.MediaRequest[];
        };
        return: DictionaryDatabase.Media<string>[];
    };
    databaseGetMediaObjectsOffscreen: {
        params: {
            targets: DictionaryDatabase.MediaRequest[];
        };
        return: DictionaryDatabase.MediaObject<string>[];
    };
    translatorPrepareOffscreen: {
        params: {
            descriptor: LanguageTransformDescriptor;
        };
        return: void;
    };
    findKanjiOffscreen: {
        params: {
            text: string;
            options: FindKanjiOptionsOffscreen;
        };
        return: Dictionary.KanjiDictionaryEntry[];
    };
    findTermsOffscreen: {
        params: {
            mode: Translator.FindTermsMode;
            text: string;
            options: FindTermsOptionsOffscreen;
        };
        return: Translator.FindTermsResult;
    };
    getTermFrequenciesOffscreen: {
        params: {
            termReadingList: Translator.TermReadingList;
            dictionaries: string[];
        };
        return: Translator.TermFrequencySimple[];
    };
    clearDatabaseCachesOffscreen: {
        params: void;
        return: void;
    };
    clipboardSetBrowserOffscreen: {
        params: {
            value: Environment.Browser | null;
        };
        return: void;
    };
    clipboardGetTextOffscreen: {
        params: {
            useRichText: boolean;
        };
        return: string;
    };
    clipboardGetImageOffscreen: {
        params: void;
        return: string | null;
    };
};

export type ApiMessage<TName extends ApiNames> = (
    ApiParams<TName> extends void ?
        {action: TName, params?: never} :
        {action: TName, params: ApiParams<TName>}
);

export type ApiNames = BaseApiNames<ApiSurface>;

export type FindKanjiOptionsOffscreen = Omit<Translation.FindKanjiOptions, 'enabledDictionaryMap'> & {
    enabledDictionaryMap: [
        key: string,
        options: Translation.FindKanjiDictionary,
    ][];
};

export type FindTermsOptionsOffscreen = Omit<Translation.FindTermsOptions, 'enabledDictionaryMap' | 'excludeDictionaryDefinitions' | 'textReplacements'> & {
    enabledDictionaryMap: [
        key: string,
        options: Translation.FindTermDictionary,
    ][];
    excludeDictionaryDefinitions: string[] | null;
    textReplacements: (FindTermsTextReplacementOffscreen[] | null)[];
};

export type FindTermsTextReplacementOffscreen = Omit<Translation.FindTermsTextReplacement, 'pattern'> & {
    pattern: string;
};

export type ApiMap = BaseApiMap<ApiSurface>;

export type ApiMapInit = BaseApiMapInit<ApiSurface>;

export type ApiHandler<TName extends ApiNames> = BaseApiHandler<ApiSurface[TName]>;

export type ApiParams<TName extends ApiNames> = BaseApiParams<ApiSurface[TName]>;

export type ApiReturn<TName extends ApiNames> = BaseApiReturn<ApiSurface[TName]>;

export type ApiMessageAny = {[name in ApiNames]: ApiMessage<name>}[ApiNames];

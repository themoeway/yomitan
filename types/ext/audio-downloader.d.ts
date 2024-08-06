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

import type * as Audio from './audio';
import type * as Language from './language';

export type GetInfoHandler = (
    term: string,
    reading: string,
    details: Audio.AudioSourceInfo,
    languageSummary: Language.LanguageSummary,
) => Promise<Info[]>;

export type Info = Info1 | Info2;

export type Info1 = {
    type: 'url';
    url: string;
    name?: string;
};

export type Info2 = {
    type: 'tts';
    text: string;
    voice: string;
    name?: undefined;
};

export type AudioBinaryBase64 = {
    data: string;
    contentType: string | null;
};

export type CustomAudioList = {
    type: 'audioSourceList';
    audioSources: CustomAudioListSource[];
};

export type CustomAudioListSource = {
    url: string;
    name?: string;
};

export type WikimediaCommonsLookupResponse = {
    query: {
        search: WikimediaCommonsLookupResult[];
    };
};

export type WikimediaCommonsFileResponse = {
    query: {
        pages: Record<string, WikimediaCommonsFileResult>;
    };
};

export type WikimediaCommonsLookupResult = {
    title: string;
};

export type WikimediaCommonsFileResult = {
    title: string;
    imageinfo: WikimediaCommonsFileResultImageInfo[];
};

export type WikimediaCommonsFileResultImageInfo = {
    url: string;
    user: string;
};

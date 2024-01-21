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

import type * as Core from './core';
import type * as DictionaryDatabase from './dictionary-database';
import type * as DictionaryImporter from './dictionary-importer';

export type InvokeDetails<TResponseRaw = unknown, TResponse = unknown> = {
    complete: boolean;
    worker: Worker | null;
    resolve: ((result: TResponse) => void) | null;
    reject: ((reason?: Core.RejectionReason) => void) | null;
    onMessage: ((event: MessageEvent<MessageData<TResponseRaw>>) => void) | null;
    onProgress: ((...args: unknown[]) => void) | null;
    formatResult: ((result: TResponseRaw) => TResponse) | null;
};

export type MessageCompleteData<TResponseRaw = unknown> = {
    action: 'complete';
    params: MessageCompleteParams<TResponseRaw>;
};

export type MessageProgressData = {
    action: 'progress';
    params: MessageProgressParams;
};

export type MessageGetImageDetailsData = {
    action: 'getImageDetails';
    params: MessageGetImageDetailsParams;
};

export type MessageCompleteParams<TResponseRaw = unknown> = Core.Response<TResponseRaw>;

export type MessageProgressParams = {
    args: unknown[];
};

export type MessageGetImageDetailsParams = {
    id: string;
    content: ArrayBuffer;
    mediaType: string;
};

export type MessageData<TResponseRaw = unknown> = MessageCompleteData<TResponseRaw> | MessageProgressData | MessageGetImageDetailsData;

export type MessageCompleteResultSerialized = {
    result: DictionaryImporter.Summary;
    errors: Core.SerializedError[];
};

export type MessageCompleteResult = {
    result: DictionaryImporter.Summary;
    errors: Error[];
};

export type ImportProgressCallback = (details: DictionaryImporter.ProgressData) => void;

export type DeleteProgressCallback = (details: DictionaryDatabase.DeleteDictionaryProgressData) => void;

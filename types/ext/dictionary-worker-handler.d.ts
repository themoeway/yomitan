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

import type * as DictionaryImporter from './dictionary-importer';
import type * as DictionaryWorkerMediaLoader from './dictionary-worker-media-loader';

export type OnProgressCallback = (...args: unknown[]) => void;

export type Message = (
    ImportDictionaryMessage |
    DeleteDictionaryMessage |
    GetDictionaryCountsMessage |
    GetImageDetailsResponseMessage
);

export type ImportDictionaryMessage = {
    action: 'importDictionary';
    params: ImportDictionaryMessageParams;
};

export type ImportDictionaryMessageParams = {
    details: DictionaryImporter.ImportDetails;
    archiveContent: ArrayBuffer;
};

export type DeleteDictionaryMessage = {
    action: 'deleteDictionary';
    params: DeleteDictionaryMessageParams;
};

export type DeleteDictionaryMessageParams = {
    dictionaryTitle: string;
};

export type GetDictionaryCountsMessage = {
    action: 'getDictionaryCounts';
    params: GetDictionaryCountsMessageParams;
};

export type GetDictionaryCountsMessageParams = {
    dictionaryNames: string[];
    getTotal: boolean;
};

export type GetImageDetailsResponseMessage = {
    action: 'getImageDetails.response';
    params: DictionaryWorkerMediaLoader.HandleMessageParams;
};

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

import type * as Api from './api';

export type DatabaseUpdateType = 'dictionary';

export type DatabaseUpdateCause = 'delete' | 'import' | 'purge';

export type MecabParseResults = [
    dictionary: string,
    content: Api.ParseTextLine[],
][];

export type TabInfo = {
    tab: chrome.tabs.Tab;
    url: null | string;
};

export type FindTabsPredicate = (tabInfo: TabInfo) => boolean | Promise<boolean>;

export type CanAddResults = {
    canAddArray: {isDuplicate: boolean, note: import('anki').Note}[];
    cannotAddArray: import('anki').Note[];
};

export type Mode = 'existingOrNewTab' | 'newTab' | 'popup';

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
import type * as Settings from './settings';

export type NoteId = number;

export type CardId = number;

export type Note = {
    fields: NoteFields;
    tags: string[];
    deckName: string;
    modelName: string;
    options: {
        allowDuplicate: boolean;
        duplicateScope: Settings.AnkiDuplicateScope;
        duplicateScopeOptions: {
            deckName: string | null;
            checkChildren: boolean;
            checkAllModels: boolean;
        };
    };
};

export type NoteFields = {
    [field: string]: string;
};

export type NoteInfoWrapper = {
    canAdd: boolean;
    valid: boolean;
    noteIds: NoteId[] | null;
    noteInfos?: (NoteInfo | null)[];
};

export type NoteInfo = {
    noteId: NoteId;
    tags: string[];
    fields: {[key: string]: NoteFieldInfo};
    modelName: string;
    cards: CardId[];
};

export type NoteFieldInfo = {
    value: string;
    order: number;
};

export type ApiReflectResult = {
    scopes: string[];
    actions: string[];
};

export type MessageBody = {
    action: string;
    params: Core.SerializableObject;
    version: number;
    key?: string;
};

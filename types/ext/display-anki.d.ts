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
import type * as AnkiTemplates from './anki-templates';
import type * as AnkiTemplatesInternal from './anki-templates-internal';

export type CreateMode = AnkiTemplatesInternal.CreateModeNoTest;

export type LogData = {
    ankiNoteData: AnkiTemplates.NoteData | undefined;
    ankiNoteDataException: Error | undefined;
    ankiNotes: AnkiNoteLogData[];
};

export type AnkiNoteLogData = {
    mode: CreateMode;
    note: Anki.Note | undefined;
    errors?: Error[];
    requirements?: AnkiNoteBuilder.Requirement[];
};

export type DictionaryEntryDetails = {
    modeMap: Map<CreateMode, DictionaryEntryModeDetails>;
};

export type DictionaryEntryModeDetails = {
    mode: CreateMode;
    note: Anki.Note;
    errors: Error[];
    requirements: AnkiNoteBuilder.Requirement[];
    canAdd: boolean;
    valid: boolean;
    noteIds: Anki.NoteId[] | null;
    noteInfos?: (Anki.NoteInfo | null)[];
    ankiError: Error | null;
};

export type CreateNoteResult = {
    note: Anki.Note;
    errors: Error[];
    requirements: AnkiNoteBuilder.Requirement[];
};

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

export type Manifest = chrome.runtime.Manifest;

export type ManifestConfig = {
    manifest: Manifest;
    defaultVariant: string;
    variants: ManifestVariant[];
};

export type ManifestVariant = {
    name: string;
    buildable?: boolean;
    inherit?: string;
    fileName?: string;
    fileCopies?: string[];
    excludeFiles?: string[];
    modifications?: Modification[];
};

export type Modification = (
    ModificationReplace |
    ModificationDelete |
    ModificationSet |
    ModificationAdd |
    ModificationRemove |
    ModificationSplice |
    ModificationCopy |
    ModificationMove
);

export type ModificationReplace = {
    action: 'replace';
    path: PropertyPath;
    pattern: string;
    patternFlags: string;
    replacement: string;
};

export type ModificationDelete = {
    action: 'delete';
    path: PropertyPath;
};

export type ModificationSet = {
    action: 'set';
    path: PropertyPath;
    value: unknown;
    before?: string;
    after?: string;
    index?: number;
    command?: Command;
};

export type ModificationAdd = {
    action: 'add';
    path: PropertyPath;
    items: unknown[];
};

export type ModificationRemove = {
    action: 'remove';
    path: PropertyPath;
    item: unknown;
};

export type ModificationSplice = {
    action: 'splice';
    path: PropertyPath;
    start: number;
    deleteCount: number;
    items: unknown[];
};

export type ModificationCopy = {
    action: 'copy';
    path: PropertyPath;
    newPath: PropertyPath;
    before?: string;
    after?: string;
    index?: number;
};

export type ModificationMove = {
    action: 'move';
    path: PropertyPath;
    newPath: PropertyPath;
    before?: string;
    after?: string;
    index?: number;
};

export type PropertyPath = (string | number)[];

export type Command = {
    command: string;
    args: string[];
    trim: boolean;
};

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

import type * as TaskAccumulator from './task-accumulator';

export type CreateElementMetadataCallback<T = unknown> = (element: Element) => T | undefined;

export type CompareElementMetadataCallback<T = unknown> = (metadata1: T, metadata2: T) => boolean;

export type GetValuesCallback<T = unknown> = (args: GetValuesDetails<T>[]) => Promise<TaskResult[]>;

export type SetValuesCallback<T = unknown> = (args: SetValuesDetails<T>[]) => Promise<TaskResult[]>;

export type GetValuesDetails<T = unknown> = {
    element: Element;
    metadata: T;
};

export type SetValuesDetails<T = unknown> = {
    element: Element;
    metadata: T;
    value: ValueType;
};

export type OnErrorCallback<T = unknown> = (error: Error, stale: boolean, element: Element, metadata: T) => void;

export type ElementObserver<T = unknown> = {
    element: Element;
    eventType: EventType;
    hasValue: boolean;
    metadata: T;
    onChange: (() => void) | null;
    type: NormalizedElementType;
    value: unknown;
};

export type SettingChangedEventData = {
    value: boolean | number | string;
};

export type SettingChangedEvent = CustomEvent<SettingChangedEventData>;

export type NormalizedElementType = 'checkbox' | 'element' | 'number' | 'select' | 'text' | 'textarea';

export type EventType = 'change';

export type UpdateTaskValue = {all: boolean};

export type AssignTaskValue = {value: ValueType};

export type ValueType = boolean | null | number | string;

export type UpdateTask<T = unknown> = [
    key: ElementObserver<T> | null,
    task: TaskAccumulator.Task<UpdateTaskValue>,
];

export type AssignTask<T = unknown> = [
    key: ElementObserver<T> | null,
    task: TaskAccumulator.Task<AssignTaskValue>,
];

export type ApplyTarget<T = unknown> = [
    observer: ElementObserver<T>,
    task: null | TaskAccumulator.Task<AssignTaskValue> | TaskAccumulator.Task<UpdateTaskValue>,
];

export type TaskResultError = {
    error: Error;
    result?: undefined;
};

export type TaskResultSuccess<T = unknown> = {
    error?: undefined;
    result: T;
};

export type TaskResult<T = unknown> = TaskResultError | TaskResultSuccess<T>;

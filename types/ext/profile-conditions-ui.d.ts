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

import type * as Settings from './settings';
import type {EventNames, EventArgument as BaseEventArgument} from './core';

export type Events = {
    conditionGroupCountChanged: {
        count: number;
        profileIndex: number;
    };
};

export type EventArgument<TName extends EventNames<Events>> = BaseEventArgument<Events, TName>;

export type DescriptorType = Settings.ProfileConditionType;

export type Descriptor = {
    displayName: string;
    defaultOperator: string;
    operators: Map<string, OperatorInternal>;
};

export type ValidateFunction = (value: string) => boolean;

export type NormalizeFunction = (value: unknown) => string;

export type OperatorInternal = {
    displayName: string;
    type: string;
    defaultValue: string;
    resetDefaultOnChange?: boolean;
    validate?: ValidateFunction;
    normalize?: NormalizeFunction;
};

export type Operator = {
    displayName: string;
    type: string;
    defaultValue: string;
    resetDefaultOnChange: boolean | null;
    validate: ValidateFunction | null;
    normalize: NormalizeFunction | null;
};

export type DescriptorInfo = {
    name: DescriptorType;
    displayName: string;
};

export type OperatorInfo = {
    name: string;
    displayName: string;
};

export type InputData = {
    validate: ValidateFunction | null;
    normalize: NormalizeFunction | null;
};

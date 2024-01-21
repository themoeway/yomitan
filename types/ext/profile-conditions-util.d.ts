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

import type * as JsonSchema from './json-schema';
import type * as Settings from './settings';

export type OperatorMapArray = [
    key: string,
    function: CreateSchemaFunction,
][];

export type CreateSchemaFunction = (
    value: unknown,
) => JsonSchema.Schema;

export type NormalizedOptionsContext1 = Settings.OptionsContext1 & {
    domain?: string;
};

export type NormalizedOptionsContext2 = Settings.OptionsContext2;

export type NormalizedOptionsContext3 = Settings.OptionsContext2;

export type NormalizedOptionsContext = NormalizedOptionsContext1 | NormalizedOptionsContext2 | NormalizedOptionsContext3;

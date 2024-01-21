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

export type ValueObject = {[key: string]: Value};

export type Value = string | number | boolean | null | Value[] | ValueObject;

export type ValueObjectOrArray = ValueObject | Value[];

export type Type = 'string' | 'number' | 'integer' | 'object' | 'array' | 'boolean' | 'null';

export type SchemaObject = {
    type?: Type | Type[];
    required?: string[];

    default?: Value;
    enum?: Value[];
    const?: Value;
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    multipleOf?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    patternFlags?: string;
    minItems?: number;
    maxItems?: number;
    minProperties?: number;
    maxProperties?: number;
    definitions?: {[key: string]: Schema};

    $ref?: string;

    properties?: {[key: string]: Schema};
    additionalProperties?: Schema;
    not?: Schema;
    oneOf?: Schema[];
    allOf?: Schema[];
    anyOf?: Schema[];
    contains?: Schema;
    prefixItems?: Schema[];
    items?: Schema | Schema[]; // Legacy schema format for the array
    additionalItems?: Schema;
    if?: Schema;
    then?: Schema;
    else?: Schema;
};

export type Schema = SchemaObject | true | false;

export type SchemaStackItem = {
    schema: Schema | Schema[];
    path: string | number | null;
};

export type ValueStackItem = {
    value: unknown;
    path: string | number | null;
};

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

import type * as SchemaValidate from './schema-validate';

export type Schema = SchemaValidate.Schema;

export type Schemas = {
    index: Schema;
    kanjiBankV1: Schema;
    kanjiBankV3: Schema;
    kanjiMetaBankV3: Schema;
    tagBankV3: Schema;
    termBankV1: Schema;
    termBankV3: Schema;
    termMetaBankV3: Schema;
};

/**
 * An array of tuples of a regular expression for file types inside a dictionary and its corresponding schema.
 */
export type SchemasDetails = [fileNameFormat: RegExp, schema: unknown][];

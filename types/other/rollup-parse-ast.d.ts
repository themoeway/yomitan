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

// Patch for type definitions that aren't exported for rollup/parseAst
// https://github.com/vitest-dev/vitest/issues/4567
// https://github.com/rollup/rollup/issues/5199

import type {ParseAst, ParseAstAsync} from 'rollup';

export const parseAst: ParseAst;
export const parseAstAsync: ParseAstAsync;

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

/**
 * An enum representing the attributes of the character.
 * This enum is a number enum for more efficient usage in a highly-traversed code path.
 * - `0` - Character should be ignored.
 * - `1` - Character is collapsible whitespace.
 * - `2` - Character should be added to the content.
 * - `3` - Character should be added to the content and is a newline.
 */
export type CharacterAttributes = 0 | 1 | 2 | 3;

/**
 * Seek information about an element.
 * The `enterable` value indicates whether the content of this node should be entered.
 * The `newlines` value corresponds to the number of newline characters that should be added.
 * - 1 newline corresponds to a simple new line in the layout.
 * - 2 newlines corresponds to a significant visual distinction since the previous content.
 */
export type ElementSeekInfo = {
    enterable: boolean;
    newlines: number;
};

/**
 * Information about the whitespace.
 * `preserveNewlines` indicates whether or not newline characters are treated as line breaks.
 * `preserveWhitespace` indicates whether or not sequences of whitespace characters are collapsed.
 */
export type WhitespaceSettings = {
    preserveNewlines: boolean;
    preserveWhitespace: boolean;
};

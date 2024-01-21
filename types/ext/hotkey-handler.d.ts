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

import type {ModifierKey} from './input';
import type {EventNames, EventArgument as BaseEventArgument} from './core';

export type HotkeyInfo = {
    modifiers: Set<ModifierKey>;
    action: string;
    argument: unknown;
};

export type HotkeyHandlers = {
    handlers: HotkeyInfo[];
};

export type Events = {
    keydownNonHotkey: KeyboardEvent;
};

export type EventArgument<TName extends EventNames<Events>> = BaseEventArgument<Events, TName>;

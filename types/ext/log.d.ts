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

import type {EventNames, EventArgument as BaseEventArgument} from './core';

export type LogLevel = 'log' | 'info' | 'debug' | 'warn' | 'error';

export type LogContext = {
    url: string;
};

/**
 * An enum representing the log error level.
 * - `0` - _log_, _info_, _debug_ level.
 * - `1` - _warn_ level.
 * - `2` - _error_ level.
 */
export type LogErrorLevelValue = 0 | 1 | 2;

export type Events = {
    log: {
        error: unknown;
        level: LogLevel;
        context: LogContext;
    };
};

export type EventArgument<TName extends EventNames<Events>> = BaseEventArgument<Events, TName>;

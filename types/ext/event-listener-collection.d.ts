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

import type * as Core from './core';

export type EventListenerFunction = (...args: Core.SafeAny[]) => unknown;

export type EventTarget = {
    addEventListener(
        type: string,
        listener: EventListener | EventListenerObject | EventListenerFunction,
        options?: AddEventListenerOptions | boolean,
    ): void;
    removeEventListener(
        type: string,
        listener: EventListener | EventListenerObject | EventListenerFunction,
        options?: EventListenerOptions | boolean,
    ): void;
};

export type ExtensionEvent<TCallback = EventListenerFunction, TArgs = unknown> = {
    addListener(callback: TCallback, ...args: TArgs[]): void;
    removeListener(callback: TCallback, ...args: TArgs[]): void;
};

export type EventTargetDetails = {
    type: 'removeEventListener';
    target: EventTarget;
    eventName: string;
    listener: EventListener | EventListenerObject | EventListenerFunction;
    options: EventListenerOptions | boolean | undefined;
};

export type ExtensionEventDetails = {
    type: 'removeListener';
    target: ExtensionEvent;
    callback: EventListenerFunction;
    args: unknown[];
};

export type EventDispatcherDetails = {
    type: 'off';
    target: Core.EventDispatcherOffGeneric;
    eventName: string;
    callback: EventListenerFunction;
};

export type EventListenerDetails = EventTargetDetails | ExtensionEventDetails | EventDispatcherDetails;

export type AddEventListenerArgs = [
    target: EventTarget,
    type: string,
    listener: EventListener | EventListenerObject | EventListenerFunction,
    options?: AddEventListenerOptions | boolean,
];

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

export type TypeofResult = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function';

/** This type is used as an explicit way of permitting the `any` type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SafeAny = any;

/** This type is used as an explicit way of permitting the `Function` type. */
// eslint-disable-next-line @typescript-eslint/ban-types
export type SafeFunction = Function;

/** This type is used as an explicit way of permitting the `any` type. */
export type RejectionReason = SafeAny;

/** This type is used as an explicit way of permitting the `object` type. */
export type SerializableObject = {[key: string]: unknown};

/** This type is used as an explicit way of permitting the `object` type. */
export type SerializableObjectAny = {[key: string]: SafeAny};

/** This type is used as an explicit way of permitting the `object` type. */
export type UnknownObject = {[key: string | symbol]: unknown};

export type TokenString = string;

export type TokenObject = Record<string, never>;

export type DeferredPromiseDetails<T = unknown> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: RejectionReason) => void;
};

export type SerializedError1 = {
    name: string;
    message: string;
    stack: string;
    data?: unknown;
    hasValue?: undefined;
};

export type SerializedError2 = {
    value: unknown;
    hasValue: true;
};

export type SerializedError = SerializedError1 | SerializedError2;

export type ResponseSuccess<T = unknown> = {
    result: T;
    error?: undefined;
};

export type ResponseError = {
    error: SerializedError;
    result?: undefined;
};

export type Response<T = unknown> = ResponseSuccess<T> | ResponseError;

export type Timeout = number | NodeJS.Timeout;

export type EventSurface = {[name: string]: unknown};

export type EventNames<TSurface extends EventSurface> = keyof TSurface & string;

export type EventArgument<TSurface extends EventSurface, TName extends EventNames<TSurface>> = TSurface[TName];

export type EventDispatcherOffGeneric = {
    off(eventName: string, callback: (...args: SafeAny) => void): boolean;
};

export type EventHandler<TSurface extends EventSurface, TName extends EventNames<TSurface>> = (details: EventArgument<TSurface, TName>) => void;

export type EventHandlerAny = (details: SafeAny) => void;

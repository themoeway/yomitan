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
 * This type describes the structure of an API surface.
 * It is effectively just an object containing a list of items which describe a basic API functionality.
 */
type ApiSurface = {
    [name: string]: ApiDescriptor;
};

/**
 * This type describes the structure of a single API function.
 */
type ApiDescriptor = {
    /** The parameters for the function. If there are no parameters, `void` should be used. */
    params: void | {[name: string]: unknown};
    /** The return type for the function. */
    return: unknown;
};

/**
 * This type represents a mapping of an entire API surface to its handlers.
 */
type ApiHandlerSurface<TSurface extends ApiSurface, TExtraParams extends ApiTExtraParams> = {
    [name in ApiNames<TSurface>]: ApiHandler<TSurface[name], TExtraParams>;
};

/**
 * This type represents a single API map initializer.
 * Type safety is enforced by ensuring that the name and handler signature are valid.
 */
type ApiMapInitItem<TSurface extends ApiSurface, TExtraParams extends ApiTExtraParams, TName extends ApiNames<TSurface>> = [
    name: TName,
    handler: ApiHandler<TSurface[TName], TExtraParams>,
];

/**
 * This type represents a union of all API map initializers for a given surface.
 */
type ApiMapInitItemAny<TSurface extends ApiSurface, TExtraParams extends ApiTExtraParams> = {[key in ApiNames<TSurface>]: ApiMapInitItem<TSurface, TExtraParams, key>}[ApiNames<TSurface>];

/** Base type for extra params, which is just a generic array. */
type ApiTExtraParams = unknown[];

/** Default type for extra params, which is an empty array. */
type ApiExtraParamsDefault = [];

/** Type alias for the params member of a descriptor. */
export type ApiParams<TDescriptor extends ApiDescriptor> = TDescriptor['params'];

/** Type alias for a single param of a descriptor. */
export type ApiParam<TDescriptor extends ApiDescriptor, TParamName extends ApiParamNames<TDescriptor>> = ApiParams<TDescriptor>[TParamName];

/** Type alias for the union of parameter names in a descriptor. */
export type ApiParamNames<TDescriptor extends ApiDescriptor> = keyof ApiParams<TDescriptor>;

/** Type alias for a tuple of parameter types for a descriptor. */
export type ApiOrderedParams<TDescriptor extends ApiDescriptor, TParamNames extends ApiParamNames<TDescriptor>[]> = {
    [index in keyof TParamNames]: ApiParams<TDescriptor>[TParamNames[index]];
};

/** Type alias for the return member of a descriptor. */
export type ApiReturn<TDescriptor extends ApiDescriptor> = TDescriptor['return'];

/** A type representing a synchronous handler. */
export type ApiHandlerSync<TDescriptor extends ApiDescriptor, TExtraParams extends ApiTExtraParams = ApiExtraParamsDefault> = (params: ApiParams<TDescriptor>, ...extraParams: TExtraParams) => ApiReturn<TDescriptor>;

/** A type representing an asynchronous handler. */
export type ApiHandlerAsync<TDescriptor extends ApiDescriptor, TExtraParams extends ApiTExtraParams = ApiExtraParamsDefault> = (params: ApiParams<TDescriptor>, ...extraParams: TExtraParams) => Promise<ApiReturn<TDescriptor>>;

/** A type representing a generic handler. */
export type ApiHandler<TDescriptor extends ApiDescriptor, TExtraParams extends ApiTExtraParams = ApiExtraParamsDefault> = (params: ApiParams<TDescriptor>, ...extraParams: TExtraParams) => ApiReturn<TDescriptor> | Promise<ApiReturn<TDescriptor>>;

/** A union of all of the handlers for a given surface. */
export type ApiHandlerAny<TSurface extends ApiSurface, TExtraParams extends ApiTExtraParams = ApiExtraParamsDefault> = ApiHandlerSurface<TSurface, TExtraParams>[ApiNames<TSurface>];

/** A union of all of the names for a given surface. */
export type ApiNames<TSurface extends ApiSurface> = keyof TSurface;

/** A mapping of names to the corresponding handler function. */
export type ApiMap<TSurface extends ApiSurface, TExtraParams extends ApiTExtraParams = ApiExtraParamsDefault> = Map<ApiNames<TSurface>, ApiHandlerAny<TSurface, TExtraParams>>;

/** The initialization array structure for populating an API map. */
export type ApiMapInit<TSurface extends ApiSurface, TExtraParams extends ApiTExtraParams = ApiExtraParamsDefault> = ApiMapInitItemAny<TSurface, TExtraParams>[];

/** The type for a public API function, using a parameters object. */
export type ApiFunction<TSurface extends ApiSurface, TName extends ApiNames<TSurface>> = (
    params: ApiParams<TSurface[TName]>,
) => Promise<ApiReturn<TSurface[TName]>>;

/** The type for a public API function, using ordered parameters. */
export type ApiFunctionOrdered<TSurface extends ApiSurface, TName extends ApiNames<TSurface>, TParamNames extends ApiParamNames<TSurface[TName]>[]> = (
    ...params: ApiOrderedParams<TSurface[TName], TParamNames>,
) => Promise<ApiReturn<TSurface[TName]>>;

/** Type alias for a union of all params types. */
export type ApiParamsAny<TSurface extends ApiSurface> = {[name in ApiNames<TSurface>]: ApiParams<TSurface[name]>}[ApiNames<TSurface>];

/** Type alias for a union of all return types. */
export type ApiReturnAny<TSurface extends ApiSurface> = {[name in ApiNames<TSurface>]: ApiReturn<TSurface[name]>}[ApiNames<TSurface>];

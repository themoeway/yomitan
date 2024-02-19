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

/** A callback used when a media file has been loaded. */
export type OnLoadCallback = (
    /** The URL of the media that was loaded. */
    url: string,
) => Promise<void>;

/** A callback used when a media file should be unloaded. */
export type OnUnloadCallback = (
    /** Whether or not the media was fully loaded. */
    fullyLoaded: boolean,
) => Promise<void>;

export type LoadMediaDataInfo = {
    onUnload: OnUnloadCallback;
    loaded: boolean;
};

export type MediaCacheKey = string & {readonly __tag: unique symbol};

export type LoadMediaRequest = {
    /**  The path to the media file in the dictionary. */
    path: string;
    /** The name of the dictionary. */
    dictionary: string;
    /** The callback that is executed if the media was loaded successfully. */
    onLoad: OnLoadCallback;
    /** The callback that is executed when the media should be unloaded. */
    onUnload: OnUnloadCallback;
};

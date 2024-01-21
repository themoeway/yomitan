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
 * Attempts to load an image using an ArrayBuffer and a media type to return details about it.
 * @param content The binary content for the image, encoded as an ArrayBuffer.
 * @param mediaType The media type for the image content.
 * @param transfer An optional array of data that should be transferred in `postMessage` calls.
 *   When the resulting promise resolves, this array will contain the `content` object.
 * @returns Details about the requested image content.
 * @throws {Error} An error can be thrown if the image fails to load.
 */
export type GetImageDetailsFunction = (
    content: ArrayBuffer,
    mediaType: string,
    transfer?: Transferable[]
) => Promise<{content: ArrayBuffer, width: number, height: number}>;

export type GenericMediaLoader = {
    getImageDetails: GetImageDetailsFunction;
};

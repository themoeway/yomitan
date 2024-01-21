/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2020-2022  Yomichan Authors
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
 * MediaUtil is a class containing helper methods related to media processing.
 */
export class MediaUtil {
    /**
     * Gets the file extension of a file path. URL search queries and hash
     * fragments are not handled.
     * @param {string} path The path to the file.
     * @returns {string} The file extension, including the '.', or an empty string
     *   if there is no file extension.
     */
    static getFileNameExtension(path) {
        const match = /\.[^./\\]*$/.exec(path);
        return match !== null ? match[0] : '';
    }

    /**
     * Gets an image file's media type using a file path.
     * @param {string} path The path to the file.
     * @returns {?string} The media type string if it can be determined from the file path,
     *   otherwise `null`.
     */
    static getImageMediaTypeFromFileName(path) {
        switch (this.getFileNameExtension(path).toLowerCase()) {
            case '.apng':
                return 'image/apng';
            case '.bmp':
                return 'image/bmp';
            case '.gif':
                return 'image/gif';
            case '.ico':
            case '.cur':
                return 'image/x-icon';
            case '.jpg':
            case '.jpeg':
            case '.jfif':
            case '.pjpeg':
            case '.pjp':
                return 'image/jpeg';
            case '.png':
                return 'image/png';
            case '.svg':
                return 'image/svg+xml';
            case '.tif':
            case '.tiff':
                return 'image/tiff';
            case '.webp':
                return 'image/webp';
            default:
                return null;
        }
    }

    /**
     * Gets the file extension for a corresponding media type.
     * @param {string} mediaType The media type to use.
     * @returns {?string} A file extension including the dot for the media type,
     *   otherwise `null`.
     */
    static getFileExtensionFromImageMediaType(mediaType) {
        switch (mediaType) {
            case 'image/apng':
                return '.apng';
            case 'image/bmp':
                return '.bmp';
            case 'image/gif':
                return '.gif';
            case 'image/x-icon':
                return '.ico';
            case 'image/jpeg':
                return '.jpeg';
            case 'image/png':
                return '.png';
            case 'image/svg+xml':
                return '.svg';
            case 'image/tiff':
                return '.tiff';
            case 'image/webp':
                return '.webp';
            default:
                return null;
        }
    }

    /**
     * Gets the file extension for a corresponding media type.
     * @param {string} mediaType The media type to use.
     * @returns {?string} A file extension including the dot for the media type,
     *   otherwise `null`.
     */
    static getFileExtensionFromAudioMediaType(mediaType) {
        switch (mediaType) {
            case 'audio/aac':
                return '.aac';
            case 'audio/mpeg':
            case 'audio/mp3':
                return '.mp3';
            case 'audio/mp4':
                return '.mp4';
            case 'audio/ogg':
            case 'audio/vorbis':
                return '.ogg';
            case 'audio/vnd.wav':
            case 'audio/wave':
            case 'audio/wav':
            case 'audio/x-wav':
            case 'audio/x-pn-wav':
                return '.wav';
            case 'audio/flac':
                return '.flac';
            case 'audio/webm':
                return '.webm';
            default:
                return null;
        }
    }
}

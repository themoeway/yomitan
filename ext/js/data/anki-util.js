/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2021-2022  Yomichan Authors
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

import {isObject} from '../core/utilities.js';

/**
 * This class has some general utility functions for working with Anki data.
 */
export class AnkiUtil {
    /** @type {RegExp} @readonly */
    static _markerPattern = /\{([\w-]+)\}/g;

    /**
     * Gets the root deck name of a full deck name. If the deck is a root deck,
     * the same name is returned. Nested decks are separated using '::'.
     * @param {string} deckName A string of the deck name.
     * @returns {string} A string corresponding to the name of the root deck.
     */
    static getRootDeckName(deckName) {
        const index = deckName.indexOf('::');
        return index >= 0 ? deckName.substring(0, index) : deckName;
    }

    /**
     * Checks whether or not any marker is contained in a string.
     * @param {string} string A string to check.
     * @returns {boolean} `true` if the text contains an Anki field marker, `false` otherwise.
     */
    static stringContainsAnyFieldMarker(string) {
        const result = this._markerPattern.test(string);
        this._markerPattern.lastIndex = 0;
        return result;
    }

    /**
     * Gets a list of all markers that are contained in a string.
     * @param {string} string A string to check.
     * @returns {string[]} An array of marker strings.
     */
    static getFieldMarkers(string) {
        const pattern = this._markerPattern;
        const markers = [];
        while (true) {
            const match = pattern.exec(string);
            if (match === null) { break; }
            markers.push(match[1]);
        }
        return markers;
    }

    /**
     * Returns a regular expression which can be used to find markers in a string.
     * @param {boolean} global Whether or not the regular expression should have the global flag.
     * @returns {RegExp} A new `RegExp` instance.
     */
    static cloneFieldMarkerPattern(global) {
        return new RegExp(this._markerPattern.source, global ? 'g' : '');
    }

    /**
     * Checks whether or not a note object is valid.
     * @param {import('anki').Note} note A note object to check.
     * @returns {boolean} `true` if the note is valid, `false` otherwise.
     */
    static isNoteDataValid(note) {
        if (!isObject(note)) { return false; }
        const {fields, deckName, modelName} = note;
        return (
            typeof deckName === 'string' &&
            typeof modelName === 'string' &&
            Object.entries(fields).length > 0
        );
    }
}

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

/** Entry point. */
function main() {
    /** @type {Window} */
    // @ts-expect-error - Firefox Xray vision
    const window2 = window.wrappedJSObject;
    if (!(typeof window2 === 'object' && window2 !== null)) { return; }
    // The extension ID below is on an allow-list that is used on the Google Docs webpage.
    // @ts-expect-error - Adding a property to the global object
    // eslint-disable-next-line no-underscore-dangle
    window2._docs_annotate_canvas_by_ext = 'ogmnaimimemjmbakcfefmnahgdfhfami';
}

main();
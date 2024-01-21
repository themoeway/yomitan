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

export type {
    ChildNode as Parse5ChildNode,
    Document as Parse5Document,
    Element as Parse5Element,
} from 'parse5/dist/tree-adapters/default';

/**
 * This type is used as a generic reference to an element object from a generic DOM API.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type Element = object;

export type ISimpleDomParser = {
    getElementById(id: string, root?: Element): Element | null;
    getElementByTagName(tagName: string, root?: Element): Element | null;
    getElementsByTagName(tagName: string, root?: Element): Element[];
    getElementsByClassName(className: string, root?: Element): Element[];
    getAttribute(element: Element, attribute: string): string | null;
    getTextContent(element: Element): string;
};

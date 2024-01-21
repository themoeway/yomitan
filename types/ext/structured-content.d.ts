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

import type * as DictionaryData from './dictionary-data';

export type VerticalAlign = 'baseline' | 'sub' | 'super' | 'text-top' | 'text-bottom' | 'middle' | 'top' | 'bottom';

export type TextDecorationLine = 'underline' | 'overline' | 'line-through';

export type TextDecorationLineOrNone = 'none' | TextDecorationLine;

export type TextDecorationStyle = 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy';

export type FontStyle = 'normal' | 'italic';

export type FontWeight = 'normal' | 'bold';

export type WordBreak = 'normal' | 'break-all' | 'keep-all';

export type TextAlign = 'start' | 'end' | 'left' | 'right' | 'center' | 'justify' | 'justify-all' | 'match-parent';

export type SizeUnits = 'px' | 'em';

export type ImageRendering = 'auto' | 'pixelated' | 'crisp-edges';

export type ImageAppearance = 'auto' | 'monochrome';

export type Image = DictionaryData.TermImage & {
    verticalAlign: VerticalAlign;
    sizeUnits: SizeUnits;
};

export type Data = {
    [key: string]: string;
};

export type StructuredContentStyle = {
    fontStyle?: FontStyle;
    fontWeight?: FontWeight;
    fontSize?: string;
    color?: string;
    backgroundColor?: string;
    textDecorationLine?: TextDecorationLineOrNone | TextDecorationLine[];
    textDecorationStyle?: TextDecorationStyle;
    textDecorationColor?: string;
    borderColor?: string;
    borderStyle?: string;
    borderRadius?: string;
    borderWidth?: string;
    verticalAlign?: VerticalAlign;
    textAlign?: TextAlign;
    textShadow?: string;
    margin?: string;
    marginTop?: number | string;
    marginLeft?: number | string;
    marginRight?: number | string;
    marginBottom?: number | string;
    padding?: string;
    paddingTop?: string;
    paddingLeft?: string;
    paddingRight?: string;
    paddingBottom?: string;
    wordBreak?: WordBreak;
    whiteSpace?: string;
    cursor?: string;
    listStyleType?: string;
};

export type LineBreak = {
    tag: 'br';
    data?: Data;
    /**
     * This element doesn't support children.
     */
    content?: undefined;
    /**
     * This element doesn't support language.
     */
    lang?: undefined;
};

export type UnstyledElement = {
    tag: 'ruby' | 'rt' | 'rp' | 'table' | 'thead' | 'tbody' | 'tfoot' | 'tr';
    content?: Content;
    data?: Data;
    /**
     * Defines the language of an element in the format defined by RFC 5646.
     */
    lang?: string;
};

export type TableElement = {
    tag: 'td' | 'th';
    content?: Content;
    data?: Data;
    colSpan?: number;
    rowSpan?: number;
    style?: StructuredContentStyle;
    /**
     * Defines the language of an element in the format defined by RFC 5646.
     */
    lang?: string;
};

export type StyledElement = {
    tag: 'span' | 'div' | 'ol' | 'ul' | 'li';
    content?: Content;
    data?: Data;
    style?: StructuredContentStyle;
    /**
     * Hover text for the element.
     */
    title?: string;
    /**
     * Defines the language of an element in the format defined by RFC 5646.
     */
    lang?: string;
};

export type ImageElementBase = {
    data?: Data;
    /**
     * Path to the image file in the archive.
     */
    path: string;
    /**
     * Preferred width of the image.
     */
    width?: number;
    /**
     * Preferred width of the image.
     */
    height?: number;
    /**
     * Preferred width of the image.
     * This is only used in the internal database.
     */
    preferredWidth?: number;
    /**
     * Preferred width of the image.
     * This is only used in the internal database.
     */
    preferredHeight?: number;
    /**
     * Hover text for the image.
     */
    title?: string;
    /**
     * Alt text for the image.
     */
    alt?: string;
    /**
     * Description of the image.
     */
    description?: string;
    /**
     * Whether or not the image should appear pixelated at sizes larger than the image's native resolution.
     */
    pixelated?: boolean;
    /**
     * Controls how the image is rendered. The value of this field supersedes the pixelated field.
     */
    imageRendering?: ImageRendering;
    /**
     * Controls the appearance of the image. The 'monochrome' value will mask the opaque parts of the image using the current text color.
     */
    appearance?: ImageAppearance;
    /**
     * Whether or not a background color is displayed behind the image.
     */
    background?: boolean;
    /**
     * Whether or not the image is collapsed by default.
     */
    collapsed?: boolean;
    /**
     * Whether or not the image can be collapsed.
     */
    collapsible?: boolean;
};

export type ImageElement = ImageElementBase & {
    tag: 'img';
    /**
     * This element doesn't support children.
     */
    content?: undefined;
    /**
     * The vertical alignment of the image.
     */
    verticalAlign?: VerticalAlign;
    /**
     * The units for the width and height.
     */
    sizeUnits?: SizeUnits;
};

export type LinkElement = {
    tag: 'a';
    content?: Content;
    /**
     * The URL for the link. URLs starting with a ? are treated as internal links to other dictionary content.
     */
    href: string;
    /**
     * Defines the language of an element in the format defined by RFC 5646.
     */
    lang?: string;
};

export type Element = LineBreak | UnstyledElement | TableElement | StyledElement | ImageElement | LinkElement;

export type Content = string | Element | Content[];

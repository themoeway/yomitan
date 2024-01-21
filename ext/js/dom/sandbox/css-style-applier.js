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

import {readResponseJson} from '../../core/json.js';

/**
 * This class is used to apply CSS styles to elements using a consistent method
 * that is the same across different browsers.
 */
export class CssStyleApplier {
    /**
     * Creates a new instance of the class.
     * @param {string} styleDataUrl The local URL to the JSON file continaing the style rules.
     *   The style rules should follow the format of `CssStyleApplierRawStyleData`.
     */
    constructor(styleDataUrl) {
        /** @type {string} */
        this._styleDataUrl = styleDataUrl;
        /** @type {import('css-style-applier').CssRule[]} */
        this._styleData = [];
        /** @type {Map<string, import('css-style-applier').CssRule[]>} */
        this._cachedRules = new Map();
        /** @type {RegExp} */
        this._patternHtmlWhitespace = /[\t\r\n\f ]+/g;
        /** @type {RegExp} */
        this._patternClassNameCharacter = /[0-9a-zA-Z-_]/;
    }
    /* eslint-enable jsdoc/check-line-alignment */

    /**
     * Loads the data file for use.
     */
    async prepare() {
        /** @type {import('css-style-applier').RawStyleData} */
        let rawData = [];
        try {
            rawData = await this._fetchJsonAsset(this._styleDataUrl);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
        }
        const styleData = this._styleData;
        styleData.length = 0;
        for (const {selectors, styles} of rawData) {
            const selectors2 = selectors.join(',');
            const styles2 = [];
            for (const [property, value] of styles) {
                styles2.push({property, value});
            }
            styleData.push({
                selectors: selectors2,
                styles: styles2
            });
        }
    }

    /**
     * Applies CSS styles directly to the "style" attribute using the "class" attribute.
     * This only works for elements with a single class.
     * @param {Iterable<HTMLElement>} elements An iterable collection of HTMLElement objects.
     */
    applyClassStyles(elements) {
        const elementStyles = [];
        for (const element of elements) {
            const className = element.getAttribute('class');
            if (className === null || className.length === 0) { continue; }
            let cssTextNew = '';
            for (const {selectors, styles} of this._getCandidateCssRulesForClass(className)) {
                if (!element.matches(selectors)) { continue; }
                cssTextNew += this._getCssText(styles);
            }
            cssTextNew += element.style.cssText;
            elementStyles.push({element, style: cssTextNew});
        }
        for (const {element, style} of elementStyles) {
            element.removeAttribute('class');
            if (style.length > 0) {
                element.setAttribute('style', style);
            } else {
                element.removeAttribute('style');
            }
        }
    }

    // Private

    /**
     * Fetches and parses a JSON file.
     * @template [T=unknown]
     * @param {string} url The URL to the file.
     * @returns {Promise<T>} A JSON object.
     * @throws {Error} An error is thrown if the fetch fails.
     */
    async _fetchJsonAsset(url) {
        const response = await fetch(url, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'default',
            credentials: 'omit',
            redirect: 'follow',
            referrerPolicy: 'no-referrer'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }
        return await readResponseJson(response);
    }

    /**
     * Gets an array of candidate CSS rules which might match a specific class.
     * @param {string} className A whitespace-separated list of classes.
     * @returns {import('css-style-applier').CssRule[]} An array of candidate CSS rules.
     */
    _getCandidateCssRulesForClass(className) {
        let rules = this._cachedRules.get(className);
        if (typeof rules !== 'undefined') { return rules; }

        rules = [];
        this._cachedRules.set(className, rules);

        const classList = this._getTokens(className);
        for (const {selectors, styles} of this._styleData) {
            if (!this._selectorMightMatch(selectors, classList)) { continue; }
            rules.push({selectors, styles});
        }

        return rules;
    }

    /**
     * Converts an array of CSS rules to a CSS string.
     * @param {import('css-style-applier').CssDeclaration[]} styles An array of CSS rules.
     * @returns {string} The CSS string.
     */
    _getCssText(styles) {
        let cssText = '';
        for (const {property, value} of styles) {
            cssText += `${property}:${value};`;
        }
        return cssText;
    }

    /**
     * Checks whether or not a CSS string might match at least one class in a list.
     * @param {string} selectors A CSS selector string.
     * @param {string[]} classList An array of CSS classes.
     * @returns {boolean} `true` if the selector string might match one of the classes in `classList`, false otherwise.
     */
    _selectorMightMatch(selectors, classList) {
        const pattern = this._patternClassNameCharacter;
        for (const item of classList) {
            const prefixedItem = `.${item}`;
            let start = 0;
            while (true) {
                const index = selectors.indexOf(prefixedItem, start);
                if (index < 0) { break; }
                start = index + prefixedItem.length;
                if (start >= selectors.length || !pattern.test(selectors[start])) { return true; }
            }
        }
        return false;
    }

    /**
     * Gets the whitespace-delimited tokens from a string.
     * @param {string} tokenListString The string to parse.
     * @returns {string[]} An array of tokens.
     */
    _getTokens(tokenListString) {
        let start = 0;
        const pattern = this._patternHtmlWhitespace;
        pattern.lastIndex = 0;
        const result = [];
        while (true) {
            const match = pattern.exec(tokenListString);
            const end = match === null ? tokenListString.length : match.index;
            if (end > start) { result.push(tokenListString.substring(start, end)); }
            if (match === null) { return result; }
            start = end + match[0].length;
        }
    }
}

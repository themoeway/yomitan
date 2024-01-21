/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2022  Yomichan Authors
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
 * This class is used to control theme attributes on DOM elements.
 */
export class ThemeController {
    /**
     * Creates a new instance of the class.
     * @param {?HTMLElement} element A DOM element which theme properties are applied to.
     */
    constructor(element) {
        /** @type {?HTMLElement} */
        this._element = element;
        /** @type {'light'|'dark'|'browser'} */
        this._theme = 'light';
        /** @type {'light'|'dark'|'browser'|'site'} */
        this._outerTheme = 'light';
        /** @type {?('dark'|'light')} */
        this._siteTheme = null;
        /** @type {'dark'|'light'} */
        this._browserTheme = 'light';
    }

    /**
     * Gets the DOM element which theme properties are applied to.
     * @type {?Element}
     */
    get element() {
        return this._element;
    }

    /**
     * Sets the DOM element which theme properties are applied to.
     * @param {?HTMLElement} value The DOM element to assign.
     */
    set element(value) {
        this._element = value;
    }

    /**
     * Gets the main theme for the content.
     * @type {'light'|'dark'|'browser'}
     */
    get theme() {
        return this._theme;
    }

    /**
     * Sets the main theme for the content.
     * @param {'light'|'dark'|'browser'} value The theme value to assign.
     */
    set theme(value) {
        this._theme = value;
    }

    /**
     * Gets the outer theme for the content.
     * @type {'light'|'dark'|'browser'|'site'}
     */
    get outerTheme() {
        return this._outerTheme;
    }

    /**
     * Sets the outer theme for the content.
     * @param {'light'|'dark'|'browser'|'site'} value The outer theme value to assign.
     */
    set outerTheme(value) {
        this._outerTheme = value;
    }

    /**
     * Gets the override value for the site theme.
     * If this value is `null`, the computed value will be used.
     * @type {?('dark'|'light')}
     */
    get siteTheme() {
        return this._siteTheme;
    }

    /**
     * Sets the override value for the site theme.
     * If this value is `null`, the computed value will be used.
     * @param {?('dark'|'light')} value The site theme value to assign.
     */
    set siteTheme(value) {
        this._siteTheme = value;
    }

    /**
     * Gets the browser's preferred color theme.
     * The value can be either 'light' or 'dark'.
     * @type {'dark'|'light'}
     */
    get browserTheme() {
        return this._browserTheme;
    }

    /**
     * Prepares the instance for use and applies the theme settings.
     */
    prepare() {
        const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQueryList.addEventListener('change', this._onPrefersColorSchemeDarkChange.bind(this));
        this._onPrefersColorSchemeDarkChange(mediaQueryList);
    }

    /**
     * Updates the theme attributes on the target element.
     * If the site theme value isn't overridden, the current site theme is recomputed.
     */
    updateTheme() {
        if (this._element === null) { return; }
        const computedSiteTheme = this._siteTheme !== null ? this._siteTheme : this.computeSiteTheme();
        const data = this._element.dataset;
        data.theme = this._resolveThemeValue(this._theme, computedSiteTheme);
        data.outerTheme = this._resolveThemeValue(this._outerTheme, computedSiteTheme);
        data.siteTheme = computedSiteTheme;
        data.browserTheme = this._browserTheme;
        data.themeRaw = this._theme;
        data.outerThemeRaw = this._outerTheme;
    }

    /**
     * Computes the current site theme based on the background color.
     * @returns {'light'|'dark'} The theme of the site.
     */
    computeSiteTheme() {
        const color = [255, 255, 255];
        const {documentElement, body} = document;
        if (documentElement !== null) {
            this._addColor(color, window.getComputedStyle(documentElement).backgroundColor);
        }
        if (body !== null) {
            this._addColor(color, window.getComputedStyle(body).backgroundColor);
        }
        const dark = (color[0] < 128 && color[1] < 128 && color[2] < 128);
        return dark ? 'dark' : 'light';
    }

    /**
     * Event handler for when the preferred browser theme changes.
     * @param {MediaQueryList|MediaQueryListEvent} detail The object containing event details.
     */
    _onPrefersColorSchemeDarkChange({matches}) {
        this._browserTheme = (matches ? 'dark' : 'light');
        this.updateTheme();
    }

    /**
     * Resolves a settings theme value to the actual value which should be used.
     * @param {string} theme The theme value to resolve.
     * @param {string} computedSiteTheme The computed site theme value to use for when the theme value is `'auto'`.
     * @returns {string} The resolved theme value.
     */
    _resolveThemeValue(theme, computedSiteTheme) {
        switch (theme) {
            case 'auto': return computedSiteTheme;
            case 'browser': return this._browserTheme;
            default: return theme;
        }
    }

    /**
     * Adds the value of a CSS color to an accumulation target.
     * @param {number[]} target The target color buffer to accumulate into, as an array of [r, g, b].
     * @param {string|*} cssColor The CSS color value to add to the target. If this value is not a string,
     *   the target will not be modified.
     */
    _addColor(target, cssColor) {
        if (typeof cssColor !== 'string') { return; }

        const color = this._getColorInfo(cssColor);
        if (color === null) { return; }

        const a = color[3];
        if (a <= 0.0) { return; }

        const aInv = 1.0 - a;
        for (let i = 0; i < 3; ++i) {
            target[i] = target[i] * aInv + color[i] * a;
        }
    }

    /**
     * Decomposes a CSS color string into its RGBA values.
     * @param {string} cssColor The color value to decompose. This value is expected to be in the form RGB(r, g, b) or RGBA(r, g, b, a).
     * @returns {?number[]} The color and alpha values as [r, g, b, a]. The color component values range from [0, 255], and the alpha ranges from [0, 1].
     */
    _getColorInfo(cssColor) {
        const m = /^\s*rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)\s*$/.exec(cssColor);
        if (m === null) { return null; }

        const m4 = m[4];
        return [
            Number.parseInt(m[1], 10),
            Number.parseInt(m[2], 10),
            Number.parseInt(m[3], 10),
            m4 ? Math.max(0.0, Math.min(1.0, Number.parseFloat(m4))) : 1.0
        ];
    }
}

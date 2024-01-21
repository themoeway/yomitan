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

import css from 'css';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @returns {{cssFilePath: string, overridesCssFilePath: string, outputPath: string}[]}
 */
export function getTargets() {
    return [
        {
            cssFilePath: path.join(dirname, '..', 'ext/css/structured-content.css'),
            overridesCssFilePath: path.join(dirname, 'data/structured-content-overrides.css'),
            outputPath: path.join(dirname, '..', 'ext/data/structured-content-style.json')
        },
        {
            cssFilePath: path.join(dirname, '..', 'ext/css/display-pronunciation.css'),
            overridesCssFilePath: path.join(dirname, 'data/display-pronunciation-overrides.css'),
            outputPath: path.join(dirname, '..', 'ext/data/pronunciation-style.json')
        }
    ];
}

/**
 * @param {import('css-style-applier').RawStyleData} rules
 * @param {string[]} selectors
 * @returns {number}
 */
function indexOfRule(rules, selectors) {
    const jj = selectors.length;
    for (let i = 0, ii = rules.length; i < ii; ++i) {
        const ruleSelectors = rules[i].selectors;
        if (ruleSelectors.length !== jj) { continue; }
        let okay = true;
        for (let j = 0; j < jj; ++j) {
            if (selectors[j] !== ruleSelectors[j]) {
                okay = false;
                break;
            }
        }
        if (okay) { return i; }
    }
    return -1;
}

/**
 * @param {import('css-style-applier').RawStyleDataStyleArray} styles
 * @param {string} property
 * @param {Map<string, number>} removedProperties
 * @returns {number}
 */
function removeProperty(styles, property, removedProperties) {
    let removeCount = removedProperties.get(property);
    if (typeof removeCount !== 'undefined') { return removeCount; }
    removeCount = 0;
    for (let i = 0, ii = styles.length; i < ii; ++i) {
        const key = styles[i][0];
        if (key !== property) { continue; }
        styles.splice(i, 1);
        --i;
        --ii;
        ++removeCount;
    }
    removedProperties.set(property, removeCount);
    return removeCount;
}

/**
 * Manually formats JSON for easier CSS parseability.
 * @param {import('css-style-applier').RawStyleData} rules CSS ruleset.
 * @returns {string}
 */
export function formatRulesJson(rules) {
    // return JSON.stringify(rules, null, 4);
    const indent1 = '    ';
    const indent2 = indent1.repeat(2);
    const indent3 = indent1.repeat(3);
    let result = '';
    result += '[';
    let ruleIndex = 0;
    for (const {selectors, styles} of rules) {
        if (ruleIndex > 0) { result += ','; }
        result += `\n${indent1}{\n${indent2}"selectors": `;
        if (selectors.length === 1) {
            result += `[${JSON.stringify(selectors[0], null, 4)}]`;
        } else {
            result += JSON.stringify(selectors, null, 4).replace(/\n/g, '\n' + indent2);
        }
        result += `,\n${indent2}"styles": [`;
        let styleIndex = 0;
        for (const [key, value] of styles) {
            if (styleIndex > 0) { result += ','; }
            result += `\n${indent3}[${JSON.stringify(key)}, ${JSON.stringify(value)}]`;
            ++styleIndex;
        }
        if (styleIndex > 0) { result += `\n${indent2}`; }
        result += `]\n${indent1}}`;
        ++ruleIndex;
    }
    if (ruleIndex > 0) { result += '\n'; }
    result += ']';
    return result;
}

/**
 * Generates a CSS ruleset.
 * @param {string} cssFilePath
 * @param {string} overridesCssFilePath
 * @returns {import('css-style-applier').RawStyleData}
 * @throws {Error}
 */
export function generateRules(cssFilePath, overridesCssFilePath) {
    const cssFileContent = fs.readFileSync(cssFilePath, {encoding: 'utf8'});
    const overridesCssFileContent = fs.readFileSync(overridesCssFilePath, {encoding: 'utf8'});
    const defaultStylesheet = /** @type {css.StyleRules} */ (css.parse(cssFileContent, {}).stylesheet);
    const overridesStylesheet = /** @type {css.StyleRules} */ (css.parse(overridesCssFileContent, {}).stylesheet);

    const removePropertyPattern = /^remove-property\s+([\w\W]+)$/;
    const removeRulePattern = /^remove-rule$/;
    const propertySeparator = /\s+/;

    /** @type {import('css-style-applier').RawStyleData} */
    const rules = [];

    for (const rule of defaultStylesheet.rules) {
        if (rule.type !== 'rule') { continue; }
        const {selectors, declarations} = /** @type {css.Rule} */ (rule);
        if (typeof selectors === 'undefined') { continue; }
        /** @type {import('css-style-applier').RawStyleDataStyleArray} */
        const styles = [];
        if (typeof declarations !== 'undefined') {
            for (const declaration of declarations) {
                if (declaration.type !== 'declaration') { console.log(declaration); continue; }
                const {property, value} = /** @type {css.Declaration} */ (declaration);
                if (typeof property !== 'string' || typeof value !== 'string') { continue; }
                styles.push([property, value]);
            }
        }
        if (styles.length > 0) {
            rules.push({selectors, styles});
        }
    }

    for (const rule of overridesStylesheet.rules) {
        if (rule.type !== 'rule') { continue; }
        const {selectors, declarations} = /** @type {css.Rule} */ (rule);
        if (typeof selectors === 'undefined' || typeof declarations === 'undefined') { continue; }
        /** @type {Map<string, number>} */
        const removedProperties = new Map();
        for (const declaration of declarations) {
            switch (declaration.type) {
                case 'declaration':
                    {
                        const index = indexOfRule(rules, selectors);
                        let entry;
                        if (index >= 0) {
                            entry = rules[index];
                        } else {
                            entry = {selectors, styles: []};
                            rules.push(entry);
                        }
                        const {property, value} = /** @type {css.Declaration} */ (declaration);
                        if (typeof property === 'string' && typeof value === 'string') {
                            removeProperty(entry.styles, property, removedProperties);
                            entry.styles.push([property, value]);
                        }
                    }
                    break;
                case 'comment':
                    {
                        const index = indexOfRule(rules, selectors);
                        if (index < 0) { throw new Error('Could not find rule with matching selectors'); }
                        const comment = (/** @type {css.Comment} */ (declaration).comment || '').trim();
                        let m;
                        if ((m = removePropertyPattern.exec(comment)) !== null) {
                            for (const property of m[1].split(propertySeparator)) {
                                const removeCount = removeProperty(rules[index].styles, property, removedProperties);
                                if (removeCount === 0) { throw new Error(`Property removal is unnecessary; ${property} does not exist`); }
                            }
                        } else if (removeRulePattern.test(comment)) {
                            rules.splice(index, 1);
                        }
                    }
                    break;
            }
        }
    }

    // Remove empty
    for (let i = 0, ii = rules.length; i < ii; ++i) {
        if (rules[i].styles.length > 0) { continue; }
        rules.splice(i, 1);
        --i;
        --ii;
    }

    return rules;
}

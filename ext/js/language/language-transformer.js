/*
 * Copyright (C) 2024  Yomitan Authors
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

export class LanguageTransformer {
    constructor() {
        /** @type {number} */
        this._nextFlagIndex = 0;
        /** @type {import('language-transformer-internal').Transform[]} */
        this._transforms = [];
        /** @type {Map<string, number>} */
        this._partOfSpeechToFlagsMap = new Map();
    }

    /**
     * Note: this function does not currently combine properly with previous descriptors,
     * they are treated as completely separate collections. This should eventually be changed.
     * @param {import('language-transformer').LanguageTransformDescriptor} descriptor
     * @throws {Error}
     */
    addDescriptor(descriptor) {
        const {conditions, transforms} = descriptor;
        const conditionEntries = Object.entries(conditions);
        const {conditionFlagsMap, nextFlagIndex} = this._getConditionFlagsMap(conditionEntries, this._nextFlagIndex);

        /** @type {import('language-transformer-internal').Transform[]} */
        const transforms2 = [];
        for (let i = 0, ii = transforms.length; i < ii; ++i) {
            const {name, rules} = transforms[i];
            /** @type {import('language-transformer-internal').Rule[]} */
            const rules2 = [];
            for (let j = 0, jj = rules.length; j < jj; ++j) {
                const {suffixIn, suffixOut, conditionsIn, conditionsOut} = rules[j];
                const conditionFlagsIn = this._getConditionFlags(conditionFlagsMap, conditionsIn);
                if (conditionFlagsIn === null) { throw new Error(`Invalid conditionsIn for transform[${i}].rules[${j}]`); }
                const conditionFlagsOut = this._getConditionFlags(conditionFlagsMap, conditionsOut);
                if (conditionFlagsOut === null) { throw new Error(`Invalid conditionsOut for transform[${i}].rules[${j}]`); }
                rules2.push({
                    suffixIn,
                    suffixOut,
                    conditionsIn: conditionFlagsIn,
                    conditionsOut: conditionFlagsOut
                });
            }
            transforms2.push({name, rules: rules2});
        }

        this._nextFlagIndex = nextFlagIndex;
        for (const transform of transforms2) {
            this._transforms.push(transform);
        }

        for (const [type, condition] of conditionEntries) {
            const flags = conditionFlagsMap.get(type);
            if (typeof flags === 'undefined') { continue; } // This case should never happen
            for (const partOfSpeech of condition.partsOfSpeech) {
                this._partOfSpeechToFlagsMap.set(partOfSpeech, this.getPartOfSpeechFlags(partOfSpeech) | flags);
            }
        }
    }

    /**
     * @param {string} partOfSpeech
     * @returns {number}
     */
    getPartOfSpeechFlags(partOfSpeech) {
        const partOfSpeechFlags = this._partOfSpeechToFlagsMap.get(partOfSpeech);
        return typeof partOfSpeechFlags !== 'undefined' ? partOfSpeechFlags : 0;
    }

    /**
     * @param {string} sourceText
     * @returns {import('language-transformer-internal').TransformedText[]}
     */
    transform(sourceText) {
        const results = [this._createTransformedText(sourceText, 0, [])];
        for (let i = 0; i < results.length; ++i) {
            const {text, conditions, rules} = results[i];
            for (const {name, rules: rules2} of this._transforms) {
                for (const rule of rules2) {
                    if (!LanguageTransformer.conditionsMatch(conditions, rule.conditionsIn)) { continue; }
                    const {suffixIn, suffixOut} = rule;
                    if (!text.endsWith(suffixIn) || (text.length - suffixIn.length + suffixOut.length) <= 0) { continue; }
                    results.push(this._createTransformedText(
                        text.substring(0, text.length - suffixIn.length) + suffixOut,
                        rule.conditionsOut,
                        [name, ...rules]
                    ));
                }
            }
        }
        return results;
    }

    /**
     * @param {import('language-transformer').ConditionMapEntries} conditions
     * @param {number} nextFlagIndex
     * @returns {{conditionFlagsMap: Map<string, number>, nextFlagIndex: number}}
     * @throws {Error}
     */
    _getConditionFlagsMap(conditions, nextFlagIndex) {
        /** @type {Map<string, number>} */
        const conditionFlagsMap = new Map();
        /** @type {import('language-transformer').ConditionMapEntries} */
        let targets = conditions;
        while (targets.length > 0) {
            const nextTargets = [];
            for (const target of targets) {
                const [type, condition] = target;
                const {subConditions} = condition;
                let flags = 0;
                if (typeof subConditions === 'undefined') {
                    if (nextFlagIndex >= 32) {
                        // Flags greater than or equal to 32 don't work because JavaScript only supports up to 32-bit integer operations
                        throw new Error('Maximum number of conditions was exceeded');
                    }
                    flags = 1 << nextFlagIndex;
                    ++nextFlagIndex;
                } else {
                    const multiFlags = this._getConditionFlags(conditionFlagsMap, subConditions);
                    if (multiFlags === null) {
                        nextTargets.push(target);
                        continue;
                    } else {
                        flags = multiFlags;
                    }
                }
                conditionFlagsMap.set(type, flags);
            }
            if (nextTargets.length === targets.length) {
                // Cycle in subRule declaration
                throw new Error('Maximum number of conditions was exceeded');
            }
            targets = nextTargets;
        }
        return {conditionFlagsMap, nextFlagIndex};
    }

    /**
     * @param {Map<string, number>} conditionFlagsMap
     * @param {string[]} conditionTypes
     * @returns {?number}
     */
    _getConditionFlags(conditionFlagsMap, conditionTypes) {
        let flags = 0;
        for (const conditionType of conditionTypes) {
            const flags2 = conditionFlagsMap.get(conditionType);
            if (typeof flags2 === 'undefined') { return null; }
            flags |= flags2;
        }
        return flags;
    }

    /**
     * @param {string} text
     * @param {number} conditions
     * @param {string[]} rules
     * @returns {import('language-transformer-internal').TransformedText}
     */
    _createTransformedText(text, conditions, rules) {
        return {text, conditions, rules};
    }

    /**
     * If `currentConditions` is `0`, then `nextConditions` is ignored and `true` is returned.
     * Otherwise, there must be at least one shared condition between `currentConditions` and `nextConditions`.
     * @param {number} currentConditions
     * @param {number} nextConditions
     * @returns {boolean}
     */
    static conditionsMatch(currentConditions, nextConditions) {
        return currentConditions === 0 || (currentConditions & nextConditions) !== 0;
    }
}

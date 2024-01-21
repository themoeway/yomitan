/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2016-2022  Yomichan Authors
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

export class Deinflector {
    /* eslint-disable no-multi-spaces */
    /** @type {Map<string, import('translation-internal').DeinflectionRuleFlags>} @readonly */
    static _ruleTypes = new Map([
        ['v1',    /** @type {import('translation-internal').DeinflectionRuleFlags} */ (0b00000001)], // Verb ichidan
        ['v5',    /** @type {import('translation-internal').DeinflectionRuleFlags} */ (0b00000010)], // Verb godan
        ['vs',    /** @type {import('translation-internal').DeinflectionRuleFlags} */ (0b00000100)], // Verb suru
        ['vk',    /** @type {import('translation-internal').DeinflectionRuleFlags} */ (0b00001000)], // Verb kuru
        ['vz',    /** @type {import('translation-internal').DeinflectionRuleFlags} */ (0b00010000)], // Verb zuru
        ['adj-i', /** @type {import('translation-internal').DeinflectionRuleFlags} */ (0b00100000)], // Adjective i
        ['iru',   /** @type {import('translation-internal').DeinflectionRuleFlags} */ (0b01000000)] // Intermediate -iru endings for progressive or perfect tense
    ]);
    /* eslint-enable no-multi-spaces */

    /**
     * @param {import('deinflector').ReasonsRaw} reasons
     * @example
     * const deinflectionReasons = parseJson(
     *   readFileSync(path.join('ext/data/deinflect.json')).toString(),
     * );
     * const deinflector = new Deinflector(deinflectionReasons);
     */
    constructor(reasons) {
        /** @type {import('deinflector').Reason[]} */
        this.reasons = Deinflector.normalizeReasons(reasons);
    }

    /**
     * Deinflects a Japanese term to all of its possible dictionary forms.
     * @param {string} source The source term to deinflect.
     * @returns {import('translation-internal').Deinflection[]}
     * @example
     * const deinflector = new Deinflector(deinflectionReasons);
     * // [{ term: '食べた', rules: 0, reasons: [] }, { term: '食べる', rules: 1, reasons: ['past'] }, { term: '食ぶ', rules: 2, reasons: ['potential', 'past'] }]
     * console.log(deinflector.deinflect('食べた'));
     */
    deinflect(source) {
        const results = [this._createDeinflection(source, 0, [])];
        for (let i = 0; i < results.length; ++i) {
            const {rules, term, reasons} = results[i];
            for (const [reason, variants] of this.reasons) {
                for (const [kanaIn, kanaOut, rulesIn, rulesOut] of variants) {
                    if (
                        !Deinflector.rulesMatch(rules, rulesIn) ||
                        !term.endsWith(kanaIn) ||
                        (term.length - kanaIn.length + kanaOut.length) <= 0
                    ) {
                        continue;
                    }

                    results.push(this._createDeinflection(
                        term.substring(0, term.length - kanaIn.length) + kanaOut,
                        rulesOut,
                        [reason, ...reasons]
                    ));
                }
            }
        }
        return results;
    }

    /**
     * @param {string} term
     * @param {import('translation-internal').DeinflectionRuleFlags} rules
     * @param {import('dictionary').InflectionRuleChain} reasons
     * @returns {import('translation-internal').Deinflection}
     */
    _createDeinflection(term, rules, reasons) {
        return {term, rules, reasons};
    }

    /**
     * @param {import('deinflector').ReasonsRaw} reasons
     * @returns {import('deinflector').Reason[]}
     */
    static normalizeReasons(reasons) {
        /** @type {import('deinflector').Reason[]} */
        const normalizedReasons = [];
        for (const [reason, reasonInfo] of Object.entries(reasons)) {
            /** @type {import('deinflector').ReasonVariant[]} */
            const variants = [];
            for (const {kanaIn, kanaOut, rulesIn, rulesOut} of reasonInfo) {
                variants.push([
                    kanaIn,
                    kanaOut,
                    this.rulesToRuleFlags(rulesIn),
                    this.rulesToRuleFlags(rulesOut)
                ]);
            }
            normalizedReasons.push([reason, variants]);
        }
        return normalizedReasons;
    }

    /**
     * @param {string[]} rules
     * @returns {import('translation-internal').DeinflectionRuleFlags}
     */
    static rulesToRuleFlags(rules) {
        const ruleTypes = this._ruleTypes;
        let value = 0;
        for (const rule of rules) {
            const ruleBits = ruleTypes.get(rule);
            if (typeof ruleBits === 'undefined') { continue; }
            value |= ruleBits;
        }
        return value;
    }

    /**
     * If `currentRules` is `0`, then `nextRules` is ignored and `true` is returned.
     * Otherwise, there must be at least one shared rule between `currentRules` and `nextRules`.
     * @param {number} currentRules
     * @param {number} nextRules
     * @returns {boolean}
     */
    static rulesMatch(currentRules, nextRules) {
        return currentRules === 0 || (currentRules & nextRules) !== 0;
    }
}

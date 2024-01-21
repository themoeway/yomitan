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

export class TemplatePatcher {
    constructor() {
        /** @type {RegExp} */
        this._diffPattern1 = /\n?\{\{<<<<<<<\}\}\n/g;
        /** @type {RegExp} */
        this._diffPattern2 = /\n\{\{=======\}\}\n/g;
        /** @type {RegExp} */
        this._diffPattern3 = /\n\{\{>>>>>>>\}\}\n*/g;
        /** @type {RegExp} */
        this._lookupMarkerPattern = /[ \t]*\{\{~?>\s*\(\s*lookup\s*\.\s*"marker"\s*\)\s*~?\}\}/g;
    }

    /**
     * @param {string} content
     * @returns {import('template-patcher').Patch}
     */
    parsePatch(content) {
        const diffPattern1 = this._diffPattern1;
        const diffPattern2 = this._diffPattern2;
        const diffPattern3 = this._diffPattern3;
        const modifications = [];
        let index = 0;

        while (true) {
            // Find modification boundaries
            diffPattern1.lastIndex = index;
            const m1 = diffPattern1.exec(content);
            if (m1 === null) { break; }

            diffPattern2.lastIndex = m1.index + m1[0].length;
            const m2 = diffPattern2.exec(content);
            if (m2 === null) { break; }

            diffPattern3.lastIndex = m2.index + m2[0].length;
            const m3 = diffPattern3.exec(content);
            if (m3 === null) { break; }

            // Construct
            const current = content.substring(m1.index + m1[0].length, m2.index);
            const replacement = content.substring(m2.index + m2[0].length, m3.index);

            if (current.length > 0) {
                modifications.push({current, replacement});
            }

            // Update
            content = content.substring(0, m1.index) + content.substring(m3.index + m3[0].length);
            index = m1.index;
        }

        return {addition: content, modifications};
    }

    /**
     * @param {string} template
     * @param {import('template-patcher').Patch} patch
     * @returns {string}
     */
    applyPatch(template, patch) {
        for (const {current, replacement} of patch.modifications) {
            let fromIndex = 0;
            while (true) {
                const index = template.indexOf(current, fromIndex);
                if (index < 0) { break; }
                template = template.substring(0, index) + replacement + template.substring(index + current.length);
                fromIndex = index + replacement.length;
            }
        }
        template = this._addFieldTemplatesBeforeEnd(template, patch.addition);
        return template;
    }

    // Private

    /**
     * @param {string} template
     * @param {string} addition
     * @returns {string}
     */
    _addFieldTemplatesBeforeEnd(template, addition) {
        if (addition.length === 0) { return template; }
        const newline = '\n';
        let replaced = false;
        template = template.replace(this._lookupMarkerPattern, (g0) => {
            replaced = true;
            return `${addition}${newline}${g0}`;
        });
        if (!replaced) {
            template += newline;
            template += addition;
        }
        return template;
    }
}

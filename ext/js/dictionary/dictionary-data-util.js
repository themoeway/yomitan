/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2020-2022  Yomichan Authors
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

export class DictionaryDataUtil {
    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {import('dictionary-data-util').TagGroup[]}
     */
    static groupTermTags(dictionaryEntry) {
        const {headwords} = dictionaryEntry;
        const headwordCount = headwords.length;
        const uniqueCheck = (headwordCount > 1);
        const resultsIndexMap = new Map();
        const results = [];
        for (let i = 0; i < headwordCount; ++i) {
            const {tags} = headwords[i];
            for (const tag of tags) {
                if (uniqueCheck) {
                    const {name, category, content, dictionaries} = tag;
                    const key = this._createMapKey([name, category, content, dictionaries]);
                    const index = resultsIndexMap.get(key);
                    if (typeof index !== 'undefined') {
                        const existingItem = results[index];
                        existingItem.headwordIndices.push(i);
                        continue;
                    }
                    resultsIndexMap.set(key, results.length);
                }

                const item = {tag, headwordIndices: [i]};
                results.push(item);
            }
        }
        return results;
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {import('dictionary-data-util').DictionaryFrequency<import('dictionary-data-util').TermFrequency>[]}
     */
    static groupTermFrequencies(dictionaryEntry) {
        const {headwords, frequencies: sourceFrequencies} = dictionaryEntry;

        /** @type {import('dictionary-data-util').TermFrequenciesMap1} */
        const map1 = new Map();
        for (const {headwordIndex, dictionary, hasReading, frequency, displayValue} of sourceFrequencies) {
            const {term, reading} = headwords[headwordIndex];

            let map2 = map1.get(dictionary);
            if (typeof map2 === 'undefined') {
                map2 = new Map();
                map1.set(dictionary, map2);
            }

            const readingKey = hasReading ? reading : null;
            const key = this._createMapKey([term, readingKey]);
            let frequencyData = map2.get(key);
            if (typeof frequencyData === 'undefined') {
                frequencyData = {term, reading: readingKey, values: new Map()};
                map2.set(key, frequencyData);
            }

            frequencyData.values.set(this._createMapKey([frequency, displayValue]), {frequency, displayValue});
        }

        const results = [];
        for (const [dictionary, map2] of map1.entries()) {
            const frequencies = [];
            for (const {term, reading, values} of map2.values()) {
                frequencies.push({
                    term,
                    reading,
                    values: [...values.values()]
                });
            }
            results.push({dictionary, frequencies});
        }
        return results;
    }

    /**
     * @param {import('dictionary').KanjiFrequency[]} sourceFrequencies
     * @returns {import('dictionary-data-util').DictionaryFrequency<import('dictionary-data-util').KanjiFrequency>[]}
     */
    static groupKanjiFrequencies(sourceFrequencies) {
        /** @type {import('dictionary-data-util').KanjiFrequenciesMap1} */
        const map1 = new Map();
        for (const {dictionary, character, frequency, displayValue} of sourceFrequencies) {
            let map2 = map1.get(dictionary);
            if (typeof map2 === 'undefined') {
                map2 = new Map();
                map1.set(dictionary, map2);
            }

            let frequencyData = map2.get(character);
            if (typeof frequencyData === 'undefined') {
                frequencyData = {character, values: new Map()};
                map2.set(character, frequencyData);
            }

            frequencyData.values.set(this._createMapKey([frequency, displayValue]), {frequency, displayValue});
        }

        const results = [];
        for (const [dictionary, map2] of map1.entries()) {
            const frequencies = [];
            for (const {character, values} of map2.values()) {
                frequencies.push({
                    character,
                    values: [...values.values()]
                });
            }
            results.push({dictionary, frequencies});
        }
        return results;
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {import('dictionary-data-util').DictionaryGroupedPronunciations[]}
     */
    static getGroupedPronunciations(dictionaryEntry) {
        const {headwords, pronunciations: termPronunciations} = dictionaryEntry;

        const allTerms = new Set();
        const allReadings = new Set();
        for (const {term, reading} of headwords) {
            allTerms.add(term);
            allReadings.add(reading);
        }

        /** @type {Map<string, import('dictionary-data-util').GroupedPronunciationInternal[]>} */
        const groupedPronunciationsMap = new Map();
        for (const {headwordIndex, dictionary, pronunciations} of termPronunciations) {
            const {term, reading} = headwords[headwordIndex];
            let dictionaryGroupedPronunciationList = groupedPronunciationsMap.get(dictionary);
            if (typeof dictionaryGroupedPronunciationList === 'undefined') {
                dictionaryGroupedPronunciationList = [];
                groupedPronunciationsMap.set(dictionary, dictionaryGroupedPronunciationList);
            }
            for (const pronunciation of pronunciations) {
                let groupedPronunciation = this._findExistingGroupedPronunciation(reading, pronunciation, dictionaryGroupedPronunciationList);
                if (groupedPronunciation === null) {
                    groupedPronunciation = {
                        pronunciation,
                        terms: new Set(),
                        reading
                    };
                    dictionaryGroupedPronunciationList.push(groupedPronunciation);
                }
                groupedPronunciation.terms.add(term);
            }
        }

        /** @type {import('dictionary-data-util').DictionaryGroupedPronunciations[]} */
        const results2 = [];
        const multipleReadings = (allReadings.size > 1);
        for (const [dictionary, dictionaryGroupedPronunciationList] of groupedPronunciationsMap.entries()) {
            /** @type {import('dictionary-data-util').GroupedPronunciation[]} */
            const pronunciations2 = [];
            for (const groupedPronunciation of dictionaryGroupedPronunciationList) {
                const {pronunciation, terms, reading} = groupedPronunciation;
                const exclusiveTerms = !this._areSetsEqual(terms, allTerms) ? this._getSetIntersection(terms, allTerms) : [];
                const exclusiveReadings = [];
                if (multipleReadings) {
                    exclusiveReadings.push(reading);
                }
                pronunciations2.push({
                    pronunciation,
                    terms: [...terms],
                    reading,
                    exclusiveTerms,
                    exclusiveReadings
                });
            }

            results2.push({dictionary, pronunciations: pronunciations2});
        }
        return results2;
    }

    /**
     * @template {import('dictionary').PronunciationType} T
     * @param {import('dictionary').Pronunciation[]} pronunciations
     * @param {T} type
     * @returns {import('dictionary').PronunciationGeneric<T>[]}
     */
    static getPronunciationsOfType(pronunciations, type) {
        /** @type {import('dictionary').PronunciationGeneric<T>[]} */
        const results = [];
        for (const pronunciation of pronunciations) {
            if (pronunciation.type !== type) { continue; }
            // This is type safe, but for some reason the cast is needed.
            results.push(/** @type {import('dictionary').PronunciationGeneric<T>} */ (pronunciation));
        }
        return results;
    }

    /**
     * @param {import('dictionary').Tag[]|import('anki-templates').Tag[]} termTags
     * @returns {import('dictionary-data-util').TermFrequencyType}
     */
    static getTermFrequency(termTags) {
        let totalScore = 0;
        for (const {score} of termTags) {
            totalScore += score;
        }
        if (totalScore > 0) {
            return 'popular';
        } else if (totalScore < 0) {
            return 'rare';
        } else {
            return 'normal';
        }
    }

    /**
     * @param {import('dictionary').TermHeadword[]} headwords
     * @param {number[]} headwordIndices
     * @param {Set<string>} allTermsSet
     * @param {Set<string>} allReadingsSet
     * @returns {string[]}
     */
    static getDisambiguations(headwords, headwordIndices, allTermsSet, allReadingsSet) {
        if (allTermsSet.size <= 1 && allReadingsSet.size <= 1) { return []; }

        /** @type {Set<string>} */
        const terms = new Set();
        /** @type {Set<string>} */
        const readings = new Set();
        for (const headwordIndex of headwordIndices) {
            const {term, reading} = headwords[headwordIndex];
            terms.add(term);
            readings.add(reading);
        }

        /** @type {string[]} */
        const disambiguations = [];
        const addTerms = !this._areSetsEqual(terms, allTermsSet);
        const addReadings = !this._areSetsEqual(readings, allReadingsSet);
        if (addTerms) {
            disambiguations.push(...this._getSetIntersection(terms, allTermsSet));
        }
        if (addReadings) {
            if (addTerms) {
                for (const term of terms) {
                    readings.delete(term);
                }
            }
            disambiguations.push(...this._getSetIntersection(readings, allReadingsSet));
        }
        return disambiguations;
    }

    /**
     * @param {string[]} wordClasses
     * @returns {boolean}
     */
    static isNonNounVerbOrAdjective(wordClasses) {
        let isVerbOrAdjective = false;
        let isSuruVerb = false;
        let isNoun = false;
        for (const wordClass of wordClasses) {
            switch (wordClass) {
                case 'v1':
                case 'v5':
                case 'vk':
                case 'vz':
                case 'adj-i':
                    isVerbOrAdjective = true;
                    break;
                case 'vs':
                    isVerbOrAdjective = true;
                    isSuruVerb = true;
                    break;
                case 'n':
                    isNoun = true;
                    break;
            }
        }
        return isVerbOrAdjective && !(isSuruVerb && isNoun);
    }

    // Private

    /**
     * @param {string} reading
     * @param {import('dictionary').Pronunciation} pronunciation
     * @param {import('dictionary-data-util').GroupedPronunciationInternal[]} groupedPronunciationList
     * @returns {?import('dictionary-data-util').GroupedPronunciationInternal}
     */
    static _findExistingGroupedPronunciation(reading, pronunciation, groupedPronunciationList) {
        const existingGroupedPronunciation = groupedPronunciationList.find((groupedPronunciation) => {
            return groupedPronunciation.reading === reading && this._arePronunciationsEquivalent(groupedPronunciation, pronunciation);
        });

        return existingGroupedPronunciation || null;
    }

    /**
     * @param {import('dictionary-data-util').GroupedPronunciationInternal} groupedPronunciation
     * @param {import('dictionary').Pronunciation} pronunciation2
     * @returns {boolean}
     */
    static _arePronunciationsEquivalent({pronunciation: pronunciation1}, pronunciation2) {
        if (
            pronunciation1.type !== pronunciation2.type ||
            !this._areTagListsEqual(pronunciation1.tags, pronunciation2.tags)
        ) {
            return false;
        }
        switch (pronunciation1.type) {
            case 'pitch-accent':
            {
                // This cast is valid based on the type check at the start of the function.
                const pitchAccent2 = /** @type {import('dictionary').PitchAccent} */ (pronunciation2);
                return (
                    pronunciation1.position === pitchAccent2.position &&
                    this._areArraysEqual(pronunciation1.nasalPositions, pitchAccent2.nasalPositions) &&
                    this._areArraysEqual(pronunciation1.devoicePositions, pitchAccent2.devoicePositions)
                );
            }
            case 'phonetic-transcription':
            {
                // This cast is valid based on the type check at the start of the function.
                const phoneticTranscription2 = /** @type {import('dictionary').PhoneticTranscription} */ (pronunciation2);
                return pronunciation1.ipa === phoneticTranscription2.ipa;
            }
        }
        return true;
    }

    /**
     * @template [T=unknown]
     * @param {T[]} array1
     * @param {T[]} array2
     * @returns {boolean}
     */
    static _areArraysEqual(array1, array2) {
        const ii = array1.length;
        if (ii !== array2.length) { return false; }
        for (let i = 0; i < ii; ++i) {
            if (array1[i] !== array2[i]) { return false; }
        }
        return true;
    }

    /**
     * @param {import('dictionary').Tag[]} tagList1
     * @param {import('dictionary').Tag[]} tagList2
     * @returns {boolean}
     */
    static _areTagListsEqual(tagList1, tagList2) {
        const ii = tagList1.length;
        if (tagList2.length !== ii) { return false; }

        for (let i = 0; i < ii; ++i) {
            const tag1 = tagList1[i];
            const tag2 = tagList2[i];
            if (tag1.name !== tag2.name || !this._areArraysEqual(tag1.dictionaries, tag2.dictionaries)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @template [T=unknown]
     * @param {Set<T>} set1
     * @param {Set<T>} set2
     * @returns {boolean}
     */
    static _areSetsEqual(set1, set2) {
        if (set1.size !== set2.size) {
            return false;
        }

        for (const value of set1) {
            if (!set2.has(value)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @template [T=unknown]
     * @param {Set<T>} set1
     * @param {Set<T>} set2
     * @returns {T[]}
     */
    static _getSetIntersection(set1, set2) {
        const result = [];
        for (const value of set1) {
            if (set2.has(value)) {
                result.push(value);
            }
        }
        return result;
    }

    /**
     * @param {unknown[]} array
     * @returns {string}
     */
    static _createMapKey(array) {
        return JSON.stringify(array);
    }
}

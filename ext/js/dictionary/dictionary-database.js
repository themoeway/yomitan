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

import {log} from '../core/logger.js';
import {stringReverse} from '../core/utilities.js';
import {Database} from '../data/database.js';

export class DictionaryDatabase {
    constructor() {
        /** @type {Database<import('dictionary-database').ObjectStoreName>} */
        this._db = new Database();
        /** @type {string} */
        this._dbName = 'dict';
        /** @type {import('dictionary-database').CreateQuery<string>} */
        this._createOnlyQuery1 = (item) => IDBKeyRange.only(item);
        /** @type {import('dictionary-database').CreateQuery<import('dictionary-database').DictionaryAndQueryRequest>} */
        this._createOnlyQuery2 = (item) => IDBKeyRange.only(item.query);
        /** @type {import('dictionary-database').CreateQuery<import('dictionary-database').TermExactRequest>} */
        this._createOnlyQuery3 = (item) => IDBKeyRange.only(item.term);
        /** @type {import('dictionary-database').CreateQuery<import('dictionary-database').MediaRequest>} */
        this._createOnlyQuery4 = (item) => IDBKeyRange.only(item.path);
        /** @type {import('dictionary-database').CreateQuery<string>} */
        this._createBoundQuery1 = (item) => IDBKeyRange.bound(item, `${item}\uffff`, false, false);
        /** @type {import('dictionary-database').CreateQuery<string>} */
        this._createBoundQuery2 = (item) => {
            item = stringReverse(item);
            return IDBKeyRange.bound(item, `${item}\uffff`, false, false);
        };
        /** @type {import('dictionary-database').CreateResult<import('dictionary-database').TermExactRequest, import('dictionary-database').DatabaseTermEntryWithId, import('dictionary-database').TermEntry>} */
        this._createTermBind1 = this._createTermExact.bind(this);
        /** @type {import('dictionary-database').CreateResult<import('dictionary-database').DictionaryAndQueryRequest, import('dictionary-database').DatabaseTermEntryWithId, import('dictionary-database').TermEntry>} */
        this._createTermBind2 = this._createTermSequenceExact.bind(this);
        /** @type {import('dictionary-database').CreateResult<string, import('dictionary-database').DatabaseTermMeta, import('dictionary-database').TermMeta>} */
        this._createTermMetaBind = this._createTermMeta.bind(this);
        /** @type {import('dictionary-database').CreateResult<string, import('dictionary-database').DatabaseKanjiEntry, import('dictionary-database').KanjiEntry>} */
        this._createKanjiBind = this._createKanji.bind(this);
        /** @type {import('dictionary-database').CreateResult<string, import('dictionary-database').DatabaseKanjiMeta, import('dictionary-database').KanjiMeta>} */
        this._createKanjiMetaBind = this._createKanjiMeta.bind(this);
        /** @type {import('dictionary-database').CreateResult<import('dictionary-database').MediaRequest, import('dictionary-database').MediaDataArrayBufferContent, import('dictionary-database').Media>} */
        this._createMediaBind = this._createMedia.bind(this);
    }

    /** */
    async prepare() {
        await this._db.open(
            this._dbName,
            60,
            /** @type {import('database').StructureDefinition<import('dictionary-database').ObjectStoreName>[]} */
            ([
                /** @type {import('database').StructureDefinition<import('dictionary-database').ObjectStoreName>} */
                ({
                    version: 20,
                    stores: {
                        terms: {
                            primaryKey: {keyPath: 'id', autoIncrement: true},
                            indices: ['dictionary', 'expression', 'reading']
                        },
                        kanji: {
                            primaryKey: {autoIncrement: true},
                            indices: ['dictionary', 'character']
                        },
                        tagMeta: {
                            primaryKey: {autoIncrement: true},
                            indices: ['dictionary']
                        },
                        dictionaries: {
                            primaryKey: {autoIncrement: true},
                            indices: ['title', 'version']
                        }
                    }
                }),
                {
                    version: 30,
                    stores: {
                        termMeta: {
                            primaryKey: {autoIncrement: true},
                            indices: ['dictionary', 'expression']
                        },
                        kanjiMeta: {
                            primaryKey: {autoIncrement: true},
                            indices: ['dictionary', 'character']
                        },
                        tagMeta: {
                            primaryKey: {autoIncrement: true},
                            indices: ['dictionary', 'name']
                        }
                    }
                },
                {
                    version: 40,
                    stores: {
                        terms: {
                            primaryKey: {keyPath: 'id', autoIncrement: true},
                            indices: ['dictionary', 'expression', 'reading', 'sequence']
                        }
                    }
                },
                {
                    version: 50,
                    stores: {
                        terms: {
                            primaryKey: {keyPath: 'id', autoIncrement: true},
                            indices: ['dictionary', 'expression', 'reading', 'sequence', 'expressionReverse', 'readingReverse']
                        }
                    }
                },
                {
                    version: 60,
                    stores: {
                        media: {
                            primaryKey: {keyPath: 'id', autoIncrement: true},
                            indices: ['dictionary', 'path']
                        }
                    }
                }
            ])
        );
    }

    /** */
    async close() {
        this._db.close();
    }

    /**
     * @returns {boolean}
     */
    isPrepared() {
        return this._db.isOpen();
    }

    /**
     * @returns {Promise<boolean>}
     */
    async purge() {
        if (this._db.isOpening()) {
            throw new Error('Cannot purge database while opening');
        }
        if (this._db.isOpen()) {
            this._db.close();
        }
        let result = false;
        try {
            await Database.deleteDatabase(this._dbName);
            result = true;
        } catch (e) {
            log.error(e);
        }
        await this.prepare();
        return result;
    }

    /**
     * @param {string} dictionaryName
     * @param {number} progressRate
     * @param {import('dictionary-database').DeleteDictionaryProgressCallback} onProgress
     */
    async deleteDictionary(dictionaryName, progressRate, onProgress) {
        /** @type {[objectStoreName: import('dictionary-database').ObjectStoreName, key: string][][]} */
        const targetGroups = [
            [
                ['kanji', 'dictionary'],
                ['kanjiMeta', 'dictionary'],
                ['terms', 'dictionary'],
                ['termMeta', 'dictionary'],
                ['tagMeta', 'dictionary'],
                ['media', 'dictionary']
            ],
            [
                ['dictionaries', 'title']
            ]
        ];

        let storeCount = 0;
        for (const targets of targetGroups) {
            storeCount += targets.length;
        }

        /** @type {import('dictionary-database').DeleteDictionaryProgressData} */
        const progressData = {
            count: 0,
            processed: 0,
            storeCount,
            storesProcesed: 0
        };

        /**
         * @param {IDBValidKey[]} keys
         * @returns {IDBValidKey[]}
         */
        const filterKeys = (keys) => {
            ++progressData.storesProcesed;
            progressData.count += keys.length;
            onProgress(progressData);
            return keys;
        };
        const onProgressWrapper = () => {
            const processed = progressData.processed + 1;
            progressData.processed = processed;
            if ((processed % progressRate) === 0 || processed === progressData.count) {
                onProgress(progressData);
            }
        };

        for (const targets of targetGroups) {
            const promises = [];
            for (const [objectStoreName, indexName] of targets) {
                const query = IDBKeyRange.only(dictionaryName);
                const promise = this._db.bulkDelete(objectStoreName, indexName, query, filterKeys, onProgressWrapper);
                promises.push(promise);
            }
            await Promise.all(promises);
        }
    }

    /**
     * @param {string[]} termList
     * @param {import('dictionary-database').DictionarySet} dictionaries
     * @param {import('dictionary-database').MatchType} matchType
     * @returns {Promise<import('dictionary-database').TermEntry[]>}
     */
    findTermsBulk(termList, dictionaries, matchType) {
        const visited = new Set();
        /** @type {import('dictionary-database').FindPredicate<string, import('dictionary-database').DatabaseTermEntryWithId>} */
        const predicate = (row) => {
            if (!dictionaries.has(row.dictionary)) { return false; }
            const {id} = row;
            if (visited.has(id)) { return false; }
            visited.add(id);
            return true;
        };

        const indexNames = (matchType === 'suffix') ? ['expressionReverse', 'readingReverse'] : ['expression', 'reading'];

        let createQuery = this._createOnlyQuery1;
        switch (matchType) {
            case 'prefix':
                createQuery = this._createBoundQuery1;
                break;
            case 'suffix':
                createQuery = this._createBoundQuery2;
                break;
        }

        const createResult = this._createTermGeneric.bind(this, matchType);

        return this._findMultiBulk('terms', indexNames, termList, createQuery, predicate, createResult);
    }

    /**
     * @param {import('dictionary-database').TermExactRequest[]} termList
     * @param {import('dictionary-database').DictionarySet} dictionaries
     * @returns {Promise<import('dictionary-database').TermEntry[]>}
     */
    findTermsExactBulk(termList, dictionaries) {
        /** @type {import('dictionary-database').FindPredicate<import('dictionary-database').TermExactRequest, import('dictionary-database').DatabaseTermEntry>} */
        const predicate = (row, item) => (row.reading === item.reading && dictionaries.has(row.dictionary));
        return this._findMultiBulk('terms', ['expression'], termList, this._createOnlyQuery3, predicate, this._createTermBind1);
    }

    /**
     * @param {import('dictionary-database').DictionaryAndQueryRequest[]} items
     * @returns {Promise<import('dictionary-database').TermEntry[]>}
     */
    findTermsBySequenceBulk(items) {
        /** @type {import('dictionary-database').FindPredicate<import('dictionary-database').DictionaryAndQueryRequest, import('dictionary-database').DatabaseTermEntry>} */
        const predicate = (row, item) => (row.dictionary === item.dictionary);
        return this._findMultiBulk('terms', ['sequence'], items, this._createOnlyQuery2, predicate, this._createTermBind2);
    }

    /**
     * @param {string[]} termList
     * @param {import('dictionary-database').DictionarySet} dictionaries
     * @returns {Promise<import('dictionary-database').TermMeta[]>}
     */
    findTermMetaBulk(termList, dictionaries) {
        /** @type {import('dictionary-database').FindPredicate<string, import('dictionary-database').DatabaseTermMeta>} */
        const predicate = (row) => dictionaries.has(row.dictionary);
        return this._findMultiBulk('termMeta', ['expression'], termList, this._createOnlyQuery1, predicate, this._createTermMetaBind);
    }

    /**
     * @param {string[]} kanjiList
     * @param {import('dictionary-database').DictionarySet} dictionaries
     * @returns {Promise<import('dictionary-database').KanjiEntry[]>}
     */
    findKanjiBulk(kanjiList, dictionaries) {
        /** @type {import('dictionary-database').FindPredicate<string, import('dictionary-database').DatabaseKanjiEntry>} */
        const predicate = (row) => dictionaries.has(row.dictionary);
        return this._findMultiBulk('kanji', ['character'], kanjiList, this._createOnlyQuery1, predicate, this._createKanjiBind);
    }

    /**
     * @param {string[]} kanjiList
     * @param {import('dictionary-database').DictionarySet} dictionaries
     * @returns {Promise<import('dictionary-database').KanjiMeta[]>}
     */
    findKanjiMetaBulk(kanjiList, dictionaries) {
        /** @type {import('dictionary-database').FindPredicate<string, import('dictionary-database').DatabaseKanjiMeta>} */
        const predicate = (row) => dictionaries.has(row.dictionary);
        return this._findMultiBulk('kanjiMeta', ['character'], kanjiList, this._createOnlyQuery1, predicate, this._createKanjiMetaBind);
    }

    /**
     * @param {import('dictionary-database').DictionaryAndQueryRequest[]} items
     * @returns {Promise<(import('dictionary-database').Tag|undefined)[]>}
     */
    findTagMetaBulk(items) {
        /** @type {import('dictionary-database').FindPredicate<import('dictionary-database').DictionaryAndQueryRequest, import('dictionary-database').Tag>} */
        const predicate = (row, item) => (row.dictionary === item.dictionary);
        return this._findFirstBulk('tagMeta', 'name', items, this._createOnlyQuery2, predicate);
    }

    /**
     * @param {string} name
     * @param {string} dictionary
     * @returns {Promise<?import('dictionary-database').Tag>}
     */
    findTagForTitle(name, dictionary) {
        const query = IDBKeyRange.only(name);
        return this._db.find('tagMeta', 'name', query, (row) => (/** @type {import('dictionary-database').Tag} */ (row).dictionary === dictionary), null, null);
    }

    /**
     * @param {import('dictionary-database').MediaRequest[]} items
     * @returns {Promise<import('dictionary-database').Media[]>}
     */
    getMedia(items) {
        /** @type {import('dictionary-database').FindPredicate<import('dictionary-database').MediaRequest, import('dictionary-database').MediaDataArrayBufferContent>} */
        const predicate = (row, item) => (row.dictionary === item.dictionary);
        return this._findMultiBulk('media', ['path'], items, this._createOnlyQuery4, predicate, this._createMediaBind);
    }

    /**
     * This requires the ability to call URL.createObjectURL, which is not available in a service worker. Therefore Chrome must go through the Offscreen API as opposed to directly calling this.
     * @param {import('dictionary-database').MediaRequest[]} items
     * @returns {Promise<import('dictionary-database').MediaObject[]>}
     */
    async getMediaObjects(items) {
        /** @type {import('dictionary-database').FindPredicate<import('dictionary-database').MediaRequest, import('dictionary-database').MediaDataArrayBufferContent>} */
        const predicate = (row, item) => (row.dictionary === item.dictionary);
        return (await this._findMultiBulk('media', ['path'], items, this._createOnlyQuery4, predicate, this._createMediaBind)).map((m) => {
            const blob = new Blob([m.content], {type: m.mediaType});
            const url = URL.createObjectURL(blob);
            return {...m, content: null, url};
        });
    }

    /**
     * @returns {Promise<import('dictionary-importer').Summary[]>}
     */
    getDictionaryInfo() {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(['dictionaries'], 'readonly');
            const objectStore = transaction.objectStore('dictionaries');
            this._db.getAll(objectStore, null, resolve, reject, null);
        });
    }

    /**
     * @param {string[]} dictionaryNames
     * @param {boolean} getTotal
     * @returns {Promise<import('dictionary-database').DictionaryCounts>}
     */
    getDictionaryCounts(dictionaryNames, getTotal) {
        return new Promise((resolve, reject) => {
            const targets = [
                ['kanji', 'dictionary'],
                ['kanjiMeta', 'dictionary'],
                ['terms', 'dictionary'],
                ['termMeta', 'dictionary'],
                ['tagMeta', 'dictionary'],
                ['media', 'dictionary']
            ];
            const objectStoreNames = targets.map(([objectStoreName]) => objectStoreName);
            const transaction = this._db.transaction(objectStoreNames, 'readonly');
            const databaseTargets = targets.map(([objectStoreName, indexName]) => {
                const objectStore = transaction.objectStore(objectStoreName);
                const index = objectStore.index(indexName);
                return {objectStore, index};
            });

            /** @type {import('database').CountTarget[]} */
            const countTargets = [];
            if (getTotal) {
                for (const {objectStore} of databaseTargets) {
                    countTargets.push([objectStore, void 0]);
                }
            }
            for (const dictionaryName of dictionaryNames) {
                const query = IDBKeyRange.only(dictionaryName);
                for (const {index} of databaseTargets) {
                    countTargets.push([index, query]);
                }
            }

            /**
             * @param {number[]} results
             */
            const onCountComplete = (results) => {
                const resultCount = results.length;
                const targetCount = targets.length;
                /** @type {import('dictionary-database').DictionaryCountGroup[]} */
                const counts = [];
                for (let i = 0; i < resultCount; i += targetCount) {
                    /** @type {import('dictionary-database').DictionaryCountGroup} */
                    const countGroup = {};
                    for (let j = 0; j < targetCount; ++j) {
                        countGroup[targets[j][0]] = results[i + j];
                    }
                    counts.push(countGroup);
                }
                const total = getTotal ? /** @type {import('dictionary-database').DictionaryCountGroup} */ (counts.shift()) : null;
                resolve({total, counts});
            };

            this._db.bulkCount(countTargets, onCountComplete, reject);
        });
    }

    /**
     * @param {string} title
     * @returns {Promise<boolean>}
     */
    async dictionaryExists(title) {
        const query = IDBKeyRange.only(title);
        const result = await this._db.find('dictionaries', 'title', query, null, null, void 0);
        return typeof result !== 'undefined';
    }

    /**
     * @template {import('dictionary-database').ObjectStoreName} T
     * @param {T} objectStoreName
     * @param {import('dictionary-database').ObjectStoreData<T>[]} items
     * @param {number} start
     * @param {number} count
     * @returns {Promise<void>}
     */
    bulkAdd(objectStoreName, items, start, count) {
        return this._db.bulkAdd(objectStoreName, items, start, count);
    }

    // Private

    /**
     * @template [TRow=unknown]
     * @template [TItem=unknown]
     * @template [TResult=unknown]
     * @param {import('dictionary-database').ObjectStoreName} objectStoreName
     * @param {string[]} indexNames
     * @param {TItem[]} items
     * @param {import('dictionary-database').CreateQuery<TItem>} createQuery
     * @param {import('dictionary-database').FindPredicate<TItem, TRow>} predicate
     * @param {import('dictionary-database').CreateResult<TItem, TRow, TResult>} createResult
     * @returns {Promise<TResult[]>}
     */
    _findMultiBulk(objectStoreName, indexNames, items, createQuery, predicate, createResult) {
        return new Promise((resolve, reject) => {
            const itemCount = items.length;
            const indexCount = indexNames.length;
            /** @type {TResult[]} */
            const results = [];
            if (itemCount === 0 || indexCount === 0) {
                resolve(results);
                return;
            }

            const transaction = this._db.transaction([objectStoreName], 'readonly');
            const objectStore = transaction.objectStore(objectStoreName);
            const indexList = [];
            for (const indexName of indexNames) {
                indexList.push(objectStore.index(indexName));
            }
            let completeCount = 0;
            const requiredCompleteCount = itemCount * indexCount;
            /**
             * @param {TRow[]} rows
             * @param {import('dictionary-database').FindMultiBulkData<TItem>} data
             */
            const onGetAll = (rows, data) => {
                for (const row of rows) {
                    if (predicate(row, data.item)) {
                        results.push(createResult(row, data));
                    }
                }
                if (++completeCount >= requiredCompleteCount) {
                    resolve(results);
                }
            };
            for (let i = 0; i < itemCount; ++i) {
                const item = items[i];
                const query = createQuery(item);
                for (let j = 0; j < indexCount; ++j) {
                    /** @type {import('dictionary-database').FindMultiBulkData<TItem>} */
                    const data = {item, itemIndex: i, indexIndex: j};
                    this._db.getAll(indexList[j], query, onGetAll, reject, data);
                }
            }
        });
    }

    /**
     * @template [TRow=unknown]
     * @template [TItem=unknown]
     * @param {import('dictionary-database').ObjectStoreName} objectStoreName
     * @param {string} indexName
     * @param {TItem[]} items
     * @param {import('dictionary-database').CreateQuery<TItem>} createQuery
     * @param {import('dictionary-database').FindPredicate<TItem, TRow>} predicate
     * @returns {Promise<(TRow|undefined)[]>}
     */
    _findFirstBulk(objectStoreName, indexName, items, createQuery, predicate) {
        return new Promise((resolve, reject) => {
            const itemCount = items.length;
            /** @type {(TRow|undefined)[]} */
            const results = new Array(itemCount);
            if (itemCount === 0) {
                resolve(results);
                return;
            }

            const transaction = this._db.transaction([objectStoreName], 'readonly');
            const objectStore = transaction.objectStore(objectStoreName);
            const index = objectStore.index(indexName);
            let completeCount = 0;
            /**
             * @param {TRow|undefined} row
             * @param {number} itemIndex
             */
            const onFind = (row, itemIndex) => {
                results[itemIndex] = row;
                if (++completeCount >= itemCount) {
                    resolve(results);
                }
            };
            for (let i = 0; i < itemCount; ++i) {
                const item = items[i];
                const query = createQuery(item);
                this._db.findFirst(index, query, onFind, reject, i, predicate, item, void 0);
            }
        });
    }

    /**
     * @param {import('dictionary-database').MatchType} matchType
     * @param {import('dictionary-database').DatabaseTermEntryWithId} row
     * @param {import('dictionary-database').FindMultiBulkData<string>} data
     * @returns {import('dictionary-database').TermEntry}
     */
    _createTermGeneric(matchType, row, data) {
        const matchSourceIsTerm = (data.indexIndex === 0);
        const matchSource = (matchSourceIsTerm ? 'term' : 'reading');
        if ((matchSourceIsTerm ? row.expression : row.reading) === data.item) {
            matchType = 'exact';
        }
        return this._createTerm(matchSource, matchType, row, data.itemIndex);
    }

    /**
     * @param {import('dictionary-database').DatabaseTermEntryWithId} row
     * @param {import('dictionary-database').FindMultiBulkData<import('dictionary-database').TermExactRequest>} data
     * @returns {import('dictionary-database').TermEntry}
     */
    _createTermExact(row, data) {
        return this._createTerm('term', 'exact', row, data.itemIndex);
    }

    /**
     * @param {import('dictionary-database').DatabaseTermEntryWithId} row
     * @param {import('dictionary-database').FindMultiBulkData<import('dictionary-database').DictionaryAndQueryRequest>} data
     * @returns {import('dictionary-database').TermEntry}
     */
    _createTermSequenceExact(row, data) {
        return this._createTerm('sequence', 'exact', row, data.itemIndex);
    }

    /**
     * @param {import('dictionary-database').MatchSource} matchSource
     * @param {import('dictionary-database').MatchType} matchType
     * @param {import('dictionary-database').DatabaseTermEntryWithId} row
     * @param {number} index
     * @returns {import('dictionary-database').TermEntry}
     */
    _createTerm(matchSource, matchType, row, index) {
        const {sequence} = row;
        return {
            index,
            matchType,
            matchSource,
            term: row.expression,
            reading: row.reading,
            definitionTags: this._splitField(row.definitionTags || row.tags),
            termTags: this._splitField(row.termTags),
            rules: this._splitField(row.rules),
            definitions: row.glossary,
            score: row.score,
            dictionary: row.dictionary,
            id: row.id,
            sequence: typeof sequence === 'number' ? sequence : -1
        };
    }

    /**
     * @param {import('dictionary-database').DatabaseKanjiEntry} row
     * @param {import('dictionary-database').FindMultiBulkData<string>} data
     * @returns {import('dictionary-database').KanjiEntry}
     */
    _createKanji(row, {itemIndex: index}) {
        const {stats} = row;
        return {
            index,
            character: row.character,
            onyomi: this._splitField(row.onyomi),
            kunyomi: this._splitField(row.kunyomi),
            tags: this._splitField(row.tags),
            definitions: row.meanings,
            stats: typeof stats === 'object' && stats !== null ? stats : {},
            dictionary: row.dictionary
        };
    }

    /**
     * @param {import('dictionary-database').DatabaseTermMeta} row
     * @param {import('dictionary-database').FindMultiBulkData<string>} data
     * @returns {import('dictionary-database').TermMeta}
     * @throws {Error}
     */
    _createTermMeta({expression: term, mode, data, dictionary}, {itemIndex: index}) {
        switch (mode) {
            case 'freq':
                return {index, term, mode, data, dictionary};
            case 'pitch':
                return {index, term, mode, data, dictionary};
            case 'ipa':
                return {index, term, mode, data, dictionary};
            default:
                throw new Error(`Unknown mode: ${mode}`);
        }
    }

    /**
     * @param {import('dictionary-database').DatabaseKanjiMeta} row
     * @param {import('dictionary-database').FindMultiBulkData<string>} data
     * @returns {import('dictionary-database').KanjiMeta}
     */
    _createKanjiMeta({character, mode, data, dictionary}, {itemIndex: index}) {
        return {index, character, mode, data, dictionary};
    }

    /**
     * @param {import('dictionary-database').MediaDataArrayBufferContent} row
     * @param {import('dictionary-database').FindMultiBulkData<import('dictionary-database').MediaRequest>} data
     * @returns {import('dictionary-database').Media}
     */
    _createMedia(row, {itemIndex: index}) {
        const {dictionary, path, mediaType, width, height, content} = row;
        return {index, dictionary, path, mediaType, width, height, content};
    }

    /**
     * @param {unknown} field
     * @returns {string[]}
     */
    _splitField(field) {
        return typeof field === 'string' && field.length > 0 ? field.split(' ') : [];
    }
}

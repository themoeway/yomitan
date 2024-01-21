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

/**
 * @template {string} TObjectStoreName
 */
export class Database {
    constructor() {
        /** @type {?IDBDatabase} */
        this._db = null;
        /** @type {boolean} */
        this._isOpening = false;
    }

    /**
     * @param {string} databaseName
     * @param {number} version
     * @param {import('database').StructureDefinition<TObjectStoreName>[]} structure
     */
    async open(databaseName, version, structure) {
        if (this._db !== null) {
            throw new Error('Database already open');
        }
        if (this._isOpening) {
            throw new Error('Already opening');
        }

        try {
            this._isOpening = true;
            this._db = await this._open(databaseName, version, (db, transaction, oldVersion) => {
                this._upgrade(db, transaction, oldVersion, structure);
            });
        } finally {
            this._isOpening = false;
        }
    }

    /**
     * @throws {Error}
     */
    close() {
        if (this._db === null) {
            throw new Error('Database is not open');
        }

        this._db.close();
        this._db = null;
    }

    /**
     * Returns true if the database opening is in process.
     * @returns {boolean}
     */
    isOpening() {
        return this._isOpening;
    }

    /**
     * Returns true if the database is fully opened.
     * @returns {boolean}
     */
    isOpen() {
        return this._db !== null;
    }

    /**
     * Returns a new transaction with the given mode ("readonly" or "readwrite") and scope which can be a single object store name or an array of names.
     * @param {string[]} storeNames
     * @param {IDBTransactionMode} mode
     * @returns {IDBTransaction}
     * @throws {Error}
     */
    transaction(storeNames, mode) {
        if (this._db === null) {
            throw new Error(this._isOpening ? 'Database not ready' : 'Database not open');
        }
        return this._db.transaction(storeNames, mode);
    }

    /**
     * Add items in bulk to the object store.
     * _count_ items will be added, starting from _start_ index of _items_ list.
     * @param {TObjectStoreName} objectStoreName
     * @param {unknown[]} items List of items to add.
     * @param {number} start Start index. Added items begin at _items_[_start_].
     * @param {number} count Count of items to add.
     * @returns {Promise<void>}
     */
    bulkAdd(objectStoreName, items, start, count) {
        return new Promise((resolve, reject) => {
            if (start + count > items.length) {
                count = items.length - start;
            }

            if (count <= 0) {
                resolve();
                return;
            }

            const transaction = this._readWriteTransaction([objectStoreName], resolve, reject);
            const objectStore = transaction.objectStore(objectStoreName);
            for (let i = start, ii = start + count; i < ii; ++i) {
                objectStore.add(items[i]);
            }
            transaction.commit();
        });
    }

    /**
     * @template [TData=unknown]
     * @template [TResult=unknown]
     * @param {IDBObjectStore|IDBIndex} objectStoreOrIndex
     * @param {?IDBValidKey|IDBKeyRange} query
     * @param {(results: TResult[], data: TData) => void} onSuccess
     * @param {(reason: unknown, data: TData) => void} onError
     * @param {TData} data
     */
    getAll(objectStoreOrIndex, query, onSuccess, onError, data) {
        if (typeof objectStoreOrIndex.getAll === 'function') {
            this._getAllFast(objectStoreOrIndex, query, onSuccess, onError, data);
        } else {
            this._getAllUsingCursor(objectStoreOrIndex, query, onSuccess, onError, data);
        }
    }

    /**
     * @param {IDBObjectStore|IDBIndex} objectStoreOrIndex
     * @param {IDBValidKey|IDBKeyRange} query
     * @param {(value: IDBValidKey[]) => void} onSuccess
     * @param {(reason?: unknown) => void} onError
     */
    getAllKeys(objectStoreOrIndex, query, onSuccess, onError) {
        if (typeof objectStoreOrIndex.getAllKeys === 'function') {
            this._getAllKeysFast(objectStoreOrIndex, query, onSuccess, onError);
        } else {
            this._getAllKeysUsingCursor(objectStoreOrIndex, query, onSuccess, onError);
        }
    }

    /**
     * @template [TPredicateArg=unknown]
     * @template [TResult=unknown]
     * @template [TResultDefault=unknown]
     * @param {TObjectStoreName} objectStoreName
     * @param {?string} indexName
     * @param {?IDBValidKey|IDBKeyRange} query
     * @param {?((value: TResult|TResultDefault, predicateArg: TPredicateArg) => boolean)} predicate
     * @param {TPredicateArg} predicateArg
     * @param {TResultDefault} defaultValue
     * @returns {Promise<TResult|TResultDefault>}
     */
    find(objectStoreName, indexName, query, predicate, predicateArg, defaultValue) {
        return new Promise((resolve, reject) => {
            const transaction = this.transaction([objectStoreName], 'readonly');
            const objectStore = transaction.objectStore(objectStoreName);
            const objectStoreOrIndex = indexName !== null ? objectStore.index(indexName) : objectStore;
            this.findFirst(objectStoreOrIndex, query, resolve, reject, null, predicate, predicateArg, defaultValue);
        });
    }

    /**
     * @template [TData=unknown]
     * @template [TPredicateArg=unknown]
     * @template [TResult=unknown]
     * @template [TResultDefault=unknown]
     * @param {IDBObjectStore|IDBIndex} objectStoreOrIndex
     * @param {?IDBValidKey|IDBKeyRange} query
     * @param {(value: TResult|TResultDefault, data: TData) => void} resolve
     * @param {(reason: unknown, data: TData) => void} reject
     * @param {TData} data
     * @param {?((value: TResult, predicateArg: TPredicateArg) => boolean)} predicate
     * @param {TPredicateArg} predicateArg
     * @param {TResultDefault} defaultValue
     */
    findFirst(objectStoreOrIndex, query, resolve, reject, data, predicate, predicateArg, defaultValue) {
        const noPredicate = (typeof predicate !== 'function');
        const request = objectStoreOrIndex.openCursor(query, 'next');
        request.onerror = (e) => reject(/** @type {IDBRequest<?IDBCursorWithValue>} */ (e.target).error, data);
        request.onsuccess = (e) => {
            const cursor = /** @type {IDBRequest<?IDBCursorWithValue>} */ (e.target).result;
            if (cursor) {
                const {value} = cursor;
                if (noPredicate || predicate(value, predicateArg)) {
                    resolve(value, data);
                } else {
                    cursor.continue();
                }
            } else {
                resolve(defaultValue, data);
            }
        };
    }

    /**
     * @param {import('database').CountTarget[]} targets
     * @param {(results: number[]) => void} resolve
     * @param {(reason?: unknown) => void} reject
     */
    bulkCount(targets, resolve, reject) {
        const targetCount = targets.length;
        if (targetCount <= 0) {
            resolve([]);
            return;
        }

        let completedCount = 0;
        /** @type {number[]} */
        const results = new Array(targetCount).fill(null);

        /**
         * @param {Event} e
         * @returns {void}
         */
        const onError = (e) => reject(/** @type {IDBRequest<number>} */ (e.target).error);
        /**
         * @param {Event} e
         * @param {number} index
         */
        const onSuccess = (e, index) => {
            const count = /** @type {IDBRequest<number>} */ (e.target).result;
            results[index] = count;
            if (++completedCount >= targetCount) {
                resolve(results);
            }
        };

        for (let i = 0; i < targetCount; ++i) {
            const index = i;
            const [objectStoreOrIndex, query] = targets[i];
            const request = objectStoreOrIndex.count(query);
            request.onerror = onError;
            request.onsuccess = (e) => onSuccess(e, index);
        }
    }

    /**
     * Deletes records in store with the given key or in the given key range in query.
     * @param {TObjectStoreName} objectStoreName
     * @param {IDBValidKey|IDBKeyRange} key
     * @returns {Promise<void>}
     */
    delete(objectStoreName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this._readWriteTransaction([objectStoreName], resolve, reject);
            const objectStore = transaction.objectStore(objectStoreName);
            objectStore.delete(key);
            transaction.commit();
        });
    }

    /**
     * Delete items in bulk from the object store.
     * @param {TObjectStoreName} objectStoreName
     * @param {?string} indexName
     * @param {IDBKeyRange} query
     * @param {?(keys: IDBValidKey[]) => IDBValidKey[]} filterKeys
     * @param {?(completedCount: number, totalCount: number) => void} onProgress
     * @returns {Promise<void>}
     */
    bulkDelete(objectStoreName, indexName, query, filterKeys = null, onProgress = null) {
        return new Promise((resolve, reject) => {
            const transaction = this._readWriteTransaction([objectStoreName], resolve, reject);
            const objectStore = transaction.objectStore(objectStoreName);
            const objectStoreOrIndex = indexName !== null ? objectStore.index(indexName) : objectStore;

            /**
             * @param {IDBValidKey[]} keys
             */
            const onGetKeys = (keys) => {
                try {
                    if (typeof filterKeys === 'function') {
                        keys = filterKeys(keys);
                    }
                    this._bulkDeleteInternal(objectStore, keys, 1000, 0, onProgress, (error) => {
                        if (error !== null) {
                            transaction.commit();
                        }
                    });
                } catch (e) {
                    reject(e);
                }
            };

            this.getAllKeys(objectStoreOrIndex, query, onGetKeys, reject);
        });
    }

    /**
     * Attempts to delete the named database.
     * If the database already exists and there are open connections that don't close in response to a versionchange event, the request will be blocked until all they close.
     * If the request is successful request's result will be null.
     * @param {string} databaseName
     * @returns {Promise<void>}
     */
    static deleteDatabase(databaseName) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(databaseName);
            request.onerror = (e) => reject(/** @type {IDBRequest} */ (e.target).error);
            request.onsuccess = () => resolve();
            request.onblocked = () => reject(new Error('Database deletion blocked'));
        });
    }

    // Private

    /**
     * @param {string} name
     * @param {number} version
     * @param {import('database').UpdateFunction} onUpgradeNeeded
     * @returns {Promise<IDBDatabase>}
     */
    _open(name, version, onUpgradeNeeded) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(name, version);

            request.onupgradeneeded = (event) => {
                try {
                    const transaction = /** @type {IDBTransaction} */ (request.transaction);
                    transaction.onerror = (e) => reject(/** @type {IDBRequest} */ (e.target).error);
                    onUpgradeNeeded(request.result, transaction, event.oldVersion, event.newVersion);
                } catch (e) {
                    reject(e);
                }
            };

            request.onerror = (e) => reject(/** @type {IDBRequest} */ (e.target).error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    /**
     * @param {IDBDatabase} db
     * @param {IDBTransaction} transaction
     * @param {number} oldVersion
     * @param {import('database').StructureDefinition<TObjectStoreName>[]} upgrades
     */
    _upgrade(db, transaction, oldVersion, upgrades) {
        for (const {version, stores} of upgrades) {
            if (oldVersion >= version) { continue; }

            for (const [objectStoreName, {primaryKey, indices}] of Object.entries(stores)) {
                const existingObjectStoreNames = transaction.objectStoreNames || db.objectStoreNames;
                const objectStore = (
                    this._listContains(existingObjectStoreNames, objectStoreName) ?
                    transaction.objectStore(objectStoreName) :
                    db.createObjectStore(objectStoreName, primaryKey)
                );
                const existingIndexNames = objectStore.indexNames;

                for (const indexName of indices) {
                    if (this._listContains(existingIndexNames, indexName)) { continue; }

                    objectStore.createIndex(indexName, indexName, {});
                }
            }
        }
    }

    /**
     * @param {DOMStringList} list
     * @param {string} value
     * @returns {boolean}
     */
    _listContains(list, value) {
        for (let i = 0, ii = list.length; i < ii; ++i) {
            if (list[i] === value) { return true; }
        }
        return false;
    }

    /**
     * @template [TData=unknown]
     * @template [TResult=unknown]
     * @param {IDBObjectStore|IDBIndex} objectStoreOrIndex
     * @param {?IDBValidKey|IDBKeyRange} query
     * @param {(results: TResult[], data: TData) => void} onSuccess
     * @param {(reason: unknown, data: TData) => void} onReject
     * @param {TData} data
     */
    _getAllFast(objectStoreOrIndex, query, onSuccess, onReject, data) {
        const request = objectStoreOrIndex.getAll(query);
        request.onerror = (e) => onReject(/** @type {IDBRequest<import('core').SafeAny[]>} */ (e.target).error, data);
        request.onsuccess = (e) => onSuccess(/** @type {IDBRequest<import('core').SafeAny[]>} */ (e.target).result, data);
    }

    /**
     * @template [TData=unknown]
     * @template [TResult=unknown]
     * @param {IDBObjectStore|IDBIndex} objectStoreOrIndex
     * @param {?IDBValidKey|IDBKeyRange} query
     * @param {(results: TResult[], data: TData) => void} onSuccess
     * @param {(reason: unknown, data: TData) => void} onReject
     * @param {TData} data
     */
    _getAllUsingCursor(objectStoreOrIndex, query, onSuccess, onReject, data) {
        /** @type {TResult[]} */
        const results = [];
        const request = objectStoreOrIndex.openCursor(query, 'next');
        request.onerror = (e) => onReject(/** @type {IDBRequest<?IDBCursorWithValue>} */ (e.target).error, data);
        request.onsuccess = (e) => {
            const cursor = /** @type {IDBRequest<?IDBCursorWithValue>} */ (e.target).result;
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                onSuccess(results, data);
            }
        };
    }

    /**
     * @param {IDBObjectStore|IDBIndex} objectStoreOrIndex
     * @param {IDBValidKey|IDBKeyRange} query
     * @param {(value: IDBValidKey[]) => void} onSuccess
     * @param {(reason?: unknown) => void} onError
     */
    _getAllKeysFast(objectStoreOrIndex, query, onSuccess, onError) {
        const request = objectStoreOrIndex.getAllKeys(query);
        request.onerror = (e) => onError(/** @type {IDBRequest<IDBValidKey[]>} */ (e.target).error);
        request.onsuccess = (e) => onSuccess(/** @type {IDBRequest<IDBValidKey[]>} */ (e.target).result);
    }

    /**
     * @param {IDBObjectStore|IDBIndex} objectStoreOrIndex
     * @param {IDBValidKey|IDBKeyRange} query
     * @param {(value: IDBValidKey[]) => void} onSuccess
     * @param {(reason?: unknown) => void} onError
     */
    _getAllKeysUsingCursor(objectStoreOrIndex, query, onSuccess, onError) {
        /** @type {IDBValidKey[]} */
        const results = [];
        const request = objectStoreOrIndex.openKeyCursor(query, 'next');
        request.onerror = (e) => onError(/** @type {IDBRequest<?IDBCursor>} */ (e.target).error);
        request.onsuccess = (e) => {
            const cursor = /** @type {IDBRequest<?IDBCursor>} */ (e.target).result;
            if (cursor) {
                results.push(cursor.primaryKey);
                cursor.continue();
            } else {
                onSuccess(results);
            }
        };
    }

    /**
     * @param {IDBObjectStore} objectStore The object store from which items are being deleted.
     * @param {IDBValidKey[]} keys An array of keys to delete from the object store.
     * @param {number} maxActiveRequests The maximum number of concurrent requests.
     * @param {number} maxActiveRequestsForContinue The maximum number of requests that can be active before the next set of requests is started.
     *   For example:
     *   - If this value is `0`, all of the `maxActiveRequests` requests must complete before another group of `maxActiveRequests` is started off.
     *   - If the value is greater than or equal to `maxActiveRequests-1`, every time a single request completes, a new single request will be started.
     * @param {?(completedCount: number, totalCount: number) => void} onProgress An optional progress callback function.
     * @param {(error: ?Error) => void} onComplete A function which is called after all operations have finished.
     *   If an error occured, the `error` parameter will be non-`null`. Otherwise, it will be `null`.
     * @throws {Error} An error is thrown if the input parameters are invalid.
     */
    _bulkDeleteInternal(objectStore, keys, maxActiveRequests, maxActiveRequestsForContinue, onProgress, onComplete) {
        if (maxActiveRequests <= 0) { throw new Error(`maxActiveRequests has an invalid value: ${maxActiveRequests}`); }
        if (maxActiveRequestsForContinue < 0) { throw new Error(`maxActiveRequestsForContinue has an invalid value: ${maxActiveRequestsForContinue}`); }

        const count = keys.length;
        if (count === 0) {
            onComplete(null);
            return;
        }

        let completedCount = 0;
        let completed = false;
        let index = 0;
        let active = 0;

        const onSuccess = () => {
            if (completed) { return; }
            --active;
            ++completedCount;
            if (onProgress !== null) {
                try {
                    onProgress(completedCount, count);
                } catch (e) {
                    // NOP
                }
            }
            if (completedCount >= count) {
                completed = true;
                onComplete(null);
            } else if (active <= maxActiveRequestsForContinue) {
                next();
            }
        };

        /**
         * @param {Event} event
         */
        const onError = (event) => {
            if (completed) { return; }
            completed = true;
            const request = /** @type {IDBRequest<undefined>} */ (event.target);
            const {error} = request;
            onComplete(error);
        };

        const next = () => {
            for (; index < count && active < maxActiveRequests; ++index) {
                const key = keys[index];
                const request = objectStore.delete(key);
                request.onsuccess = onSuccess;
                request.onerror = onError;
                ++active;
            }
        };

        next();
    }

    /**
     * @param {string[]} storeNames
     * @param {() => void} resolve
     * @param {(reason?: unknown) => void} reject
     * @returns {IDBTransaction}
     */
    _readWriteTransaction(storeNames, resolve, reject) {
        const transaction = this.transaction(storeNames, 'readwrite');
        transaction.onerror = (e) => reject(/** @type {IDBTransaction} */ (e.target).error);
        transaction.onabort = () => reject(new Error('Transaction aborted'));
        transaction.oncomplete = () => resolve();
        return transaction;
    }
}

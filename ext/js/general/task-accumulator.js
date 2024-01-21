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

import {log} from '../core/logger.js';

/**
 * @template [K=unknown]
 * @template [V=unknown]
 */
export class TaskAccumulator {
    /**
     * @param {(tasks: [key: ?K, task: import('task-accumulator').Task<V>][]) => Promise<void>} runTasks
     */
    constructor(runTasks) {
        /** @type {?Promise<void>} */
        this._deferPromise = null;
        /** @type {?Promise<void>} */
        this._activePromise = null;
        /** @type {import('task-accumulator').Task<V>[]} */
        this._tasks = [];
        /** @type {import('task-accumulator').Task<V>[]} */
        this._tasksActive = [];
        /** @type {Map<K, import('task-accumulator').Task<V>>} */
        this._uniqueTasks = new Map();
        /** @type {Map<K, import('task-accumulator').Task<V>>} */
        this._uniqueTasksActive = new Map();
        /** @type {() => Promise<void>} */
        this._runTasksBind = this._runTasks.bind(this);
        /** @type {() => void} */
        this._tasksCompleteBind = this._tasksComplete.bind(this);
        /** @type {(tasks: [key: ?K, task: import('task-accumulator').Task<V>][]) => Promise<void>} */
        this._runTasksCallback = runTasks;
    }

    /**
     * @param {?K} key
     * @param {V} data
     * @returns {Promise<void>}
     */
    enqueue(key, data) {
        if (this._deferPromise === null) {
            const promise = this._activePromise !== null ? this._activePromise : Promise.resolve();
            this._deferPromise = promise.then(this._runTasksBind);
        }

        /** @type {import('task-accumulator').Task<V>} */
        const task = {data, stale: false};
        if (key !== null) {
            const activeTaskInfo = this._uniqueTasksActive.get(key);
            if (typeof activeTaskInfo !== 'undefined') {
                activeTaskInfo.stale = true;
            }

            this._uniqueTasks.set(key, task);
        } else {
            this._tasks.push(task);
        }

        return this._deferPromise;
    }

    /**
     * @returns {Promise<void>}
     */
    _runTasks() {
        this._deferPromise = null;

        // Swap
        [this._tasks, this._tasksActive] = [this._tasksActive, this._tasks];
        [this._uniqueTasks, this._uniqueTasksActive] = [this._uniqueTasksActive, this._uniqueTasks];

        const promise = this._runTasksAsync();
        this._activePromise = promise.then(this._tasksCompleteBind);
        return this._activePromise;
    }

    /**
     * @returns {Promise<void>}
     */
    async _runTasksAsync() {
        try {
            /** @type {[key: ?K, task: import('task-accumulator').Task<V>][]} */
            const allTasks = [];
            for (const taskInfo of this._tasksActive) {
                allTasks.push([null, taskInfo]);
            }
            for (const [key, taskInfo] of this._uniqueTasksActive) {
                allTasks.push([key, taskInfo]);
            }
            await this._runTasksCallback(allTasks);
        } catch (e) {
            log.error(e);
        }
    }

    /**
     * @returns {void}
     */
    _tasksComplete() {
        this._tasksActive.length = 0;
        this._uniqueTasksActive.clear();
        this._activePromise = null;
    }
}

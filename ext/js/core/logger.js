/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2019-2022  Yomichan Authors
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

import {EventDispatcher} from './event-dispatcher.js';
import {ExtensionError} from './extension-error.js';

/**
 * This class handles logging of messages to the console and triggering
 * an event for log calls.
 * @augments EventDispatcher<import('log').Events>
 */
export class Logger extends EventDispatcher {
    /**
     * Creates a new instance.
     */
    constructor() {
        super();
        /** @type {string} */
        this._extensionName = 'Yomitan';
        try {
            const {name, version} = chrome.runtime.getManifest();
            this._extensionName = `${name} ${version}`;
        } catch (e) {
            // NOP
        }
    }

    /**
     * Logs a generic error. This will trigger the 'log' event with the same arguments as the function invocation.
     * @param {unknown} error The error to log. This is typically an `Error` or `Error`-like object.
     * @param {import('log').LogLevel} level The level to log at. Values include `'info'`, `'debug'`, `'warn'`, and `'error'`.
     *   Other values will be logged at a non-error level.
     * @param {?import('log').LogContext} [context] An optional context object for the error which should typically include a `url` field.
     */
    log(error, level, context = null) {
        if (typeof context !== 'object' || context === null) {
            context = {url: location.href};
        }

        let errorString;
        try {
            if (typeof error === 'string') {
                errorString = error;
            } else {
                errorString = (
                    typeof error === 'object' && error !== null ?
                    error.toString() :
                    `${error}`
                );
                if (/^\[object \w+\]$/.test(errorString)) {
                    errorString = JSON.stringify(error);
                }
            }
        } catch (e) {
            errorString = `${error}`;
        }

        let errorStack;
        try {
            errorStack = (
                error instanceof Error ?
                (typeof error.stack === 'string' ? error.stack.trimEnd() : '') :
                ''
            );
        } catch (e) {
            errorStack = '';
        }

        let errorData;
        try {
            if (error instanceof ExtensionError) {
                errorData = error.data;
            }
        } catch (e) {
            // NOP
        }

        if (errorStack.startsWith(errorString)) {
            errorString = errorStack;
        } else if (errorStack.length > 0) {
            errorString += `\n${errorStack}`;
        }

        let message = `${this._extensionName} has encountered a problem.`;
        message += `\nOriginating URL: ${context.url}\n`;
        message += errorString;
        if (typeof errorData !== 'undefined') {
            message += `\nData: ${JSON.stringify(errorData, null, 4)}`;
        }
        message += '\n\nIssues can be reported at https://github.com/themoeway/yomitan/issues';

        /* eslint-disable no-console */
        switch (level) {
            case 'log': console.log(message); break;
            case 'info': console.info(message); break;
            case 'debug': console.debug(message); break;
            case 'warn': console.warn(message); break;
            case 'error': console.error(message); break;
        }
        /* eslint-enable no-console */

        this.trigger('log', {error, level, context});
    }

    /**
     * Logs a warning. This function invokes `log` internally.
     * @param {unknown} error The error to log. This is typically an `Error` or `Error`-like object.
     * @param {?import('log').LogContext} context An optional context object for the error which should typically include a `url` field.
     */
    warn(error, context = null) {
        this.log(error, 'warn', context);
    }

    /**
     * Logs an error. This function invokes `log` internally.
     * @param {unknown} error The error to log. This is typically an `Error` or `Error`-like object.
     * @param {?import('log').LogContext} context An optional context object for the error which should typically include a `url` field.
     */
    error(error, context = null) {
        this.log(error, 'error', context);
    }

    /**
     * @param {import('log').LogLevel} errorLevel
     * @returns {import('log').LogErrorLevelValue}
     */
    getLogErrorLevelValue(errorLevel) {
        switch (errorLevel) {
            case 'log':
            case 'info':
            case 'debug':
                return 0;
            case 'warn': return 1;
            case 'error': return 2;
        }
    }
}

/**
 * This object is the default logger used by the runtime.
 */
export const log = new Logger();

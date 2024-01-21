/*
 * Copyright (C) 2023-2024  Yomitan Authors
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

import type {TextScanner} from '../../ext/js/language/text-scanner';
import type {DictionaryEntry} from './dictionary';
import type {OptionsContext} from './settings';
import type {InputInfo} from './text-scanner';
import type {TextSource} from './text-source';
import type {EventNames, EventArgument as BaseEventArgument} from './core';
import type {HistoryStateSentence, PageType} from './display';

export type Events = {
    searched: {
        textScanner: TextScanner;
        type: PageType;
        dictionaryEntries: DictionaryEntry[];
        sentence: HistoryStateSentence;
        inputInfo: InputInfo;
        textSource: TextSource;
        optionsContext: OptionsContext;
        sentenceOffset: number | null;
    };
};

export type EventArgument<TName extends EventNames<Events>> = BaseEventArgument<Events, TName>;

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

import type {DictionaryController} from '../../ext/js/pages/settings/dictionary-controller';
import type {ScanInputsController} from '../../ext/js/pages/settings/scan-inputs-controller';
import type {ScanInputsSimpleController} from '../../ext/js/pages/settings/scan-inputs-simple-controller';
import type * as Core from './core';
import type * as Settings from './settings';
import type * as SettingsModifications from './settings-modifications';
import type {EventNames, EventArgument as BaseEventArgument} from './core';

export type PageExitPrevention = {
    end: () => void;
};

export type Events = {
    optionsChanged: {
        options: Settings.ProfileOptions;
        optionsContext: Settings.OptionsContext;
    };
    optionsContextChanged: Record<string, never>;
    permissionsChanged: {
        permissions: chrome.permissions.Permissions;
    };
    dictionarySettingsReordered: {
        source: DictionaryController;
    };
    importDictionaryFromUrl: {
        url: string;
    };
    dictionaryEnabled: Record<string, never>;
    scanInputsChanged: {
        source: ScanInputsController | ScanInputsSimpleController;
    };
};

export type EventArgument<TName extends EventNames<Events>> = BaseEventArgument<Events, TName>;

export type SettingsRead<THasScope extends boolean> = THasScope extends true ? SettingsModifications.ScopedRead : SettingsModifications.Read;

export type SettingsModification<THasScope extends boolean> = THasScope extends true ? SettingsModifications.ScopedModification : SettingsModifications.Modification;

export type SettingsExtraFields<THasScope extends boolean> = THasScope extends true ? null : SettingsModifications.OptionsScope;

export type ModifyResult = Core.Response<SettingsModifications.ModificationResult>;

export type RecommendedSettingsByLanguage = {
    [key: string]: RecommendedSetting[];
};

export type RecommendedSetting = {
    action: string;
    path: string;
    value: string;
    description: string;
};

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

export type RunAt = 'document_start' | 'document_end' | 'document_idle';

/** The script registration details. */
export type RegistrationDetails = {
    /** Same as `matches` in the `content_scripts` manifest key. */
    matches: string[];
    /** Same as `run_at` in the `content_scripts` manifest key. */
    runAt: RunAt;
    /** Same as `all_frames` in the `content_scripts` manifest key. */
    allFrames: boolean;
    /** List of CSS paths. */
    css?: string[];
    /** List of script paths. */
    js?: string[];
    /** The execution world for the script. */
    world?: ExecutionWorld;
};

export type ContentScriptInjectionDetails = {
    allFrames: boolean;
    matchAboutBlank: boolean;
    runAt: RunAt;
    css?: string[];
    js?: string[];
    urlRegex: RegExp | null;
};

export type ExecutionWorld = 'MAIN' | 'ISOLATED';

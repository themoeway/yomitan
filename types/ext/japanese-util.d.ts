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

export type CodepointRange = [
    minInclusive: number,
    maxInclusive: number,
];

export type FuriganaGroup = {
    isKana: boolean;
    text: string;
    textNormalized: string | null;
};

export type FuriganaSegment = {
    text: string;
    reading: string;
};

export type PitchCategory = (
    'heiban' |
    'kifuku' |
    'atamadaka' |
    'odaka' |
    'nakadaka'
);

export type DiacriticType = 'dakuten' | 'handakuten';

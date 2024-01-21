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

export type DocumentUtilTestData = {
    elementFromPointSelector: string;
    caretRangeFromPointSelector: string;
    startNodeSelector: string;
    startOffset: number;
    endNodeSelector: string;
    endOffset: number;
    resultType: string;
    sentenceScanExtent: number;
    sentence: string;
    hasImposter: boolean | undefined;
    terminateAtNewlines: boolean | undefined;
};

export type DOMTextScannerTestData = {
    seekNodeSelector: string;
    seekNodeIsText: boolean;
    seekOffset: number;
    seekLength: number;
    seekDirection: string;
    expectedResultNodeSelector: string;
    expectedResultNodeIsText: boolean;
    expectedResultOffset: number;
    expectedResultContent: string[];
};

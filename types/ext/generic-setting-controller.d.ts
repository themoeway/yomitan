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

import type * as DocumentUtil from './document-util';
import type * as SettingsModifications from './settings-modifications';

export type TransformType = TransformData['type'];

export type ElementMetadata = {
    path: string;
    scope: SettingsModifications.OptionsScopeType | undefined;
    transforms: TransformData[];
    transformRaw: string | undefined;
};

export type TransformFunction = (
    value: unknown,
    data: TransformData,
    element: Element,
) => unknown;

export type TransformStep = 'pre' | 'post';

export type TransformData = (
    SetAttributeTransformData |
    SetVisibilityTransformData |
    SplitTagsTransformData |
    JoinTagsTransformData |
    ToNumberConstraintsTransformData |
    ToBooleanTransformData |
    ToStringTransformData |
    ConditionalConvertTransformData
);

export type TransformDataBase = {
    step?: TransformStep;
};

export type SetAttributeTransformData = TransformDataBase & {
    type: 'setAttribute';
    ancestorDistance?: number;
    selector?: string;
    attribute: string;
};

export type SetVisibilityTransformData = TransformDataBase & {
    type: 'setVisibility';
    ancestorDistance?: number;
    selector?: string;
    condition: OperationData;
};

export type SplitTagsTransformData = TransformDataBase & {
    type: 'splitTags';
};

export type JoinTagsTransformData = TransformDataBase & {
    type: 'joinTags';
};

export type ToNumberConstraintsTransformData = TransformDataBase & {
    type: 'toNumber';
    constraints?: DocumentUtil.ToNumberConstraints;
};

export type ToBooleanTransformData = TransformDataBase & {
    type: 'toBoolean';
};

export type ToStringTransformData = TransformDataBase & {
    type: 'toString';
};

export type ConditionalConvertTransformData = TransformDataBase & {
    type: 'conditionalConvert';
    cases?: ConditionalConvertCase[];
};

export type ConditionalConvertCase = {
    default?: boolean;
    result: unknown;
} & OperationData;

export type OperationData = {
    op: string;
    value: unknown;
};

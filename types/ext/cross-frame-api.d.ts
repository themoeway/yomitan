/*
 * Copyright (C) 2023  Yomitan Authors
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

import type * as Core from './core';

export type CrossFrameAPIPortEventType = 'disconnect';

export type AcknowledgeMessage = {
    type: 'ack';
    id: number;
};

export type ResultMessage = {
    type: 'result';
    id: number;
    data: Core.Response<unknown>;
};

export type InvokeMessage = {
    type: 'invoke';
    id: number;
    data: InvocationData;
};

export type InvocationData = {
    action: string;
    params: Core.SerializableObject;
};

export type Message = AcknowledgeMessage | ResultMessage | InvokeMessage;

export type Invocation = {
    id: number;
    resolve: (value: Core.SafeAny) => void;
    reject: (reason?: unknown) => void;
    responseTimeout: number;
    action: string;
    ack: boolean;
    timer: Core.Timeout | null;
};

export type PortDetails = CrossFrameCommunicationPortDetails | ActionPortDetails;

export type CrossFrameCommunicationPortDetails = {
    name: 'cross-frame-communication-port';
    otherTabId: number;
    otherFrameId: number;
};

export type ActionPortDetails = {
    name: 'action-port';
    id: string;
};

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
 * Class which is used to observe elements matching a selector in specific element.
 * @template [T=unknown]
 */
export class SelectorObserver {
    /**
     * Creates a new instance.
     * @param {import('selector-observer').ConstructorDetails<T>} details The configuration for the object.
     */
    constructor({selector, ignoreSelector = null, onAdded = null, onRemoved = null, onChildrenUpdated = null, isStale = null}) {
        /** @type {string} */
        this._selector = selector;
        /** @type {?string} */
        this._ignoreSelector = ignoreSelector;
        /** @type {?import('selector-observer').OnAddedCallback<T>} */
        this._onAdded = onAdded;
        /** @type {?import('selector-observer').OnRemovedCallback<T>} */
        this._onRemoved = onRemoved;
        /** @type {?import('selector-observer').OnChildrenUpdatedCallback<T>} */
        this._onChildrenUpdated = onChildrenUpdated;
        /** @type {?import('selector-observer').IsStaleCallback<T>} */
        this._isStale = isStale;
        /** @type {?Element} */
        this._observingElement = null;
        /** @type {MutationObserver} */
        this._mutationObserver = new MutationObserver(this._onMutation.bind(this));
        /** @type {Map<Node, import('selector-observer').Observer<T>>} */
        this._elementMap = new Map(); // Map([element => observer]...)
        /** @type {Map<Node, Set<import('selector-observer').Observer<T>>>} */
        this._elementAncestorMap = new Map(); // Map([element => Set([observer]...)]...)
        /** @type {boolean} */
        this._isObserving = false;
    }

    /**
     * Returns whether or not an element is currently being observed.
     * @returns {boolean} `true` if an element is being observed, `false` otherwise.
     */
    get isObserving() {
        return this._observingElement !== null;
    }

    /**
     * Starts DOM mutation observing the target element.
     * @param {Element} element The element to observe changes in.
     * @param {boolean} [attributes] A boolean for whether or not attribute changes should be observed.
     * @throws {Error} An error if element is null.
     * @throws {Error} An error if an element is already being observed.
     */
    observe(element, attributes = false) {
        if (element === null) {
            throw new Error('Invalid element');
        }
        if (this.isObserving) {
            throw new Error('Instance is already observing an element');
        }

        this._observingElement = element;
        this._mutationObserver.observe(element, {
            attributes: !!attributes,
            childList: true,
            subtree: true
        });

        const {parentNode} = element;
        this._onMutation([{
            type: 'childList',
            target: parentNode !== null ? parentNode : element,
            addedNodes: [element],
            removedNodes: []
        }]);
    }

    /**
     * Stops observing the target element.
     */
    disconnect() {
        if (!this.isObserving) { return; }

        this._mutationObserver.disconnect();
        this._observingElement = null;

        for (const observer of this._elementMap.values()) {
            this._removeObserver(observer);
        }
    }

    /**
     * Returns an iterable list of [element, data] pairs.
     * @yields {[element: Element, data: T]} A sequence of [element, data] pairs.
     * @returns {Generator<[element: Element, data: T], void, unknown>}
     */
    *entries() {
        for (const {element, data} of this._elementMap.values()) {
            yield [element, data];
        }
    }

    /**
     * Returns an iterable list of data for every element.
     * @yields {T} A sequence of data values.
     * @returns {Generator<T, void, unknown>}
     */
    *datas() {
        for (const {data} of this._elementMap.values()) {
            yield data;
        }
    }

    // Private

    /**
     * @param {(MutationRecord|import('selector-observer').MutationRecordLike)[]} mutationList
     */
    _onMutation(mutationList) {
        for (const mutation of mutationList) {
            switch (mutation.type) {
                case 'childList':
                    this._onChildListMutation(mutation);
                    break;
                case 'attributes':
                    this._onAttributeMutation(mutation);
                    break;
            }
        }
    }

    /**
     * @param {MutationRecord|import('selector-observer').MutationRecordLike} record
     */
    _onChildListMutation({addedNodes, removedNodes, target}) {
        const selector = this._selector;
        const ELEMENT_NODE = Node.ELEMENT_NODE;

        for (const node of removedNodes) {
            const observers = this._elementAncestorMap.get(node);
            if (typeof observers === 'undefined') { continue; }
            for (const observer of observers) {
                this._removeObserver(observer);
            }
        }

        for (const node of addedNodes) {
            if (node.nodeType !== ELEMENT_NODE) { continue; }
            if (/** @type {Element} */ (node).matches(selector)) {
                this._createObserver(/** @type {Element} */ (node));
            }
            for (const childNode of /** @type {Element} */ (node).querySelectorAll(selector)) {
                this._createObserver(childNode);
            }
        }

        if (
            this._onChildrenUpdated !== null &&
            (addedNodes.length !== 0 || addedNodes.length !== 0)
        ) {
            for (let node = /** @type {?Node} */ (target); node !== null; node = node.parentNode) {
                const observer = this._elementMap.get(node);
                if (typeof observer !== 'undefined') {
                    this._onObserverChildrenUpdated(observer);
                }
            }
        }
    }

    /**
     * @param {MutationRecord|import('selector-observer').MutationRecordLike} record
     */
    _onAttributeMutation({target}) {
        const selector = this._selector;
        const observers = this._elementAncestorMap.get(/** @type {Element} */ (target));
        if (typeof observers !== 'undefined') {
            for (const observer of observers) {
                const element = observer.element;
                if (
                    !element.matches(selector) ||
                    this._shouldIgnoreElement(element) ||
                    this._isObserverStale(observer)
                ) {
                    this._removeObserver(observer);
                }
            }
        }

        if (/** @type {Element} */ (target).matches(selector)) {
            this._createObserver(/** @type {Element} */ (target));
        }
    }

    /**
     * @param {Element} element
     */
    _createObserver(element) {
        if (this._elementMap.has(element) || this._shouldIgnoreElement(element) || this._onAdded === null) { return; }

        const data = this._onAdded(element);
        if (typeof data === 'undefined') { return; }
        const ancestors = this._getAncestors(element);
        const observer = {element, ancestors, data};

        this._elementMap.set(element, observer);

        for (const ancestor of ancestors) {
            let observers = this._elementAncestorMap.get(ancestor);
            if (typeof observers === 'undefined') {
                observers = new Set();
                this._elementAncestorMap.set(ancestor, observers);
            }
            observers.add(observer);
        }
    }

    /**
     * @param {import('selector-observer').Observer<T>} observer
     */
    _removeObserver(observer) {
        const {element, ancestors, data} = observer;

        this._elementMap.delete(element);

        for (const ancestor of ancestors) {
            const observers = this._elementAncestorMap.get(ancestor);
            if (typeof observers === 'undefined') { continue; }

            observers.delete(observer);
            if (observers.size === 0) {
                this._elementAncestorMap.delete(ancestor);
            }
        }

        if (this._onRemoved !== null) {
            this._onRemoved(element, data);
        }
    }

    /**
     * @param {import('selector-observer').Observer<T>} observer
     */
    _onObserverChildrenUpdated(observer) {
        if (this._onChildrenUpdated === null) { return; }
        this._onChildrenUpdated(observer.element, observer.data);
    }

    /**
     * @param {import('selector-observer').Observer<T>} observer
     * @returns {boolean}
     */
    _isObserverStale(observer) {
        return (this._isStale !== null && this._isStale(observer.element, observer.data));
    }

    /**
     * @param {Element} element
     * @returns {boolean}
     */
    _shouldIgnoreElement(element) {
        return (this._ignoreSelector !== null && element.matches(this._ignoreSelector));
    }

    /**
     * @param {Node} node
     * @returns {Node[]}
     */
    _getAncestors(node) {
        const root = this._observingElement;
        const results = [];
        let n = /** @type {?Node} */ (node);
        while (n !== null) {
            results.push(n);
            if (n === root) { break; }
            n = n.parentNode;
        }
        return results;
    }
}

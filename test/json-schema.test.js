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

/* eslint-disable no-multi-spaces */

import {describe, expect, test} from 'vitest';
import {parseJson} from '../dev/json.js';
import {JsonSchema} from '../ext/js/data/json-schema.js';

/**
 * @param {import('ext/json-schema').Schema} schema
 * @param {unknown} value
 * @returns {boolean}
 */
function schemaValidate(schema, value) {
    return new JsonSchema(schema).isValid(value);
}

/**
 * @param {import('ext/json-schema').Schema} schema
 * @param {unknown} value
 * @returns {import('ext/json-schema').Value}
 */
function getValidValueOrDefault(schema, value) {
    return new JsonSchema(schema).getValidValueOrDefault(value);
}

/**
 * @param {import('ext/json-schema').Schema} schema
 * @param {import('ext/json-schema').Value} value
 * @returns {import('ext/json-schema').Value}
 */
function createProxy(schema, value) {
    return new JsonSchema(schema).createProxy(value);
}

/**
 * @template [T=unknown]
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
    return parseJson(JSON.stringify(value));
}


/** */
function testValidate1() {
    describe('Validate1', () => {
        /** @type {import('ext/json-schema').Schema} */
        const schema = {
            allOf: [
                {
                    type: 'number'
                },
                {
                    anyOf: [
                        {minimum: 10, maximum: 100},
                        {minimum: -100, maximum: -10}
                    ]
                },
                {
                    oneOf: [
                        {multipleOf: 3},
                        {multipleOf: 5}
                    ]
                },
                {
                    not: {
                        anyOf: [
                            {multipleOf: 20}
                        ]
                    }
                }
            ]
        };

        /**
         * @param {number} value
         * @returns {boolean}
         */
        const jsValidate = (value) => {
            return (
                typeof value === 'number' &&
                (
                    (value >= 10 && value <= 100) ||
                    (value >= -100 && value <= -10)
                ) &&
                (
                    (
                        (value % 3) === 0 ||
                        (value % 5) === 0
                    ) &&
                    (value % 15) !== 0
                ) &&
                (value % 20) !== 0
            );
        };

        test('works as expected', () => {
            for (let i = -111; i <= 111; i++) {
                const actual = schemaValidate(schema, i);
                const expected = jsValidate(i);
                expect(actual).toStrictEqual(expected);
            }
        });
    });
}

/** */
function testValidate2() {
    describe('Validate2', () => {
        /** @type {{schema: import('ext/json-schema').Schema, inputs: {expected: boolean, value: unknown}[]}[]} */
        const data = [
            // String tests
            {
                schema: {
                    type: 'string'
                },
                inputs: [
                    {expected: false, value: null},
                    {expected: false, value: void 0},
                    {expected: false, value: 0},
                    {expected: false, value: {}},
                    {expected: false, value: []},
                    {expected: true,  value: ''}
                ]
            },
            {
                schema: {
                    type: 'string',
                    minLength: 2
                },
                inputs: [
                    {expected: false, value: ''},
                    {expected: false,  value: '1'},
                    {expected: true,  value: '12'},
                    {expected: true,  value: '123'}
                ]
            },
            {
                schema: {
                    type: 'string',
                    maxLength: 2
                },
                inputs: [
                    {expected: true,  value: ''},
                    {expected: true,  value: '1'},
                    {expected: true,  value: '12'},
                    {expected: false, value: '123'}
                ]
            },
            {
                schema: {
                    type: 'string',
                    pattern: 'test'
                },
                inputs: [
                    {expected: false, value: ''},
                    {expected: true,  value: 'test'},
                    {expected: false, value: 'TEST'},
                    {expected: true,  value: 'ABCtestDEF'},
                    {expected: false, value: 'ABCTESTDEF'}
                ]
            },
            {
                schema: {
                    type: 'string',
                    pattern: '^test$'
                },
                inputs: [
                    {expected: false, value: ''},
                    {expected: true,  value: 'test'},
                    {expected: false, value: 'TEST'},
                    {expected: false, value: 'ABCtestDEF'},
                    {expected: false, value: 'ABCTESTDEF'}
                ]
            },
            {
                schema: {
                    type: 'string',
                    pattern: '^test$',
                    patternFlags: 'i'
                },
                inputs: [
                    {expected: false, value: ''},
                    {expected: true,  value: 'test'},
                    {expected: true,  value: 'TEST'},
                    {expected: false, value: 'ABCtestDEF'},
                    {expected: false, value: 'ABCTESTDEF'}
                ]
            },
            {
                schema: {
                    type: 'string',
                    pattern: '*'
                },
                inputs: [
                    {expected: false, value: ''}
                ]
            },
            {
                schema: {
                    type: 'string',
                    pattern: '.',
                    patternFlags: '?'
                },
                inputs: [
                    {expected: false, value: ''}
                ]
            },

            // Const tests
            {
                schema: {
                    const: 32
                },
                inputs: [
                    {expected: true,  value: 32},
                    {expected: false, value: 0},
                    {expected: false, value: '32'},
                    {expected: false, value: null},
                    {expected: false, value: {a: 'b'}},
                    {expected: false, value: [1, 2, 3]}
                ]
            },
            {
                schema: {
                    const: '32'
                },
                inputs: [
                    {expected: false, value: 32},
                    {expected: false, value: 0},
                    {expected: true,  value: '32'},
                    {expected: false, value: null},
                    {expected: false, value: {a: 'b'}},
                    {expected: false, value: [1, 2, 3]}
                ]
            },
            {
                schema: {
                    const: null
                },
                inputs: [
                    {expected: false, value: 32},
                    {expected: false, value: 0},
                    {expected: false, value: '32'},
                    {expected: true,  value: null},
                    {expected: false, value: {a: 'b'}},
                    {expected: false, value: [1, 2, 3]}
                ]
            },
            {
                schema: {
                    const: {a: 'b'}
                },
                inputs: [
                    {expected: false, value: 32},
                    {expected: false, value: 0},
                    {expected: false, value: '32'},
                    {expected: false, value: null},
                    {expected: false, value: {a: 'b'}},
                    {expected: false, value: [1, 2, 3]}
                ]
            },
            {
                schema: {
                    const: [1, 2, 3]
                },
                inputs: [
                    {expected: false, value: 32},
                    {expected: false, value: 0},
                    {expected: false,  value: '32'},
                    {expected: false, value: null},
                    {expected: false, value: {a: 'b'}},
                    {expected: false, value: [1, 2, 3]}
                ]
            },

            // Array contains tests
            {
                schema: {
                    type: 'array',
                    contains: {const: 32}
                },
                inputs: [
                    {expected: false, value: []},
                    {expected: true,  value: [32]},
                    {expected: true,  value: [1, 32]},
                    {expected: true,  value: [1, 32, 1]},
                    {expected: false, value: [33]},
                    {expected: false, value: [1, 33]},
                    {expected: false, value: [1, 33, 1]}
                ]
            },

            // Number limits tests
            {
                schema: {
                    type: 'number',
                    minimum: 0
                },
                inputs: [
                    {expected: false, value: -1},
                    {expected: true,  value: 0},
                    {expected: true,  value: 1}
                ]
            },
            {
                schema: {
                    type: 'number',
                    exclusiveMinimum: 0
                },
                inputs: [
                    {expected: false, value: -1},
                    {expected: false, value: 0},
                    {expected: true,  value: 1}
                ]
            },
            {
                schema: {
                    type: 'number',
                    maximum: 0
                },
                inputs: [
                    {expected: true,  value: -1},
                    {expected: true,  value: 0},
                    {expected: false, value: 1}
                ]
            },
            {
                schema: {
                    type: 'number',
                    exclusiveMaximum: 0
                },
                inputs: [
                    {expected: true,  value: -1},
                    {expected: false, value: 0},
                    {expected: false, value: 1}
                ]
            },

            // Integer limits tests
            {
                schema: {
                    type: 'integer',
                    minimum: 0
                },
                inputs: [
                    {expected: false, value: -1},
                    {expected: true,  value: 0},
                    {expected: true,  value: 1}
                ]
            },
            {
                schema: {
                    type: 'integer',
                    exclusiveMinimum: 0
                },
                inputs: [
                    {expected: false, value: -1},
                    {expected: false, value: 0},
                    {expected: true,  value: 1}
                ]
            },
            {
                schema: {
                    type: 'integer',
                    maximum: 0
                },
                inputs: [
                    {expected: true,  value: -1},
                    {expected: true,  value: 0},
                    {expected: false, value: 1}
                ]
            },
            {
                schema: {
                    type: 'integer',
                    exclusiveMaximum: 0
                },
                inputs: [
                    {expected: true,  value: -1},
                    {expected: false, value: 0},
                    {expected: false, value: 1}
                ]
            },
            {
                schema: {
                    type: 'integer',
                    multipleOf: 2
                },
                inputs: [
                    {expected: true,  value: -2},
                    {expected: false, value: -1},
                    {expected: true,  value: 0},
                    {expected: false, value: 1},
                    {expected: true,  value: 2}
                ]
            },

            // Numeric type tests
            {
                schema: {
                    type: 'number'
                },
                inputs: [
                    {expected: true,  value: 0},
                    {expected: true,  value: 0.5},
                    {expected: true,  value: 1},
                    {expected: false, value: '0'},
                    {expected: false, value: null},
                    {expected: false, value: []},
                    {expected: false, value: {}}
                ]
            },
            {
                schema: {
                    type: 'integer'
                },
                inputs: [
                    {expected: true,  value: 0},
                    {expected: false, value: 0.5},
                    {expected: true,  value: 1},
                    {expected: false, value: '0'},
                    {expected: false, value: null},
                    {expected: false, value: []},
                    {expected: false, value: {}}
                ]
            },

            // Reference tests
            {
                schema: {
                    definitions: {
                        example: {
                            type: 'number'
                        }
                    },
                    $ref: '#/definitions/example'
                },
                inputs: [
                    {expected: true,  value: 0},
                    {expected: true,  value: 0.5},
                    {expected: true,  value: 1},
                    {expected: false, value: '0'},
                    {expected: false, value: null},
                    {expected: false, value: []},
                    {expected: false, value: {}}
                ]
            },
            {
                schema: {
                    definitions: {
                        example: {
                            type: 'integer'
                        }
                    },
                    $ref: '#/definitions/example'
                },
                inputs: [
                    {expected: true,  value: 0},
                    {expected: false, value: 0.5},
                    {expected: true,  value: 1},
                    {expected: false, value: '0'},
                    {expected: false, value: null},
                    {expected: false, value: []},
                    {expected: false, value: {}}
                ]
            },
            {
                schema: {
                    definitions: {
                        example: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                test: {
                                    $ref: '#/definitions/example'
                                }
                            }
                        }
                    },
                    $ref: '#/definitions/example'
                },
                inputs: [
                    {expected: false, value: 0},
                    {expected: false, value: 0.5},
                    {expected: false, value: 1},
                    {expected: false, value: '0'},
                    {expected: false, value: null},
                    {expected: false, value: []},
                    {expected: true,  value: {}},
                    {expected: false, value: {test: 0}},
                    {expected: false, value: {test: 0.5}},
                    {expected: false, value: {test: 1}},
                    {expected: false, value: {test: '0'}},
                    {expected: false, value: {test: null}},
                    {expected: false, value: {test: []}},
                    {expected: true,  value: {test: {}}},
                    {expected: true,  value: {test: {test: {}}}},
                    {expected: true,  value: {test: {test: {test: {}}}}}
                ]
            }
        ];

        describe.each(data)('Schema %#', ({schema, inputs}) => {
            test.each(inputs)(`schemaValidate(${schema}, $value) -> $expected`, ({expected, value}) => {
                const actual = schemaValidate(schema, value);
                expect(actual).toStrictEqual(expected);
            });
        });
    });
}


/** */
function testGetValidValueOrDefault1() {
    describe('GetValidValueOrDefault1', () => {
        /** @type {{schema: import('ext/json-schema').Schema, inputs: [value: unknown, expected: unknown][]}[]} */
        const data = [
            // Test value defaulting on objects with additionalProperties=false
            {
                schema: {
                    type: 'object',
                    required: ['test'],
                    properties: {
                        test: {
                            type: 'string',
                            default: 'default'
                        }
                    },
                    additionalProperties: false
                },
                inputs: [
                    [
                        void 0,
                        {test: 'default'}
                    ],
                    [
                        null,
                        {test: 'default'}
                    ],
                    [
                        0,
                        {test: 'default'}
                    ],
                    [
                        '',
                        {test: 'default'}
                    ],
                    [
                        [],
                        {test: 'default'}
                    ],
                    [
                        {},
                        {test: 'default'}
                    ],
                    [
                        {test: 'value'},
                        {test: 'value'}
                    ],
                    [
                        {test2: 'value2'},
                        {test: 'default'}
                    ],
                    [
                        {test: 'value', test2: 'value2'},
                        {test: 'value'}
                    ]
                ]
            },

            // Test value defaulting on objects with additionalProperties=true
            {
                schema: {
                    type: 'object',
                    required: ['test'],
                    properties: {
                        test: {
                            type: 'string',
                            default: 'default'
                        }
                    },
                    additionalProperties: true
                },
                inputs: [
                    [
                        {},
                        {test: 'default'}
                    ],
                    [
                        {test: 'value'},
                        {test: 'value'}
                    ],
                    [
                        {test2: 'value2'},
                        {test: 'default', test2: 'value2'}
                    ],
                    [
                        {test: 'value', test2: 'value2'},
                        {test: 'value', test2: 'value2'}
                    ]
                ]
            },

            // Test value defaulting on objects with additionalProperties={schema}
            {
                schema: {
                    type: 'object',
                    required: ['test'],
                    properties: {
                        test: {
                            type: 'string',
                            default: 'default'
                        }
                    },
                    additionalProperties: {
                        type: 'number',
                        default: 10
                    }
                },
                inputs: [
                    [
                        {},
                        {test: 'default'}
                    ],
                    [
                        {test: 'value'},
                        {test: 'value'}
                    ],
                    [
                        {test2: 'value2'},
                        {test: 'default', test2: 10}
                    ],
                    [
                        {test: 'value', test2: 'value2'},
                        {test: 'value', test2: 10}
                    ],
                    [
                        {test2: 2},
                        {test: 'default', test2: 2}
                    ],
                    [
                        {test: 'value', test2: 2},
                        {test: 'value', test2: 2}
                    ],
                    [
                        {test: 'value', test2: 2, test3: null},
                        {test: 'value', test2: 2, test3: 10}
                    ],
                    [
                        {test: 'value', test2: 2, test3: void 0},
                        {test: 'value', test2: 2, test3: 10}
                    ]
                ]
            },

            // Test value defaulting where hasOwnProperty is false
            {
                schema: {
                    type: 'object',
                    required: ['test'],
                    properties: {
                        test: {
                            type: 'string',
                            default: 'default'
                        }
                    }
                },
                inputs: [
                    [
                        {},
                        {test: 'default'}
                    ],
                    [
                        {test: 'value'},
                        {test: 'value'}
                    ],
                    [
                        Object.create({test: 'value'}),
                        {test: 'default'}
                    ]
                ]
            },
            {
                schema: {
                    type: 'object',
                    required: ['toString'],
                    properties: {
                        toString: /** @type {import('ext/json-schema').SchemaObject} */ ({
                            type: 'string',
                            default: 'default'
                        })
                    }
                },
                inputs: [
                    [
                        {},
                        {toString: 'default'}
                    ],
                    [
                        {toString: 'value'},
                        {toString: 'value'}
                    ],
                    [
                        Object.create({toString: 'value'}),
                        {toString: 'default'}
                    ]
                ]
            },

            // Test enum
            {
                schema: {
                    type: 'object',
                    required: ['test'],
                    properties: {
                        test: {
                            type: 'string',
                            default: 'value1',
                            enum: ['value1', 'value2', 'value3']
                        }
                    }
                },
                inputs: [
                    [
                        {test: 'value1'},
                        {test: 'value1'}
                    ],
                    [
                        {test: 'value2'},
                        {test: 'value2'}
                    ],
                    [
                        {test: 'value3'},
                        {test: 'value3'}
                    ],
                    [
                        {test: 'value4'},
                        {test: 'value1'}
                    ]
                ]
            },

            // Test valid vs invalid default
            {
                schema: {
                    type: 'object',
                    required: ['test'],
                    properties: {
                        test: {
                            type: 'integer',
                            default: 2,
                            minimum: 1
                        }
                    }
                },
                inputs: [
                    [
                        {test: -1},
                        {test: 2}
                    ]
                ]
            },
            {
                schema: {
                    type: 'object',
                    required: ['test'],
                    properties: {
                        test: {
                            type: 'integer',
                            default: 1,
                            minimum: 2
                        }
                    }
                },
                inputs: [
                    [
                        {test: -1},
                        {test: -1}
                    ]
                ]
            },

            // Test references
            {
                schema: {
                    definitions: {
                        example: {
                            type: 'number',
                            default: 0
                        }
                    },
                    $ref: '#/definitions/example'
                },
                inputs: [
                    [
                        1,
                        1
                    ],
                    [
                        null,
                        0
                    ],
                    [
                        'test',
                        0
                    ],
                    [
                        {test: 'value'},
                        0
                    ]
                ]
            },
            {
                schema: {
                    definitions: {
                        example: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                test: {
                                    $ref: '#/definitions/example'
                                }
                            }
                        }
                    },
                    $ref: '#/definitions/example'
                },
                inputs: [
                    [
                        1,
                        {}
                    ],
                    [
                        null,
                        {}
                    ],
                    [
                        'test',
                        {}
                    ],
                    [
                        {},
                        {}
                    ],
                    [
                        {test: {}},
                        {test: {}}
                    ],
                    [
                        {test: 'value'},
                        {test: {}}
                    ],
                    [
                        {test: {test: {}}},
                        {test: {test: {}}}
                    ]
                ]
            }
        ];

        describe.each(data)('Schema %#', ({schema, inputs}) => {
            test.each(inputs)(`getValidValueOrDefault(${schema}, %o) -> %o`, (value, expected) => {
                const actual = getValidValueOrDefault(schema, value);
                expect(actual).toStrictEqual(expected);
            });
        });
    });
}


/** */
function testProxy1() {
    describe('Proxy1', () => {
        /** @type {{schema: import('ext/json-schema').Schema, tests: {error: boolean, value?: import('ext/json-schema').Value, action: (value: import('core').SafeAny) => void}[]}[]} */
        const data = [
            // Object tests
            {
                schema: {
                    type: 'object',
                    required: ['test'],
                    additionalProperties: false,
                    properties: {
                        test: {
                            type: 'string',
                            default: 'default'
                        }
                    }
                },
                tests: [
                    {error: false, value: {test: 'default'}, action: (value) => { value.test = 'string'; }},
                    {error: true,  value: {test: 'default'}, action: (value) => { value.test = null; }},
                    {error: true,  value: {test: 'default'}, action: (value) => { delete value.test; }},
                    {error: true,  value: {test: 'default'}, action: (value) => { value.test2 = 'string'; }},
                    {error: false, value: {test: 'default'}, action: (value) => { delete value.test2; }}
                ]
            },
            {
                schema: {
                    type: 'object',
                    required: ['test'],
                    additionalProperties: true,
                    properties: {
                        test: {
                            type: 'string',
                            default: 'default'
                        }
                    }
                },
                tests: [
                    {error: false, value: {test: 'default'}, action: (value) => { value.test = 'string'; }},
                    {error: true,  value: {test: 'default'}, action: (value) => { value.test = null; }},
                    {error: true,  value: {test: 'default'}, action: (value) => { delete value.test; }},
                    {error: false, value: {test: 'default'}, action: (value) => { value.test2 = 'string'; }},
                    {error: false, value: {test: 'default'}, action: (value) => { delete value.test2; }}
                ]
            },
            {
                schema: {
                    type: 'object',
                    required: ['test1'],
                    additionalProperties: false,
                    properties: {
                        test1: {
                            type: 'object',
                            required: ['test2'],
                            additionalProperties: false,
                            properties: {
                                test2: {
                                    type: 'object',
                                    required: ['test3'],
                                    additionalProperties: false,
                                    properties: {
                                        test3: {
                                            type: 'string',
                                            default: 'default'
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                tests: [
                    {error: false, action: (value) => { value.test1.test2.test3 = 'string'; }},
                    {error: true,  action: (value) => { value.test1.test2.test3 = null; }},
                    {error: true,  action: (value) => { delete value.test1.test2.test3; }},
                    {error: true,  action: (value) => { value.test1.test2 = null; }},
                    {error: true,  action: (value) => { value.test1 = null; }},
                    {error: true,  action: (value) => { value.test4 = 'string'; }},
                    {error: false, action: (value) => { delete value.test4; }}
                ]
            },

            // Array tests
            {
                schema: {
                    type: 'array',
                    items: {
                        type: 'string',
                        default: 'default'
                    }
                },
                tests: [
                    {error: false, value: ['default'], action: (value) => { value[0] = 'string'; }},
                    {error: true,  value: ['default'], action: (value) => { value[0] = null; }},
                    {error: false, value: ['default'], action: (value) => { delete value[0]; }},
                    {error: false, value: ['default'], action: (value) => { value[1] = 'string'; }},
                    {error: false, value: ['default'], action: (value) => {
                        value[1] = 'string';
                        if (value.length !== 2) { throw new Error(`Invalid length; expected=2; actual=${value.length}`); }
                        if (typeof value.push !== 'function') { throw new Error(`Invalid push; expected=function; actual=${typeof value.push}`); }
                    }}
                ]
            },

            // Reference tests
            {
                schema: {
                    definitions: {
                        example: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                test: {
                                    $ref: '#/definitions/example'
                                }
                            }
                        }
                    },
                    $ref: '#/definitions/example'
                },
                tests: [
                    {error: false, value: {}, action: (value) => { value.test = {}; }},
                    {error: false, value: {}, action: (value) => { value.test = {}; value.test.test = {}; }},
                    {error: false, value: {}, action: (value) => { value.test = {test: {}}; }},
                    {error: true,  value: {}, action: (value) => { value.test = null; }},
                    {error: true,  value: {}, action: (value) => { value.test = 'string'; }},
                    {error: true,  value: {}, action: (value) => { value.test = {}; value.test.test = 'string'; }},
                    {error: true,  value: {}, action: (value) => { value.test = {test: 'string'}; }}
                ]
            }
        ];

        describe.each(data)('Schema %#', ({schema, tests}) => {
            test.each(tests)('proxy %#', ({error, value, action}) => {
                if (typeof value === 'undefined') { value = getValidValueOrDefault(schema, void 0); }
                value = clone(value);
                expect(schemaValidate(schema, value)).toBe(true);
                const valueProxy = createProxy(schema, value);
                if (error) {
                    expect(() => action(valueProxy)).toThrow();
                } else {
                    expect(() => action(valueProxy)).not.toThrow();
                }
            });
        });

        for (const {schema, tests} of data) {
            for (let {error, value, action} of tests) {
                if (typeof value === 'undefined') { value = getValidValueOrDefault(schema, void 0); }
                value = clone(value);
                expect(schemaValidate(schema, value)).toBe(true);
                const valueProxy = createProxy(schema, value);
                if (error) {
                    expect(() => action(valueProxy)).toThrow();
                } else {
                    expect(() => action(valueProxy)).not.toThrow();
                }
            }
        }
    });
}


/** */
function main() {
    testValidate1();
    testValidate2();
    testGetValidValueOrDefault1();
    testProxy1();
}


main();

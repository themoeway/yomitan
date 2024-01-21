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
import {ProfileConditionsUtil} from '../ext/js/background/profile-conditions-util.js';

/** */
function testNormalizeContext() {
    describe('NormalizeContext', () => {
        /** @type {{context: import('settings').OptionsContext, expected: import('profile-conditions-util').NormalizedOptionsContext}[]} */
        const data = [
            // Empty
            {
                context: {index: 0},
                expected: {index: 0, flags: []}
            },

            // Domain normalization
            {
                context: {depth: 0, url: ''},
                expected: {depth: 0, url: '', flags: []}
            },
            {
                context: {depth: 0, url: 'http://example.com/'},
                expected: {depth: 0, url: 'http://example.com/', domain: 'example.com', flags: []}
            },
            {
                context: {depth: 0, url: 'http://example.com:1234/'},
                expected: {depth: 0, url: 'http://example.com:1234/', domain: 'example.com', flags: []}
            },
            {
                context: {depth: 0, url: 'http://user@example.com:1234/'},
                expected: {depth: 0, url: 'http://user@example.com:1234/', domain: 'example.com', flags: []}
            }
        ];

        test.each(data)('normalize-context-test-%#', ({context, expected}) => {
            const profileConditionsUtil = new ProfileConditionsUtil();
            const actual = profileConditionsUtil.normalizeContext(context);
            expect(actual).toStrictEqual(expected);
        });
    });
}

/** */
function testSchemas() {
    describe('Schemas', () => {
        /** @type {{conditionGroups: import('settings').ProfileConditionGroup[], expectedSchema?: import('ext/json-schema').Schema, inputs?: {expected: boolean, context: import('settings').OptionsContext}[]}[]} */
        const data = [
            // Empty
            {
                conditionGroups: [],
                expectedSchema: {},
                inputs: [
                    {expected: true, context: {depth: 0, url: 'http://example.com/'}}
                ]
            },
            {
                conditionGroups: [
                    {conditions: []}
                ],
                expectedSchema: {},
                inputs: [
                    {expected: true, context: {depth: 0, url: 'http://example.com/'}}
                ]
            },
            {
                conditionGroups: [
                    {conditions: []},
                    {conditions: []}
                ],
                expectedSchema: {},
                inputs: [
                    {expected: true, context: {depth: 0, url: 'http://example.com/'}}
                ]
            },

            // popupLevel tests
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'equal',
                                value: '0'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        depth: {const: 0}
                    },
                    required: ['depth']
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/'}},
                    {expected: false, context: {depth: 1, url: 'http://example.com/'}},
                    {expected: false, context: {depth: -1, url: 'http://example.com/'}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'notEqual',
                                value: '0'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    not: {
                        anyOf: [
                            {
                                properties: {
                                    depth: {const: 0}
                                },
                                required: ['depth']
                            }
                        ]
                    }
                },
                inputs: [
                    {expected: false, context: {depth: 0, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 1, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: -1, url: 'http://example.com/'}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'lessThan',
                                value: '0'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        depth: {
                            type: 'number',
                            exclusiveMaximum: 0
                        }
                    },
                    required: ['depth']
                },
                inputs: [
                    {expected: false, context: {depth: 0, url: 'http://example.com/'}},
                    {expected: false, context: {depth: 1, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: -1, url: 'http://example.com/'}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'greaterThan',
                                value: '0'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        depth: {
                            type: 'number',
                            exclusiveMinimum: 0
                        }
                    },
                    required: ['depth']
                },
                inputs: [
                    {expected: false, context: {depth: 0, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 1, url: 'http://example.com/'}},
                    {expected: false, context: {depth: -1, url: 'http://example.com/'}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'lessThanOrEqual',
                                value: '0'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        depth: {
                            type: 'number',
                            maximum: 0
                        }
                    },
                    required: ['depth']
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/'}},
                    {expected: false, context: {depth: 1, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: -1, url: 'http://example.com/'}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'greaterThanOrEqual',
                                value: '0'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        depth: {
                            type: 'number',
                            minimum: 0
                        }
                    },
                    required: ['depth']
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 1, url: 'http://example.com/'}},
                    {expected: false, context: {depth: -1, url: 'http://example.com/'}}
                ]
            },

            // url tests
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'url',
                                operator: 'matchDomain',
                                value: 'example.com'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        domain: {
                            oneOf: [
                                {const: 'example.com'}
                            ]
                        }
                    },
                    required: ['domain']
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/'}},
                    {expected: false, context: {depth: 0, url: 'http://example1.com/'}},
                    {expected: false, context: {depth: 0, url: 'http://example2.com/'}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com:1234/'}},
                    {expected: true,  context: {depth: 0, url: 'http://user@example.com:1234/'}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'url',
                                operator: 'matchDomain',
                                value: 'example.com, example1.com, example2.com'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        domain: {
                            oneOf: [
                                {const: 'example.com'},
                                {const: 'example1.com'},
                                {const: 'example2.com'}
                            ]
                        }
                    },
                    required: ['domain']
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 0, url: 'http://example1.com/'}},
                    {expected: true,  context: {depth: 0, url: 'http://example2.com/'}},
                    {expected: false, context: {depth: 0, url: 'http://example3.com/'}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com:1234/'}},
                    {expected: true,  context: {depth: 0, url: 'http://user@example.com:1234/'}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'url',
                                operator: 'matchRegExp',
                                value: '^http://example\\d?\\.com/[\\w\\W]*$'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        url: {
                            type: 'string',
                            pattern: '^http://example\\d?\\.com/[\\w\\W]*$',
                            patternFlags: 'i'
                        }
                    },
                    required: ['url']
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 0, url: 'http://example1.com/'}},
                    {expected: true,  context: {depth: 0, url: 'http://example2.com/'}},
                    {expected: true,  context: {depth: 0, url: 'http://example3.com/'}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/example'}},
                    {expected: false, context: {depth: 0, url: 'http://example.com:1234/'}},
                    {expected: false, context: {depth: 0, url: 'http://user@example.com:1234/'}},
                    {expected: false, context: {depth: 0, url: 'http://example-1.com/'}}
                ]
            },

            // modifierKeys tests
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'modifierKeys',
                                operator: 'are',
                                value: ''
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        modifierKeys: {
                            type: 'array',
                            maxItems: 0,
                            minItems: 0
                        }
                    },
                    required: ['modifierKeys']
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: []}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt']}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift']}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift', 'ctrl']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'modifierKeys',
                                operator: 'are',
                                value: 'alt, shift'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        modifierKeys: {
                            type: 'array',
                            maxItems: 2,
                            minItems: 2,
                            allOf: [
                                {contains: {const: 'alt'}},
                                {contains: {const: 'shift'}}
                            ]
                        }
                    },
                    required: ['modifierKeys']
                },
                inputs: [
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: []}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt']}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift']}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift', 'ctrl']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'modifierKeys',
                                operator: 'areNot',
                                value: ''
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    not: {
                        anyOf: [
                            {
                                properties: {
                                    modifierKeys: {
                                        type: 'array',
                                        maxItems: 0,
                                        minItems: 0
                                    }
                                },
                                required: ['modifierKeys']
                            }
                        ]
                    }
                },
                inputs: [
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: []}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt']}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift']}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift', 'ctrl']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'modifierKeys',
                                operator: 'areNot',
                                value: 'alt, shift'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    not: {
                        anyOf: [
                            {
                                properties: {
                                    modifierKeys: {
                                        type: 'array',
                                        maxItems: 2,
                                        minItems: 2,
                                        allOf: [
                                            {contains: {const: 'alt'}},
                                            {contains: {const: 'shift'}}
                                        ]
                                    }
                                },
                                required: ['modifierKeys']
                            }
                        ]
                    }
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: []}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt']}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift']}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift', 'ctrl']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'modifierKeys',
                                operator: 'include',
                                value: ''
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        modifierKeys: {
                            type: 'array',
                            minItems: 0
                        }
                    },
                    required: ['modifierKeys']
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: []}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt']}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift']}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift', 'ctrl']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'modifierKeys',
                                operator: 'include',
                                value: 'alt, shift'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        modifierKeys: {
                            type: 'array',
                            minItems: 2,
                            allOf: [
                                {contains: {const: 'alt'}},
                                {contains: {const: 'shift'}}
                            ]
                        }
                    },
                    required: ['modifierKeys']
                },
                inputs: [
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: []}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt']}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift']}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift', 'ctrl']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'modifierKeys',
                                operator: 'notInclude',
                                value: ''
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        modifierKeys: {
                            type: 'array'
                        }
                    },
                    required: ['modifierKeys']
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: []}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt']}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift']}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift', 'ctrl']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'modifierKeys',
                                operator: 'notInclude',
                                value: 'alt, shift'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    properties: {
                        modifierKeys: {
                            type: 'array',
                            not: {
                                anyOf: [
                                    {contains: {const: 'alt'}},
                                    {contains: {const: 'shift'}}
                                ]
                            }
                        }
                    },
                    required: ['modifierKeys']
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: 'http://example.com/', modifierKeys: []}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt']}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift']}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/', modifierKeys: ['alt', 'shift', 'ctrl']}}
                ]
            },

            // flags tests
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'flags',
                                operator: 'are',
                                value: ''
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    required: ['flags'],
                    properties: {
                        flags: {
                            type: 'array',
                            maxItems: 0,
                            minItems: 0
                        }
                    }
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: ''}},
                    {expected: true,  context: {depth: 0, url: '', flags: []}},
                    {expected: false, context: {depth: 0, url: '', flags: ['clipboard']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: false, context: {depth: 0, url: '', flags: ['clipboard', 'test2']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: false, context: {depth: 0, url: '', flags: ['clipboard', 'test2', 'test3']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'flags',
                                operator: 'are',
                                value: 'clipboard, test2'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    required: ['flags'],
                    properties: {
                        flags: {
                            type: 'array',
                            maxItems: 2,
                            minItems: 2,
                            allOf: [
                                {contains: {const: 'clipboard'}},
                                {contains: {const: 'test2'}}
                            ]
                        }
                    }
                },
                inputs: [
                    {expected: false, context: {depth: 0, url: ''}},
                    {expected: false, context: {depth: 0, url: '', flags: []}},
                    {expected: false, context: {depth: 0, url: '', flags: ['clipboard']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard', 'test2']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: false, context: {depth: 0, url: '', flags: ['clipboard', 'test2', 'test3']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'flags',
                                operator: 'areNot',
                                value: ''
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    not: {
                        anyOf: [
                            {
                                required: ['flags'],
                                properties: {
                                    flags: {
                                        type: 'array',
                                        maxItems: 0,
                                        minItems: 0
                                    }
                                }
                            }
                        ]
                    }
                },
                inputs: [
                    {expected: false, context: {depth: 0, url: ''}},
                    {expected: false, context: {depth: 0, url: '', flags: []}},
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard', 'test2']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard', 'test2', 'test3']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'flags',
                                operator: 'areNot',
                                value: 'clipboard, test2'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    not: {
                        anyOf: [
                            {
                                required: ['flags'],
                                properties: {
                                    flags: {
                                        type: 'array',
                                        maxItems: 2,
                                        minItems: 2,
                                        allOf: [
                                            {contains: {const: 'clipboard'}},
                                            {contains: {const: 'test2'}}
                                        ]
                                    }
                                }
                            }
                        ]
                    }
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: ''}},
                    {expected: true,  context: {depth: 0, url: '', flags: []}},
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: false, context: {depth: 0, url: '', flags: ['clipboard', 'test2']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard', 'test2', 'test3']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'flags',
                                operator: 'include',
                                value: ''
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    required: ['flags'],
                    properties: {
                        flags: {
                            type: 'array',
                            minItems: 0
                        }
                    }
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: ''}},
                    {expected: true,  context: {depth: 0, url: '', flags: []}},
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard', 'test2']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard', 'test2', 'test3']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'flags',
                                operator: 'include',
                                value: 'clipboard, test2'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    required: ['flags'],
                    properties: {
                        flags: {
                            type: 'array',
                            minItems: 2,
                            allOf: [
                                {contains: {const: 'clipboard'}},
                                {contains: {const: 'test2'}}
                            ]
                        }
                    }
                },
                inputs: [
                    {expected: false, context: {depth: 0, url: ''}},
                    {expected: false, context: {depth: 0, url: '', flags: []}},
                    {expected: false, context: {depth: 0, url: '', flags: ['clipboard']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard', 'test2']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard', 'test2', 'test3']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'flags',
                                operator: 'notInclude',
                                value: ''
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    required: ['flags'],
                    properties: {
                        flags: {
                            type: 'array'
                        }
                    }
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: ''}},
                    {expected: true,  context: {depth: 0, url: '', flags: []}},
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard', 'test2']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: true,  context: {depth: 0, url: '', flags: ['clipboard', 'test2', 'test3']}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'flags',
                                operator: 'notInclude',
                                value: 'clipboard, test2'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    required: ['flags'],
                    properties: {
                        flags: {
                            type: 'array',
                            not: {
                                anyOf: [
                                    {contains: {const: 'clipboard'}},
                                    {contains: {const: 'test2'}}
                                ]
                            }
                        }
                    }
                },
                inputs: [
                    {expected: true,  context: {depth: 0, url: ''}},
                    {expected: true,  context: {depth: 0, url: '', flags: []}},
                    {expected: false, context: {depth: 0, url: '', flags: ['clipboard']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: false, context: {depth: 0, url: '', flags: ['clipboard', 'test2']}},
                    // @ts-expect-error - Ignore type for string flag for testing purposes
                    {expected: false, context: {depth: 0, url: '', flags: ['clipboard', 'test2', 'test3']}}
                ]
            },

            // Multiple conditions tests
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'greaterThan',
                                value: '0'
                            },
                            {
                                type: 'popupLevel',
                                operator: 'lessThan',
                                value: '3'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    allOf: [
                        {
                            properties: {
                                depth: {
                                    type: 'number',
                                    exclusiveMinimum: 0
                                }
                            },
                            required: ['depth']
                        },
                        {
                            properties: {
                                depth: {
                                    type: 'number',
                                    exclusiveMaximum: 3
                                }
                            },
                            required: ['depth']
                        }
                    ]
                },
                inputs: [
                    {expected: false, context: {depth: -2, url: 'http://example.com/'}},
                    {expected: false, context: {depth: -1, url: 'http://example.com/'}},
                    {expected: false, context: {depth: 0, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 1, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 2, url: 'http://example.com/'}},
                    {expected: false, context: {depth: 3, url: 'http://example.com/'}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'greaterThan',
                                value: '0'
                            },
                            {
                                type: 'popupLevel',
                                operator: 'lessThan',
                                value: '3'
                            }
                        ]
                    },
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'equal',
                                value: '0'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    anyOf: [
                        {
                            allOf: [
                                {
                                    properties: {
                                        depth: {
                                            type: 'number',
                                            exclusiveMinimum: 0
                                        }
                                    },
                                    required: ['depth']
                                },
                                {
                                    properties: {
                                        depth: {
                                            type: 'number',
                                            exclusiveMaximum: 3
                                        }
                                    },
                                    required: ['depth']
                                }
                            ]
                        },
                        {
                            properties: {
                                depth: {const: 0}
                            },
                            required: ['depth']
                        }
                    ]
                },
                inputs: [
                    {expected: false, context: {depth: -2, url: 'http://example.com/'}},
                    {expected: false, context: {depth: -1, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 1, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 2, url: 'http://example.com/'}},
                    {expected: false, context: {depth: 3, url: 'http://example.com/'}}
                ]
            },
            {
                conditionGroups: [
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'greaterThan',
                                value: '0'
                            },
                            {
                                type: 'popupLevel',
                                operator: 'lessThan',
                                value: '3'
                            }
                        ]
                    },
                    {
                        conditions: [
                            {
                                type: 'popupLevel',
                                operator: 'lessThanOrEqual',
                                value: '0'
                            },
                            {
                                type: 'popupLevel',
                                operator: 'greaterThanOrEqual',
                                value: '-1'
                            }
                        ]
                    }
                ],
                expectedSchema: {
                    anyOf: [
                        {
                            allOf: [
                                {
                                    properties: {
                                        depth: {
                                            type: 'number',
                                            exclusiveMinimum: 0
                                        }
                                    },
                                    required: ['depth']
                                },
                                {
                                    properties: {
                                        depth: {
                                            type: 'number',
                                            exclusiveMaximum: 3
                                        }
                                    },
                                    required: ['depth']
                                }
                            ]
                        },
                        {
                            allOf: [
                                {
                                    properties: {
                                        depth: {
                                            type: 'number',
                                            maximum: 0
                                        }
                                    },
                                    required: ['depth']
                                },
                                {
                                    properties: {
                                        depth: {
                                            type: 'number',
                                            minimum: -1
                                        }
                                    },
                                    required: ['depth']
                                }
                            ]
                        }
                    ]
                },
                inputs: [
                    {expected: false, context: {depth: -2, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: -1, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 0, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 1, url: 'http://example.com/'}},
                    {expected: true,  context: {depth: 2, url: 'http://example.com/'}},
                    {expected: false, context: {depth: 3, url: 'http://example.com/'}}
                ]
            }
        ];

        test.each(data)('schemas-test-%#', ({conditionGroups, expectedSchema, inputs}) => {
            const profileConditionsUtil = new ProfileConditionsUtil();
            const schema = profileConditionsUtil.createSchema(conditionGroups);
            if (typeof expectedSchema !== 'undefined') {
                expect(schema.schema).toStrictEqual(expectedSchema);
            }
            if (Array.isArray(inputs)) {
                for (const {expected, context} of inputs) {
                    const normalizedContext = profileConditionsUtil.normalizeContext(context);
                    const actual = schema.isValid(normalizedContext);
                    expect(actual).toStrictEqual(expected);
                }
            }
        });
    });
}


/** */
function main() {
    testNormalizeContext();
    testSchemas();
}

main();

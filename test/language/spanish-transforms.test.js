/*
 * Copyright (C) 2024  Yomitan Authors
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

import {spanishTransforms} from '../../ext/js/language/es/spanish-transforms.js';
import {LanguageTransformer} from '../../ext/js/language/language-transformer.js';
import {testLanguageTransformer} from '../fixtures/language-transformer-test.js';

const tests = [
    {
        category: 'nouns',
        tests: [
            {reasons: ['plural'], rule: 'ns', source: 'gatos', term: 'gato'},
            {reasons: ['plural'], rule: 'ns', source: 'sofás', term: 'sofá'},
            {reasons: ['plural'], rule: 'ns', source: 'tisús', term: 'tisú'},
            {reasons: ['plural'], rule: 'ns', source: 'tisúes', term: 'tisú'},
            {reasons: ['plural'], rule: 'ns', source: 'autobuses', term: 'autobús'},
            {reasons: ['plural'], rule: 'ns', source: 'ciudades', term: 'ciudad'},
            {reasons: ['plural'], rule: 'ns', source: 'clics', term: 'clic'},
            {reasons: ['plural'], rule: 'ns', source: 'síes', term: 'sí'},
            {reasons: ['plural'], rule: 'ns', source: 'zigzags', term: 'zigzag'},
            {reasons: ['plural'], rule: 'ns', source: 'luces', term: 'luz'},
            {reasons: ['plural'], rule: 'ns', source: 'canciones', term: 'canción'},
        ],
        valid: true,
    },
    {
        category: 'feminine adjectives',
        tests: [
            {reasons: ['feminine adjective'], rule: 'adj', source: 'roja', term: 'rojo'},
        ],
        valid: true,
    },
    {
        category: 'present indicative verbs',
        tests: [
            {reasons: ['present indicative'], rule: 'v', source: 'hablo', term: 'hablar'},
            {reasons: ['present indicative'], rule: 'v', source: 'hablas', term: 'hablar'},
            {reasons: ['present indicative'], rule: 'v', source: 'habla', term: 'hablar'},
            {reasons: ['present indicative'], rule: 'v', source: 'hablamos', term: 'hablar'},
            {reasons: ['present indicative'], rule: 'v', source: 'habláis', term: 'hablar'},
            {reasons: ['present indicative'], rule: 'v', source: 'hablan', term: 'hablar'},
            {reasons: ['present indicative'], rule: 'v', source: 'como', term: 'comer'},
            {reasons: ['present indicative'], rule: 'v', source: 'comes', term: 'comer'},
            {reasons: ['present indicative'], rule: 'v', source: 'come', term: 'comer'},
            {reasons: ['present indicative'], rule: 'v', source: 'comemos', term: 'comer'},
            {reasons: ['present indicative'], rule: 'v', source: 'coméis', term: 'comer'},
            {reasons: ['present indicative'], rule: 'v', source: 'comen', term: 'comer'},
            {reasons: ['present indicative'], rule: 'v', source: 'vivo', term: 'vivir'},
            {reasons: ['present indicative'], rule: 'v', source: 'vives', term: 'vivir'},
            {reasons: ['present indicative'], rule: 'v', source: 'vive', term: 'vivir'},
            {reasons: ['present indicative'], rule: 'v', source: 'vivimos', term: 'vivir'},
            {reasons: ['present indicative'], rule: 'v', source: 'vivís', term: 'vivir'},
            {reasons: ['present indicative'], rule: 'v', source: 'viven', term: 'vivir'},
            {reasons: ['present indicative'], rule: 'v', source: 'tengo', term: 'tener'},
            {reasons: ['present indicative'], rule: 'v', source: 'tienes', term: 'tener'},
            {reasons: ['present indicative'], rule: 'v', source: 'tiene', term: 'tener'},
            {reasons: ['present indicative'], rule: 'v', source: 'tenemos', term: 'tener'},
            {reasons: ['present indicative'], rule: 'v', source: 'tenéis', term: 'tener'},
            {reasons: ['present indicative'], rule: 'v', source: 'tienen', term: 'tener'},
            {reasons: ['present indicative'], rule: 'v', source: 'exijo', term: 'exigir'},
            {reasons: ['present indicative'], rule: 'v', source: 'extingo', term: 'extinguir'},
            {reasons: ['present indicative'], rule: 'v', source: 'escojo', term: 'escoger'},
            {reasons: ['present indicative'], rule: 'v', source: 'quepo', term: 'caber'},
            {reasons: ['present indicative'], rule: 'v', source: 'caigo', term: 'caer'},
            {reasons: ['present indicative'], rule: 'v', source: 'conozco', term: 'conocer'},
            {reasons: ['present indicative'], rule: 'v', source: 'doy', term: 'dar'},
            {reasons: ['present indicative'], rule: 'v', source: 'hago', term: 'hacer'},
            {reasons: ['present indicative'], rule: 'v', source: 'pongo', term: 'poner'},
            {reasons: ['present indicative'], rule: 'v', source: 'sé', term: 'saber'},
            {reasons: ['present indicative'], rule: 'v', source: 'salgo', term: 'salir'},
            {reasons: ['present indicative'], rule: 'v', source: 'traduzco', term: 'traducir'},
            {reasons: ['present indicative'], rule: 'v', source: 'traigo', term: 'traer'},
            {reasons: ['present indicative'], rule: 'v', source: 'valgo', term: 'valer'},
            {reasons: ['present indicative'], rule: 'v', source: 'veo', term: 'ver'},
            {reasons: ['present indicative'], rule: 'v', source: 'soy', term: 'ser'},
            {reasons: ['present indicative'], rule: 'v', source: 'estoy', term: 'estar'},
            {reasons: ['present indicative'], rule: 'v', source: 'voy', term: 'ir'},
            {reasons: ['present indicative'], rule: 'v', source: 'he', term: 'haber'},
        ],
        valid: true,
    },
    {
        category: 'preterite',
        tests: [
            {reasons: ['preterite'], rule: 'v', source: 'hablé', term: 'hablar'},
            {reasons: ['preterite'], rule: 'v', source: 'hablaste', term: 'hablar'},
            {reasons: ['preterite'], rule: 'v', source: 'habló', term: 'hablar'},
            {reasons: ['preterite'], rule: 'v', source: 'hablamos', term: 'hablar'},
            {reasons: ['preterite'], rule: 'v', source: 'hablasteis', term: 'hablar'},
            {reasons: ['preterite'], rule: 'v', source: 'hablaron', term: 'hablar'},
            {reasons: ['preterite'], rule: 'v', source: 'comí', term: 'comer'},
            {reasons: ['preterite'], rule: 'v', source: 'comiste', term: 'comer'},
            {reasons: ['preterite'], rule: 'v', source: 'comió', term: 'comer'},
            {reasons: ['preterite'], rule: 'v', source: 'comimos', term: 'comer'},
            {reasons: ['preterite'], rule: 'v', source: 'comisteis', term: 'comer'},
            {reasons: ['preterite'], rule: 'v', source: 'comieron', term: 'comer'},
            {reasons: ['preterite'], rule: 'v', source: 'viví', term: 'vivir'},
            {reasons: ['preterite'], rule: 'v', source: 'viviste', term: 'vivir'},
            {reasons: ['preterite'], rule: 'v', source: 'vivió', term: 'vivir'},
            {reasons: ['preterite'], rule: 'v', source: 'vivimos', term: 'vivir'},
            {reasons: ['preterite'], rule: 'v', source: 'vivisteis', term: 'vivir'},
            {reasons: ['preterite'], rule: 'v', source: 'vivieron', term: 'vivir'},
            {reasons: ['preterite'], rule: 'v', source: 'tuve', term: 'tener'},
        ],
        valid: true,
    },
    {
        category: 'imperfect',
        tests: [
            {reasons: ['imperfect'], rule: 'v', source: 'hablaba', term: 'hablar'},
            {reasons: ['imperfect'], rule: 'v', source: 'hablabas', term: 'hablar'},
            {reasons: ['imperfect'], rule: 'v', source: 'hablaba', term: 'hablar'},
            {reasons: ['imperfect'], rule: 'v', source: 'hablábamos', term: 'hablar'},
            {reasons: ['imperfect'], rule: 'v', source: 'hablabais', term: 'hablar'},
            {reasons: ['imperfect'], rule: 'v', source: 'hablaban', term: 'hablar'},
            {reasons: ['imperfect'], rule: 'v', source: 'comía', term: 'comer'},
            {reasons: ['imperfect'], rule: 'v', source: 'comías', term: 'comer'},
            {reasons: ['imperfect'], rule: 'v', source: 'comía', term: 'comer'},
            {reasons: ['imperfect'], rule: 'v', source: 'comíamos', term: 'comer'},
            {reasons: ['imperfect'], rule: 'v', source: 'comíais', term: 'comer'},
            {reasons: ['imperfect'], rule: 'v', source: 'comían', term: 'comer'},
            {reasons: ['imperfect'], rule: 'v', source: 'vivía', term: 'vivir'},
            {reasons: ['imperfect'], rule: 'v', source: 'vivías', term: 'vivir'},
            {reasons: ['imperfect'], rule: 'v', source: 'vivía', term: 'vivir'},
            {reasons: ['imperfect'], rule: 'v', source: 'vivíamos', term: 'vivir'},
            {reasons: ['imperfect'], rule: 'v', source: 'vivíais', term: 'vivir'},
            {reasons: ['imperfect'], rule: 'v', source: 'vivían', term: 'vivir'},
        ],
        valid: true,
    },
    {
        category: 'progressive',
        tests: [
            {reasons: ['progressive'], rule: 'v', source: 'hablando', term: 'hablar'},
            {reasons: ['progressive'], rule: 'v', source: 'comiendo', term: 'comer'},
            {reasons: ['progressive'], rule: 'v', source: 'viviendo', term: 'vivir'},
        ],
        valid: true,
    },
    {
        category: 'imperative',
        tests: [
            {reasons: ['imperative'], rule: 'v', source: 'habla', term: 'hablar'},
            {reasons: ['imperative'], rule: 'v', source: 'hablad', term: 'hablar'},
            {reasons: ['imperative'], rule: 'v', source: 'come', term: 'comer'},
            {reasons: ['imperative'], rule: 'v', source: 'comed', term: 'comer'},
            {reasons: ['imperative'], rule: 'v', source: 'vive', term: 'vivir'},
            {reasons: ['imperative'], rule: 'v', source: 'vivid', term: 'vivir'},
        ],
        valid: true,
    },
    {
        category: 'conditional',
        tests: [
            {reasons: ['conditional'], rule: 'v', source: 'hablaría', term: 'hablar'},
            {reasons: ['conditional'], rule: 'v', source: 'hablarías', term: 'hablar'},
            {reasons: ['conditional'], rule: 'v', source: 'hablaría', term: 'hablar'},
            {reasons: ['conditional'], rule: 'v', source: 'hablaríamos', term: 'hablar'},
            {reasons: ['conditional'], rule: 'v', source: 'hablaríais', term: 'hablar'},
            {reasons: ['conditional'], rule: 'v', source: 'hablarían', term: 'hablar'},
            {reasons: ['conditional'], rule: 'v', source: 'comería', term: 'comer'},
            {reasons: ['conditional'], rule: 'v', source: 'comerías', term: 'comer'},
            {reasons: ['conditional'], rule: 'v', source: 'comería', term: 'comer'},
            {reasons: ['conditional'], rule: 'v', source: 'comeríamos', term: 'comer'},
            {reasons: ['conditional'], rule: 'v', source: 'comeríais', term: 'comer'},
            {reasons: ['conditional'], rule: 'v', source: 'comerían', term: 'comer'},
            {reasons: ['conditional'], rule: 'v', source: 'viviría', term: 'vivir'},
            {reasons: ['conditional'], rule: 'v', source: 'vivirías', term: 'vivir'},
            {reasons: ['conditional'], rule: 'v', source: 'viviría', term: 'vivir'},
            {reasons: ['conditional'], rule: 'v', source: 'viviríamos', term: 'vivir'},
            {reasons: ['conditional'], rule: 'v', source: 'viviríais', term: 'vivir'},
            {reasons: ['conditional'], rule: 'v', source: 'vivirían', term: 'vivir'},
        ],
        valid: true,
    },
    {
        category: 'future',
        tests: [
            {reasons: ['future'], rule: 'v', source: 'hablaré', term: 'hablar'},
            {reasons: ['future'], rule: 'v', source: 'hablarás', term: 'hablar'},
            {reasons: ['future'], rule: 'v', source: 'hablará', term: 'hablar'},
            {reasons: ['future'], rule: 'v', source: 'hablaremos', term: 'hablar'},
            {reasons: ['future'], rule: 'v', source: 'hablaréis', term: 'hablar'},
            {reasons: ['future'], rule: 'v', source: 'hablarán', term: 'hablar'},
            {reasons: ['future'], rule: 'v', source: 'comeré', term: 'comer'},
            {reasons: ['future'], rule: 'v', source: 'comerás', term: 'comer'},
            {reasons: ['future'], rule: 'v', source: 'comerá', term: 'comer'},
            {reasons: ['future'], rule: 'v', source: 'comeremos', term: 'comer'},
            {reasons: ['future'], rule: 'v', source: 'comeréis', term: 'comer'},
            {reasons: ['future'], rule: 'v', source: 'comerán', term: 'comer'},
            {reasons: ['future'], rule: 'v', source: 'viviré', term: 'vivir'},
            {reasons: ['future'], rule: 'v', source: 'vivirás', term: 'vivir'},
            {reasons: ['future'], rule: 'v', source: 'vivirá', term: 'vivir'},
            {reasons: ['future'], rule: 'v', source: 'viviremos', term: 'vivir'},
            {reasons: ['future'], rule: 'v', source: 'viviréis', term: 'vivir'},
            {reasons: ['future'], rule: 'v', source: 'vivirán', term: 'vivir'},
        ],
        valid: true,
    },
    {
        category: 'present subjunctive',
        tests: [
            {reasons: ['present subjunctive'], rule: 'v', source: 'hable', term: 'hablar'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'hables', term: 'hablar'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'hable', term: 'hablar'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'hablemos', term: 'hablar'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'habléis', term: 'hablar'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'hablen', term: 'hablar'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'coma', term: 'comer'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'comas', term: 'comer'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'coma', term: 'comer'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'comamos', term: 'comer'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'comáis', term: 'comer'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'coman', term: 'comer'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'viva', term: 'vivir'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'vivas', term: 'vivir'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'viva', term: 'vivir'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'vivamos', term: 'vivir'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'viváis', term: 'vivir'},
            {reasons: ['present subjunctive'], rule: 'v', source: 'vivan', term: 'vivir'},
        ],
        valid: true,
    },

];

const languageTransformer = new LanguageTransformer();
languageTransformer.addDescriptor(spanishTransforms);
testLanguageTransformer(languageTransformer, tests);

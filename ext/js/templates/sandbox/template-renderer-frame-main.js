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

import {AnkiTemplateRenderer} from './anki-template-renderer.js';
import {TemplateRendererFrameApi} from './template-renderer-frame-api.js';

/** Entry point. */
async function main() {
    const ankiTemplateRenderer = new AnkiTemplateRenderer();
    await ankiTemplateRenderer.prepare();
    const templateRendererFrameApi = new TemplateRendererFrameApi(ankiTemplateRenderer.templateRenderer);
    templateRendererFrameApi.prepare();
}

await main();

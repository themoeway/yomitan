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

HtmlTestUtilities.runMain(() => {
    for (const element of document.querySelectorAll('test-case')) {
        HtmlTestUtilities.setupTest(element);
    }

    const iframeWithDataUrl = document.querySelector('#iframe-with-data-url');
    const src = HtmlTestUtilities.getIframeSrc(iframeWithDataUrl);
    const iframeWithBlobUrl = document.querySelector('#iframe-with-blob-url');
    if (iframeWithBlobUrl instanceof HTMLIFrameElement) {
        iframeWithBlobUrl.src = URL.createObjectURL(HtmlTestUtilities.dataUrlToBlob(src));
    }
    for (const iframeWithSrcdoc of document.querySelectorAll('.iframe-with-srcdoc')) {
        if (!(iframeWithSrcdoc instanceof HTMLIFrameElement)) { continue; }
        iframeWithSrcdoc.srcdoc = HtmlTestUtilities.dataUrlToContent(src).content;
    }
});

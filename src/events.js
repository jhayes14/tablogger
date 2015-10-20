/**
 * @license MIT
 * Copyright (c) 2015 WF Team.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * @fileoverview This script instruments the events that we want to intercept.
 */
(function() {
    // Adds a small delay to make sure tablogs module has been instantiated.
    setTimeout((function() {

        // Set the listeners for tab events.
        // FIXME: when the user creates a new tab, two events (create and update)
        // are logged and the next update is missed.
        chrome.tabs.onCreated.addListener(logOnCreatedEvent);
        chrome.tabs.onRemoved.addListener(logOnRemovedEvent);
        chrome.tabs.onUpdated.addListener(logOnUpdatedEvent);
        chrome.tabs.onActivated.addListener(logOnActivated);

        // Listen for the onLoaded event intercepted by the content script.
        chrome.runtime.onMessage.addListener(function(request, sender, sndResp) {
            if (request.event == "onLoaded") {
                logEvent(sender.tab.id, request.event)
            }
        });


        /**
         * Callback attached to the onCreated tab event.
         */
        function logOnCreatedEvent(tab) {
            logEvent(tab.id, "onCreated");
            if (!(tab.id in tablogs.TABS)) {
                tablogs.TABS[tab.id] = {};
            }
            tablogs.TABS[tab.id]['timestamp'] = Date.now();
            tablogs.TABS[tab.id]['suspend'] = false;
        }


        /**
         * Callback attached to the onRemoved tab event.
         */
        function logOnRemovedEvent(tabId, removeInfo) {
            logEvent(tabId, "onRemoved");
            delete tablogs.TABS[tabId];
        }


        /**
         * Callback attached to the onUpdated tab event.
         */
        function logOnUpdatedEvent(tabId, changeInfo, tab) {
            if (!tablogs.TABS[tabId]['suspend'] && changeInfo.url) { // if url has changed
                logEvent(tabId, "onUpdated");
            }
            if (!(tabId in tablogs.TABS)) {
                tablogs.TABS[tabId] = {};
            }
            tablogs.TABS[tabId]['timestamp'] = Date.now();
            tablogs.TABS[tabId]['suspend'] = false;
        }


        /**
         * Callback attached to the onActivated tab event.
         */
        function logOnActivated(activeInfo) {
            var id = activeInfo.tabId;
            if (!(id in tablogs.TABS)) {
                tablogs.TABS[id] = {};
            }
            tablogs.TABS[id]['timestamp'] = Date.now();
            tablogs.TABS[id]['suspend'] = false;
            chrome.tabs.get(id, function(tab) {
                if (undefined != tab) {
                    if (util.isSuspended(tab)) {
                        chrome.tabs.sendMessage(id, {
                            action: 'reloadTab'
                        }, {});
                    }
                }
            });
            if (tablogs.LOG_ACTIVATED) {
                logEvent(id, "onActivated");
            }
        }


        /**
         * Log the event and queue it to be sent to the server.
         */
        function logEvent(tabId, name) {
            var curTs = Date.now();
            var ts = curTs - tablogs.LAST_TS;
            tablogs.LAST_TS = curTs;
            var line = [tabId, name, ts].join();
            // Log to console
            if (tablogs.DEBUG) {
                console.log("Store line: " + line);
            }
            // Log to file
            tablogs.pushRecord(tabId, name, ts);
            filesystem.write(tablogs.FILENAME, line + "\n")
            stats.parseHistoryUpdate();
        }
    }), 100);
})()
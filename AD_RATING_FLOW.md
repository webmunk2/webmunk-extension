# 📘 Ad Rating Flow Documentation

This document explains how the **ad rating feature** in the extension works, including the interaction between the background worker, content scripts, and the notification UI shown to the user.

---

## 🔹 Overview

The ad rating system is designed to:
1. Detect ads displayed in tabs.
2. Decide when to show a rating notification to the user.
3. Display a non-intrusive popup with **Yes / No** buttons.
4. Handle the user’s response and send it back to the extension for further processing.

There are three main components involved:

- **ExtensionAdsWorker (background)**
- **RateService (background)**
- **RateService (content script/worker)**

---

## 🔹 ExtensionAdsWorker (background)

- Listens for messages from content scripts.
- Manages the state of each tab (`tabData` with active ads, previous URLs, etc.).
- Detects ad content and prepares it for processing.
- On ad collection, calls **`RateService.send(tabId)`** to potentially trigger a rating request.
- Also responsible for handling redirects, clicks, and communication with external tracking services.

---

## 🔹 RateService (background)

- Keeps track of when the last rating notification was shown (`lastAdRatingTimestamp`).
- Defines a **10-minute cooldown** between notifications.
- Implements logic to determine if the extension should be uninstalled (`shouldUninstallExtension`).
- Sends a message to the tab with action:
  ```ts
  extensionAds.rateService.adRatingRequest
This message triggers the **content worker RateService** to display the UI.

---

## 🔹 RateService (content script / worker)

- Runs inside the tab where ads are detected.
- Listens for `extensionAds.rateService.adRatingRequest`.
- Dynamically builds and injects a styled **notification box** into the page.
- The notification includes:
  - A message ("Did you find this ad relevant?")
  - Two buttons: **Yes** ✅ and **No** ❌
- When the user clicks a button:
  - Removes the notification from the page.
  - Sends the user’s response back to the background via `chrome.runtime.sendMessage`.

---

## 🔹 Data Flow

1. **Ad detected** → `ExtensionAdsWorker` processes it.
2. `ExtensionAdsWorker` → calls `RateService.send(tabId)`.
3. **Background RateService** → checks cooldown and conditions.
4. If allowed → sends `adRatingRequest` message to tab.
5. **Content RateService** → renders popup with Yes/No.
6. **User response** → sent back to background for handling.

---

## 🔹 Key Features

- **Cooldown**: Ensures notifications are not shown too often.
- **Custom UI**: Notification is styled and injected into the active tab.
- **Two-way messaging**: Background and content scripts communicate through `chrome.runtime.sendMessage`.
- **Extensibility**: User feedback can be stored, tracked, or used to improve ad relevance algorithms.

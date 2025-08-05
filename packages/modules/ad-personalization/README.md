# Browser Ad Personalization Module

## Description
This module for setting up advertising personalization on designated websites: Amazon, Facebook, Instagram, YouTube, Google.

## Build Instructions
To build the module, use the following command:
```bash
npm run build:dev
```

# Event System
The module uses a message-driven architecture for communication. It listens to and emits specific events for sending and receiving information.

## Events the Module Listens to:
1. webmunkExt.popup.checkSettingsReq
Description: This event is triggered when the popup requests the module to check current ad personalization settings for a particular website.
Data:
  data: { url: string, key: string } — The URL of the site for which the personalization settings should be checked, and a key representing the strategy to use.
Action: The module processes the settings check and responds by emitting adsPersonalization.strategies.settingsResponse.

2. adsPersonalization.strategies.settingsRequest
Description: This event is triggered by the module itself once a website's page finishes loading, requesting specific ad personalization settings.
Data:
  { key: string } — The key representing the strategy for ad personalization on the current page.
Action: The module listens to the response for this request and applies the necessary settings.

## Events the Module Emits:
1. adsPersonalization.strategies.settingsResponse
Description: Emitted when the module receives the ad personalization settings from the website's content and processes them.
Data:
  response: boolean — A flag indicating whether the personalization settings were successfully applied or not.

2. ad_personalization
Description: Emitted when the module successfully completes an ad personalization task on a website.
Data:
  data: { url: string, key: string, value: boolean } — The URL of the site and whether the personalization setup was successful or not.

# Storage Keys
The module uses the following keys for storing data in chrome.storage.local:

1. adPersonalization.checkedItems
Description: Stores a mapping of URLs to boolean values indicating the personalization status for each URL.

2. adPersonalization.items
Description: Stores initial configuration data related to ad personalization settings. This data is loaded from config.json.

3. adPersonalization.invalidItems
Description: Stores a list of items that encountered errors during the personalization process, including the specific error messages for each item.
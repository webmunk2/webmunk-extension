# Ad Tracking and Cookie Saving Chrome Extension

This extension is designed for tracking ads and saving cookies. It allows you to monitor advertising elements on web pages and save cookie information for further analysis.

## Installation Instructions

1. Install dependencies:
    ```sh
    npm i
    npm i @webmunk/cookies-scraper
    npm i @webmunk/extension-ads
    npm i @webmunk/ad-personalization
    npm i @webmunk/utils
    ```

2. Start the development version with hot-reloading:
    ```sh
    npm run addon:dev:hot
    ```

3. Create the production build:
    ```sh
    npm run addon:build:prod
    ```

4. Create a zip version of the production build:
    ```sh
    npm run addon:build:prod-zip
    ```

## Module Descriptions

- `@webmunk/cookies-scraper`: Module for collecting and saving cookie information.
- `@webmunk/extension-ads`: Module for tracking advertising elements on web pages.
- `@webmunk/ad-personalization`: Module for setting up advertising personalization on designated websites.
- `@webmunk/utils`: Utility module used for various tasks within the extension.

# Event System
The extension utilizes an event-based system to manage interactions between different components. This system ensures that various parts of the extension can communicate and react to changes in a decoupled manner. Here are some of the key events used:

1. webmunkExt.popup.checkSettingsReq:
Description: Sent to the ad-personalization module when checking the personalization settings for a specific ad URL.
  Data: { url: string, key: string }

2. webmunkExt.popup.successRegister:
Description: Sent to check the privacy settings related to cookies and survey downloads on the main worker.

# Storage Keys
The module uses the following keys for storing data in chrome.storage.local:
1. adPersonalization.checkedItems
Description: Stores which ad personalization items have been checked by the user.

2. adPersonalization.items
Description: Stores the list of ad personalization items. This includes URLs, names, and keys for each ad.

## Development and Testing

For development and testing, use the command `npm run addon:dev:hot`, which will automatically generate a development build with hot-reloading. This allows you to see changes quickly without manually reloading the extension.

To create a production-ready build, use the command `npm run addon:build:prod`. This command will generate an optimized build for use in a production environment.

To create a zip archive that can be uploaded to the Chrome Web Store, use the command `npm run addon:build:prod-zip`.
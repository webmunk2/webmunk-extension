# Browser Ad Scraping Module

## Description
The extension-ads module is designed for tracking and handling advertisements across various websites in your web extension. It provides tools for detecting, processing, and managing ads within the extension environment.

## Build Instructions
To build the module, use the following command:
```bash
npm run build:dev
```

# Event System
The extension-ads module emits several important events to help manage advertisement tracking, processing, and interaction. Below is a list of the primary events that this module emits:

1. ad_detected
Description: This event is emitted when an advertisement is detected on a webpage. The detected ad data is processed and sent to the event listener.
Emitted From:
  sendAdsIfNeeded(tabId) after detecting new ads on a page.
Payload: Contains the processed ad information, including ad metadata such as title, company, text, coordinates, URLs (initial and redirected), and content.

2. ad_clicked
Description: This event is emitted when a user clicks on an advertisement. The clicked ad data, including URLs and metadata, is sent to the event listener for further handling.
Emitted From:
  _onMessage_adClicked(data, from) after processing the clicked ad data.
Payload: Contains information about the clicked ad, including the ad ID, title, company, text, URLs (initial and redirected), and other content-related data.

3. ads_rated
Description: This event is emitted after a set of advertisements is rated. The ratings result is sent along with the IDs of the rated ads.
Emitted From:
  rateAdsIfNeeded(tabId) after rating the ads for a specific tab.
Payload: Contains the rating mark and an array of ad IDs that were rated.

These events enable the extension-ads module to track, manage, and report on advertisements in real-time within the web extension environment, facilitating enhanced ad handling.
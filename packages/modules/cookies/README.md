# Browser Cookie Module

## Description
This module tracks cookies on a web page.

## Build Instructions
To build the module, use the following command:
```bash
npm run build:dev
```

# Event System
The module uses a message-driven architecture for communication. It listens to and emits specific events for sending and receiving information related to cookies.

## Events the Module Listens to:
1. webmunkExt.popup.successRegister
Description: This event is triggered to check the privacy settings related to cookies on a website.
  Data: None
Action: The module retrieves privacy settings and emits relevant data about cookie handling and privacy.
2. webmunkExt.worker.recordCookies
Description: This event is triggered to record all cookies from the browser's memory.
  Data: None
Action: The module retrieves all cookies and emits relevant data.

## License and Other Project Information

Copyright 2022-2024 The Fradkin Foundation and the President & Fellows of Harvard College

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

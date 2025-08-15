# Jitsu & BigQuery & Firebase Integration Guide

This documentation outlines the setup and usage of **Jitsu**, **BigQuery** and **Firebase** in your project.
It is intended for developers, data analysts, or researchers who want to collect, store, and process application analytics or event data.

---

## Overview

**Jitsu** is an open-source data ingestion platform that collects events from your app and sends them to data warehouses like BigQuery. It acts as a pipeline, ensuring that your analytics data flows in real time to your chosen storage.

**Google BigQuery** is a fully-managed cloud data warehouse by Google. It is designed for fast SQL queries and analysis of large datasets. In this integration, BigQuery will store and make queryable the raw events received via Jitsu.

**Firebase** is a backend-as-a-service platform from Google. It provides tools like authentication, Firestore database, hosting, Remote Config, and serverless functions. In this integration, Firebase is used to store user and survey configuration data, and to manage application settings.

---

## How They Work Together

1. **Your app** sends analytics events to **Jitsu** via its JavaScript SDK.
2. **Jitsu** forwards those events to **BigQuery** (and potentially other destinations).
3. **BigQuery** stores those events in structured datasets for analysis.
4. **Firebase** provides application configuration, storage, and user-related data that can complement your event analytics in BigQuery.

---

## Jitsu Setup

In this setup, Jitsu will collect app events and store them in BigQuery for analysis.

### 1. Deploy Jitsu via Elestio

1. Go to [https://elest.io](https://elest.io) and sign in or create an account.
2. Create a new project.
3. Select **Jitsu** as the service during project setup.
4. Provide any necessary configuration parameters (e.g., project name, region, authentication).
5. Once deployed, you’ll get access to the Jitsu web interface.

---

### 2. Configure Destination (BigQuery)

1. Open the Jitsu dashboard from your Elestio deployment.
2. Go to **Overview** and click **Add Destination**.
3. Choose **BigQuery** as the destination type.
4. Fill in the required fields:
   - **Project ID** – your Google Cloud project ID
   - **Dataset Name** – the BigQuery dataset where events will be stored
   - **GCP Credentials** – upload or paste your Service Account JSON key
5. Save the destination configuration.

---

### 3. Set Up Source (Website or App)

1. In the Jitsu dashboard, go to **Overview** and click **Add Source**.
2. Choose **JavaScript SDK (Browser)** or other appropriate type.
3. Jitsu will generate a **Write Key** for this source.
4. Copy the **Write Key** and **Ingest URL** – you’ll need them for SDK integration.

---

### 4. Integrate Jitsu in Your Codebase

1. Install the package:
    ```bash
    npm install @jitsu/js
    ```

2. Import and configure the service in your project:
    ```typescript
    import { jitsuAnalytics } from "@jitsu/js";
    import { JITSU_WRITE_KEY, JITSU_INGEST_URL } from "../config";

    this.client = jitsuAnalytics({
      writeKey: JITSU_WRITE_KEY,
      host: JITSU_INGEST_URL,
    });
    ```

---

### 5. Track Events

Use the following example method to track events:

```typescript
async track<T>(event: string, properties: T): Promise<void> {
  return new Promise((resolve, reject) => {
    this.client.track(
      { event, properties },
      (error, data) => (error ? reject(error) : resolve(data))
    );
  });
}
```

---

## BigQuery Setup

In this setup, BigQuery is the main destination where Jitsu sends event data for storage and querying.

### 1. Sign Up or Log in for Google Cloud Platform (GCP)

1. Go to [Google Cloud Platform](https://cloud.google.com/) and log in or create an account.

---

### 2. Create a New Project

1. Navigate to the GCP dashboard.
2. Click on `Select a project` or `Create Project`.
3. Choose your organization and name the project, then click `Create`.

**Once the project is created, you can:**
- Access and manage various GCP services.
- Assign resources to this project.

---

### 3. Create Bucket storage

1. From the GCP dashboard, navigate to `Cloud Storage` then to `Buckets` by searching for it in the search bar or finding it in the menu.

**In the Buckets UI, you need:**
- Create bucket to store data before loading into BigQuery(it's for RudderStack configuration)

---

### 4. BigQuery

1. From the GCP dashboard, navigate to `BigQuery` by searching for it in the search bar or finding it in the menu.

**In the BigQuery UI, you can:**
- View your data and query results.
- Manage datasets and tables.

### 5. Credentials

1. From the GCP dashboard, navigate to `APIs & Services` then to `Credentials` by searching for it in the search bar or finding it in the menu.

**In the Credentials UI, you need:**
- Click on the `Create Credentials` button and select `Service Account`.
- After account created, go to the `Keys` tab and click on `Add key` button.
- After key added, you will retrieve a json file, the contents of which must be entered in the Credentials field when configuring on RudderStack.

---

### 6. Assign Roles to the Service Account

1. From the GCP dashboard, navigate to `IAM & Admin`  by searching for it in the search bar or finding it in the menu.

**In the IAM UI, you need:**
- Find and select the created Service Account.
- Ensure it has the following roles: `BigQuery Job User`, `BigQuery Data Owner`, `Storage Object Creator`, `Storage Object Viewer`.
- If any role is missing, click Edit and add the required roles.

---

## Firebase Setup

In this integration, **Firebase** is used for:

- **Storing user data** (via Firestore)
- **Managing survey configurations** (via Remote Config)
- **Hosting functions for app logic**

### 1. Create an Account

1. Log in to **Firebase Console** or create an account if you don’t have one.
2. Create a new Firebase project.

**To manage your Firebase project settings:**
- Navigate to `Project Settings` by clicking the gear icon in the top left corner.

---

### 2. Set Up Firestore Database

1. Go to **Firestore Database** in your Firebase dashboard.
2. Click on `Create Database` and follow the prompts to set up your Firestore database.
3. Configure database rules for security and access control.

**Firestore Database will be used to store user data.**

---

### 3. Set Up Remote Config

1. Navigate to **Remote Config** in the Firebase console.
2. Click on `Create Configuration` and define parameters for surveys and other settings you need.

**Remote Config will be used to store survey configurations.**

---

### 4. Set Up Firebase Functions

1. Navigate to **Functions** in your Firebase dashboard.
2. Create a new function that triggers your authentication flow (e.g., sign-in). This function can be hosted on **Google Cloud Run** for scalability.

**Example Firebase Function (TypeScript):**

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const signInTrigger = functions.https.onRequest((req, res) => {
  // Your sign-in logic here
  res.send('Sign-in triggered');
});
```

---

### 5. Obtain Firebase Environment Variables

To connect your application to Firebase, you need the following environment variables:

- **FIREBASE_API_KEY**.
- **FIREBASE_PROJECT_ID**.
- **FIREBASE_MESSAGING_SENDER_ID**.
- **FIREBASE_APP_ID**.

All of these values you can find in Project Settings.

---

### 6. Install Firebase SDK

To integrate Firebase with your project, install the Firebase SDK:

```bash
npm install firebase
```

---

### 7. Configure Firebase in Your Project

Create a `firebaseConfig.ts` file and add the following code:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "Your api key",
  authDomain: "Your auth domain",
  projectId: "Your project id",
  storageBucket: "Your storage bucket",
  messagingSenderId: "Your messaging sender id",
  appId: "Your app id",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
```

---

### 8. Load Data from Remote Config

```typescript
import { getValue } from 'firebase/remote-config';

async function fetchSurveyConfig() {
  const surveyParam = await getValue(remoteConfig, 'survey_config');
  console.log('Survey Config:', surveyParam.asString());
}

fetchSurveyConfig();
```

---

## Documentation

[Jitsu API](https://classic.jitsu.com/docs)

[BigQuery API](https://cloud.google.com/bigquery/docs/reference/rest)

[Firebase API](https://firebase.google.com/docs/reference)

---
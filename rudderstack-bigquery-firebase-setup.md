# RudderStack & BigQuery & Firebase Integration Guide

This documentation outlines the setup and usage of **RudderStack**, **BigQuery** and **Firebase** in your project.

---

## RudderStack Setup

### 1. Create an Account

1. Log in to **RudderStack Cloud** or create an account if you don’t have one.
2. Once signed up, your email will be associated with a top-level **organization account**.

**To view and manage organization settings:**
- Navigate to `Settings > Organization` in your RudderStack dashboard.

---

### 2. Set Up Source

1. Go to **Sources** in your dashboard and click `Add Source`.
2. Select a source type and assign it a name.
3. Complete the setup by clicking `Continue`.

**Once the source is set up, you’ll have access to:**
- **Live Events**: View live events from the source.
- **Setup Options**: Includes the installation snippet and the required write key for your source.

---

### 3. Set Up Destination

1. Go to **Destinations** and click `Add Destination`.
2. Select a destination type, assign a name, and click `Continue`.
3. Connect the destination to a source and configure the relevant connection settings.
4. (Optional) Add transformations by clicking `Create New Transformation`.
5. Finish the setup by clicking `Continue`.

**After setup, you’ll see:**
- **Live Events**: Monitor live event flows to the destination.
- **Sources**: Displays connected sources and allows adding new ones.
- **Metrics**: View delivery-related metrics, including delivered and failed events.

---

### 3.1 Configuring the Destination for BigQuery

1. **Navigate to BigQuery Destination**: Select BigQuery as your destination type in the RudderStack dashboard.
2. **Connect Source to BigQuery**:
   - Choose the source that will send data to BigQuery.
   - Configure the connection by providing necessary authentication details and project information.
3. **Configuration fields**:
   - Project (Project ID where your BigQuery database is located)
   - Staging GCS Storage Bucket Name (Bucket to store data before loading into BigQuery)
   - Namespace (Schema name for the warehouse where the tables are created)
   - Credentials (GCP Service Account credentials JSON for RudderStack to use in loading data into your BigQuery database)

---

### 4. Install RudderStack Service

1. Install the package:
    ```bash
    npm install @rudderstack/analytics-js-service-worker
    ```

2. Import and configure the service in your project:
    ```typescript
    import { Analytics } from '@rudderstack/analytics-js-service-worker';

    const client = new Analytics(RUDDERSTACK_WRITE_KEY, RUDDERSTACK_DATA_PLANE);
    ```

---

### 5. Track Events

Use the following example method to track events:

```typescript
async track<T>(event: string, properties: T): Promise<void> {
  return new Promise((resolve, reject) => {
    client.track(
      { event, properties },
      (error, data) => (error ? reject(error) : resolve(data))
    );
  });
}
```

---

## BigQuery Setup

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

[RudderStack API](https://www.rudderstack.com/docs/api/)

[BigQuery API](https://cloud.google.com/bigquery/docs/reference/rest)

[Firebase API](https://firebase.google.com/docs/reference)

---
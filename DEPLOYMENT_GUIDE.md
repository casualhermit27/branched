# Deployment Guide: MongoDB Atlas & Google Cloud Platform

This guide covers migrating your local MongoDB data to MongoDB Atlas and deploying the application to Google Cloud Run.

## Part 1: MongoDB Atlas Migration

1.  **Create an Account & Cluster**:
    *   Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up.
    *   Create a new **Cluster** (the free Shared tier is fine for starting).
    *   Select **Google Cloud** as the provider and a region close to your users (e.g., `us-central1` / Iowa).

2.  **Configure Security**:
    *   **Database Access**: Create a database user (e.g., `admin`) with a strong password. Note these down.
    *   **Network Access**: Add IP Address `0.0.0.0/0` to allow access from anywhere (required for Cloud Run unless using VPC peering).

3.  **Get Connection String**:
    *   Click **Connect** > **Drivers**.
    *   Copy the connection string. It looks like:
        `mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority`
    *   Replace `<username>` and `<password>` with your credentials.

4.  **Migrate Local Data (Optional)**:
    *   If you have local data you want to keep, use `mongodump` and `mongorestore`.
    *   Export local: `mongodump --uri="mongodb://localhost:27017/ai-conversation-canvas" --out=./backup`
    *   Import to Atlas: `mongorestore --uri="<your-atlas-connection-string>" ./backup/ai-conversation-canvas`

## Part 2: Google Cloud Platform (GCP) Deployment

### Prerequisites
*   [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and initialized (`gcloud init`).
*   A Google Cloud Project created.
*   Billing enabled for the project.

### Deployment Steps

1.  **Enable Required APIs**:
    Run the following commands in your terminal:
    ```bash
    gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com
    ```

2.  **Set Project ID**:
    ```bash
    gcloud config set project [YOUR_PROJECT_ID]
    ```

3.  **Deploy using Cloud Build**:
    We have included a `cloudbuild.yaml` file. You can deploy directly with:
    ```bash
    gcloud builds submit --config cloudbuild.yaml .
    ```
    *This will build your Docker image, push it to Google Container Registry, and deploy it to Cloud Run.*

4.  **Configure Environment Variables**:
    Once the service is deployed (it might fail initially due to missing env vars), go to the [Cloud Run Console](https://console.cloud.google.com/run).
    *   Click on your service `ai-conversation-canvas`.
    *   Click **Edit & Deploy New Revision**.
    *   Go to the **Variables & Secrets** tab.
    *   Add the following Environment Variables:
        *   `MONGODB_URI`: Your Atlas connection string.
        *   `NEXT_PUBLIC_MISTRAL_API_KEY`: Your Mistral key.
        *   `NEXT_PUBLIC_GEMINI_API_KEY`: Your Gemini key.
        *   `NEXT_PUBLIC_OPENAI_API_KEY`: Your OpenAI key.
        *   `NEXT_PUBLIC_ANTHROPIC_API_KEY`: Your Anthropic key.
        *   `NEXT_PUBLIC_XAI_API_KEY`: Your xAI key.
    *   Click **Deploy**.

### Verification
*   Once deployed, Cloud Run will provide a URL (e.g., `https://ai-conversation-canvas-xyz-uc.a.run.app`).
*   Visit the URL to verify the application is running and connected to MongoDB Atlas.

## Troubleshooting
*   **Build Fails**: Check the Cloud Build logs in the GCP Console.
*   **Application Error**: Check the Cloud Run logs. Common issues are invalid API keys or MongoDB connection strings.
*   **Cold Starts**: Cloud Run scales to zero by default. The first request might take a few seconds. You can set "Minimum instances" to 1 to avoid this (costs more).

## Part 3: Local / New Machine Setup with Docker

To set up the project on a fresh machine using Docker, follow these steps:

1.  **Install Docker**:
    *   Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for your operating system.
    *   Ensure Docker is running.

2.  **Clone the Repository**:
    ```bash
    git clone <your-repo-url>
    cd branched
    ```

3.  **Configure Environment (Optional)**:
    *   Create a `.env` file in the root directory.
    *   If you want to use a **local database**, you don't need to add anything (it defaults to the internal Docker container).
    *   If you want to use **MongoDB Atlas**, add:
        ```env
        MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/ai-conversation-canvas?appName=Cluster0
        MONGODB_DB_NAME=ai-conversation-canvas
        ```
    *   Add your AI API keys if needed:
        ```env
        NEXT_PUBLIC_OPENAI_API_KEY=sk-...
        NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-...
        # ... other keys
        ```

4.  **Run with Docker Compose**:
    *   This command will build the application and start both the app and the database (if local).
    ```bash
    docker-compose up --build
    ```

5.  **Access the Application**:
    *   Open your browser and go to `http://localhost:3000`.
    *   The application is now running with hot-reloading enabled (if configured in compose) or in production mode depending on the Dockerfile target.

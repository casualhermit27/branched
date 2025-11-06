# Environment Setup for AI Models & MongoDB

This document explains how to set up the environment variables for Mistral and Gemini AI models, plus MongoDB integration.

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ai-conversation-canvas

# Mistral API Configuration
NEXT_PUBLIC_MISTRAL_API_KEY=your_mistral_api_key_here
NEXT_PUBLIC_MISTRAL_API_URL=https://api.mistral.ai/v1/chat/completions
NEXT_PUBLIC_MISTRAL_MODEL=mistral-large-latest

# Gemini API Configuration
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent
NEXT_PUBLIC_GEMINI_MODEL=models/gemini-2.0-flash-exp
```

## MongoDB Setup Instructions

1. **Install MongoDB**: 
   - macOS: `brew install mongodb-community`
   - Ubuntu: `sudo apt install mongodb`
   - Windows: Download from [MongoDB website](https://www.mongodb.com/try/download/community)

2. **Start MongoDB**:
   ```bash
   # macOS with Homebrew
   brew services start mongodb-community
   
   # Ubuntu
   sudo systemctl start mongod
   
   # Windows
   net start MongoDB
   ```

3. **Verify MongoDB is running**:
   ```bash
   mongosh
   # Should connect to MongoDB shell
   ```

4. **Create database** (optional - will be created automatically):
   ```bash
   use ai-conversation-canvas
   ```

## Features Saved to MongoDB

- ✅ **Conversations**: Complete conversation history
- ✅ **Messages**: All user and AI messages with metadata
- ✅ **Branches**: Individual branch conversations and their state
- ✅ **AI Models**: Selected AI models and configurations
- ✅ **Multi-Model Mode**: Single/Multi mode state per conversation
- ✅ **Context Links**: Connections between branches
- ✅ **UI State**: Collapsed/minimized nodes, active states
- ✅ **Viewport**: Zoom and pan positions
- ✅ **Timestamps**: Created and updated timestamps
- ✅ **Auto-Save**: Automatic saving every 2 seconds
- ✅ **Manual Save**: Save/Load/Delete operations

## Getting API Keys

### Mistral API Key

1. Go to [Mistral AI Console](https://console.mistral.ai/)
2. Sign up or log in to your account
3. Navigate to the API Keys section
4. Create a new API key
5. Copy the key and paste it as `NEXT_PUBLIC_MISTRAL_API_KEY`

### Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click on "Get API Key" in the left sidebar
4. Create a new API key
5. Copy the key and paste it as `NEXT_PUBLIC_GEMINI_API_KEY`

## Model Configuration

### Mistral Models
- **mistral-large-latest**: Latest Mistral Large model (recommended)
- **mistral-medium-latest**: Mistral Medium model
- **mistral-small-latest**: Mistral Small model

### Gemini Models
- **gemini-2.0-flash-exp**: Gemini 2.0 Flash Experimental (recommended)
- **gemini-1.5-pro**: Gemini 1.5 Pro
- **gemini-1.5-flash**: Gemini 1.5 Flash

## Features

### Context Awareness
- Both models receive conversation history for context
- Last 10 messages are included in the context
- System prompts provide guidance for helpful responses

### Streaming Support
- Mistral: Native streaming support
- Gemini: Simulated streaming for better UX

### Error Handling
- Graceful fallback when API keys are not configured
- Error messages displayed to users
- Console logging for debugging

### Multi-Model Support
- Select multiple AIs for side-by-side comparison
- Each model processes the same input independently
- Responses appear with staggered timing for visual effect

## Usage

1. Set up your environment variables
2. Restart your development server
3. Select Mistral or Gemini from the AI pills
4. Send messages to see real AI responses
5. Use multi-model mode to compare different AI responses

## Troubleshooting

### API Key Issues
- Ensure API keys are correctly set in `.env.local`
- Check that keys have proper permissions
- Verify the keys are active and not expired

### Model Availability
- Check if the selected model is available in your region
- Verify API quotas and limits
- Check console for specific error messages

### Network Issues
- Ensure stable internet connection
- Check if your firewall blocks API requests
- Verify API endpoints are accessible

## Security Notes

- Never commit `.env.local` to version control
- Use environment variables for production deployments
- Regularly rotate API keys
- Monitor API usage and costs

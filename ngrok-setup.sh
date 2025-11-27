#!/bin/bash
# Quick setup script for ngrok

echo "🚀 Setting up ngrok for OSKILIFTS..."
echo ""
echo "Step 1: Sign up for free ngrok account:"
echo "   https://dashboard.ngrok.com/signup"
echo ""
echo "Step 2: Get your authtoken:"
echo "   https://dashboard.ngrok.com/get-started/your-authtoken"
echo ""
read -p "Enter your ngrok authtoken: " AUTHTOKEN

if [ -z "$AUTHTOKEN" ]; then
  echo "❌ No authtoken provided. Exiting."
  exit 1
fi

# Configure ngrok
ngrok config add-authtoken "$AUTHTOKEN"

echo ""
echo "✅ ngrok configured!"
echo ""
echo "Now starting ngrok tunnel..."
echo "Your API will be available at the URL shown below."
echo ""

# Start ngrok
ngrok http 4000


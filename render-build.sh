#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install dependencies
npm install
# npm run build # Uncomment if you have a build step

# Create the Puppeteer cache directory if it doesn't exist
mkdir -p $PUPPETEER_CACHE_DIR

# Store/pull Puppeteer cache with build cache
if [[ -d $XDG_CACHE_HOME/puppeteer ]]; then 
  echo "...Copying Puppeteer Cache from Build Cache" 
  cp -R $XDG_CACHE_HOME/puppeteer/ $PUPPETEER_CACHE_DIR
else 
  echo "...No Puppeteer Cache found in Build Cache. Initializing new cache."
fi

# Run Puppeteer to populate the cache (if needed)
node -e "require('puppeteer').launch().then(browser => browser.close())"

# Store the Puppeteer cache in the build cache
echo "...Storing Puppeteer Cache in Build Cache" 
mkdir -p $XDG_CACHE_HOME/puppeteer
cp -R $PUPPETEER_CACHE_DIR $XDG_CACHE_HOME/puppeteer
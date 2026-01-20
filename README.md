# Image Deleter

A React Native app built with Expo that helps you quickly review and delete unwanted photos from your device. Swipe through your photo library, keep the ones you want, and delete the rest with ease.

## Features

- **Swipe Interface**: Swipe left to delete, swipe right to keep photos
- **Multiple Filter Options**:
  - View all photos
  - Filter by month/year
  - Filter by year
  - Filter by recent days (7, 30, 90, 365)
  - Filter by favorites
- **Photo Import**: Import additional photos from your device
- **Batch Deletion**: Queue multiple photos for deletion and delete them all at once
- **Random Navigation**: Jump to a random photo in your filtered collection
- **Modern UI**: Clean, dark-themed interface optimized for photo review

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (install globally with `npm install -g expo-cli`)
- [Expo Go](https://expo.dev/client) app on your iOS or Android device (for testing)

## Installation

1. **Clone or download this repository**

2. **Navigate to the project directory**
   ```bash
   cd "Image Deleter"
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

## Usage

### Running the App

1. **Start the Expo development server**
   ```bash
   npm start
   ```
   This will open the Expo DevTools in your browser.

2. **Run on your device**:
   - **iOS**: Press `i` in the terminal or scan the QR code with your iPhone camera
   - **Android**: Press `a` in the terminal or scan the QR code with the Expo Go app
   - **Web**: Press `w` in the terminal (note: photo deletion features require native device access)

### How to Use

1. **Grant Permissions**: When you first open the app, you'll be prompted to grant photo library access. Allow full access to enable photo deletion.

2. **Filter Photos**: Use the filter buttons at the top to narrow down which photos you want to review:
   - **All**: View all photos
   - **Month / Year**: Select a specific month
   - **Year**: Select a specific year
   - **Recent**: View photos from the last 7, 30, 90, or 365 days
   - **Favorites**: View only your favorited photos

3. **Review Photos**:
   - **Swipe Right**: Keep the photo (it will be hidden from the current session)
   - **Swipe Left**: Delete the photo (adds it to the deletion queue)
   - **Use Buttons**: Tap "Keep" or "Delete" buttons at the bottom
   - **Random**: Tap "Random" to jump to a random photo in your filtered collection

4. **Import Photos**: Tap "Import Photos" to add additional photos from your device to review.

5. **Execute Deletions**: When you're ready, tap the "Delete X Photos" button at the bottom to permanently delete all queued photos. You'll need to grant full photo library access if you haven't already.

### Permissions

The app requires the following permissions:

- **Photo Library Access**: To read and display your photos
- **Full Photo Library Access** (iOS): To delete photos from your library

If you only grant limited access, you can still review photos but will need to grant full access to delete them.

## Available Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Start the app on an Android device/emulator
- `npm run ios` - Start the app on an iOS device/simulator
- `npm run web` - Start the app in a web browser (limited functionality)

## Technology Stack

- **React Native** - Mobile app framework
- **Expo** - Development platform and toolchain
- **expo-image** - Optimized image component
- **expo-image-picker** - Photo selection functionality
- **expo-media-library** - Access to device photo library

## Notes

- Photos are permanently deleted from your device. Make sure you want to delete them before confirming.
- The app loads up to 10,000 photos (50 pages × 200 photos per page) by default.
- Imported photos cannot be deleted through the app (they're added for review only).
- For best results, use the app on a physical device rather than a simulator/emulator.

## Troubleshooting

- **Photos not loading**: Ensure you've granted photo library permissions in your device settings.
- **Can't delete photos**: Make sure you've granted full photo library access (not just limited access) in your device settings.
- **App crashes**: Try clearing the Expo cache with `expo start -c` or restart the development server.

## License

This project is private and not intended for distribution.


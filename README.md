# Personal Photo Gallery

A simple, elegant, and responsive personal photo gallery.

## Features

- **Automatic Image Optimization**: Resizes and compresses images for web display.
- **Responsive Waterfall Layout**: Adapts to different screen sizes using CSS columns.
- **Smooth Animations**: Fade-in effects and smooth transitions.
- **Image Zoom**: Uses PhotoSwipe for a rich lightbox experience with zoom and touch gestures.
- **Simple Management**: Just add images to `src/images` and rebuild.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Add Images**:
    Place your photos in `src/images`. Supported formats: JPG, PNG, WebP.

3.  **Build the Gallery**:
    ```bash
    npm run build
    ```
    This will process images and generate the `public` folder.

4.  **Development Mode**:
    ```bash
    npm run dev
    ```
    This will start a local server and watch for changes in `src`.

## Deployment

The `public` folder contains the static site. You can deploy it to GitHub Pages, Vercel, Netlify, or any static hosting service.

## Customization

- **Styles**: Edit `src/style.css` to change the look and feel.
- **Logic**: Edit `src/app.js` for custom behavior.
- **Build Config**: Edit `scripts/build.js` to change image sizes or quality.

## Credits

- [PhotoSwipe](https://photoswipe.com/) for the lightbox.
- [Sharp](https://sharp.pixelplumbing.com/) for image processing.

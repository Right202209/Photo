import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.3.8/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.3.8/dist/photoswipe.esm.js';

const gallery = document.getElementById('gallery');

// Fetch image data
fetch('data.json')
    .then(response => response.json())
    .then(rawData => {
        const galleryData = normalizeGalleryData(rawData);
        renderGallery(galleryData.images, galleryData);
        initPhotoSwipe();
    })
    .catch(error => console.error('Error loading gallery data:', error));

function normalizeGalleryData(rawData) {
    if (Array.isArray(rawData)) {
        return {
            storage: 'local',
            imageBaseUrl: '',
            images: rawData
        };
    }

    return {
        storage: rawData.storage || 'local',
        imageBaseUrl: (rawData.imageBaseUrl || '').replace(/\/+$/, ''),
        images: Array.isArray(rawData.images) ? rawData.images : []
    };
}

function resolveImageUrl(image, variant, galleryData) {
    const storageMode = galleryData.storage;
    const baseUrl = galleryData.imageBaseUrl;

    if (storageMode === 'b2-private-proxy' && baseUrl) {
        const key = variant === 'thumb'
            ? (image.thumbKey || image.thumb)
            : (image.originalKey || image.src);

        if (!key) {
            return '';
        }

        return `${baseUrl}/${String(key).replace(/^\/+/, '')}`;
    }

    return variant === 'thumb' ? image.thumb : image.src;
}

function renderGallery(images, galleryData) {
    const fragment = document.createDocumentFragment();

    images.forEach((image) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.style.backgroundColor = image.color;

        const originalUrl = resolveImageUrl(image, 'original', galleryData);
        const thumbUrl = resolveImageUrl(image, 'thumb', galleryData);

        const link = document.createElement('a');
        link.href = originalUrl;
        link.dataset.pswpWidth = String(image.width);
        link.dataset.pswpHeight = String(image.height);
        link.target = '_blank';
        link.className = 'gallery-link';

        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder';
        placeholder.style.backgroundImage = `url(${image.placeholder})`;
        placeholder.style.paddingBottom = `${(image.height / image.width) * 100}%`;

        const img = document.createElement('img');
        img.src = thumbUrl;
        img.alt = image.alt || '';
        img.loading = 'lazy';
        img.onload = () => {
            item.classList.add('loaded');
        };

        link.appendChild(placeholder);
        link.appendChild(img);
        item.appendChild(link);
        fragment.appendChild(item);
    });

    gallery.appendChild(fragment);
}

function initPhotoSwipe() {
    const lightbox = new PhotoSwipeLightbox({
        gallery: '#gallery',
        children: 'a',
        pswpModule: PhotoSwipe,
        padding: { top: 20, bottom: 20, left: 20, right: 20 },
    });

    // Add download button
    lightbox.on('uiRegister', function() {
        lightbox.pswp.ui.registerElement({
            name: 'download-button',
            order: 8,
            isButton: true,
            tagName: 'a',
            html: {
                isCustomSVG: true,
                inner: '<path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 15.8l6 6.2 6-6.2z" id="pswp__icn-download"/><path d="M4.3 4.3H30v2H4.3z" id="pswp__icn-download-top"/>',
                outlineID: 'pswp__icn-download-outline'
            },
            onInit: (el, pswp) => {
                el.setAttribute('download', '');
                el.setAttribute('target', '_blank');
                el.setAttribute('rel', 'noopener');
                el.setAttribute('title', 'Download');

                pswp.on('change', () => {
                    el.href = pswp.currSlide.data.src;
                });
            }
        });
    });

    lightbox.init();
}

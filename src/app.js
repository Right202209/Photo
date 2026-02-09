import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.3.8/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.3.8/dist/photoswipe.esm.js';

const gallery = document.getElementById('gallery');

// Fetch image data
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        renderGallery(data);
        initPhotoSwipe();
    })
    .catch(error => console.error('Error loading gallery data:', error));

function renderGallery(images) {
    const fragment = document.createDocumentFragment();

    images.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.style.backgroundColor = image.color;

        // We use a link for PhotoSwipe
        item.innerHTML = `
            <a href="${image.src}"
               data-pswp-width="${image.width}"
               data-pswp-height="${image.height}"
               target="_blank"
               class="gallery-link">
                <div class="placeholder" style="background-image: url(${image.placeholder}); padding-bottom: ${(image.height / image.width) * 100}%"></div>
                <img src="${image.thumb}"
                     alt="${image.alt || ''}"
                     loading="lazy"
                     onload="this.parentElement.parentElement.classList.add('loaded')">
            </a>
        `;

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

import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.3.8/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.3.8/dist/photoswipe.esm.js';

const gallery = document.getElementById('gallery');

const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

const applyTheme = isDarkMode => {
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
};

applyTheme(prefersDarkScheme.matches);
prefersDarkScheme.addEventListener('change', event => applyTheme(event.matches));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Header entrance — fire as early as possible, independent of image data.
if (window.gsap && !reducedMotion.matches) {
    window.gsap.from('header h1', { autoAlpha: 0, y: -24, duration: 0.8, ease: 'power3.out' });
}

// Fetch image data
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        renderGallery(data);
        initPhotoSwipe();
        initScrollReveal();
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

function initScrollReveal() {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;

    // If GSAP failed to load, the items stay on their CSS path: they reveal
    // via the `.loaded` class on image load. Nothing to do here.
    if (!gsap || !ScrollTrigger) return;

    gsap.registerPlugin(ScrollTrigger);
    // The mobile address bar showing/hiding shouldn't trigger costly re-measures.
    ScrollTrigger.config({ ignoreMobileResize: true });

    const items = gsap.utils.toArray('.gallery-item');

    // Honour reduced-motion: show everything, no movement.
    if (reducedMotion.matches) {
        gsap.set(items, { autoAlpha: 1, y: 0 });
        return;
    }

    // GSAP now owns the item entrance. Inline styles set here take precedence
    // over the stylesheet, so the CSS `.loaded` reveal stands down while present.
    // autoAlpha (opacity + visibility) also keeps off-screen items out of hit-testing.
    gsap.set(items, { autoAlpha: 0, y: 40 });

    // One batched trigger for the whole grid instead of N triggers — far less
    // work per scroll frame. `once` kills each trigger after it fires.
    ScrollTrigger.batch(items, {
        start: 'top 90%',
        once: true,
        onEnter: batch => gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            ease: 'power2.out',
            stagger: { each: 0.08, grid: 'auto', from: 'start' },
            overwrite: true
        })
    });

    // Recompute trigger positions once the CSS columns settle, and again after
    // the window load so any late layout is accounted for. Aspect-ratio boxes
    // already reserve height, so this won't cause layout shift.
    requestAnimationFrame(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
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

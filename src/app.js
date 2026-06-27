import PhotoSwipeLightbox from 'https://unpkg.com/photoswipe@5.3.8/dist/photoswipe-lightbox.esm.js';
import PhotoSwipe from 'https://unpkg.com/photoswipe@5.3.8/dist/photoswipe.esm.js';

const gallery = document.getElementById('gallery');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Header entrance follows the source site's slow fade-up rhythm.
if (window.gsap && !reducedMotion.matches) {
    window.gsap.from('.site-header__inner > *', {
        autoAlpha: 0,
        y: 120,
        duration: 1,
        ease: 'power2.out',
        stagger: 0.12
    });
}

// Fetch image data
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        renderGallery(data);
        initPhotoSwipe();
        initAnimations();
    })
    .catch(error => console.error('Error loading gallery data:', error));

// Fisher–Yates shuffle for a fresh random arrangement on every visit.
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function renderGallery(images) {
    const fragment = document.createDocumentFragment();

    // Shuffle a copy so the source data.json order is left untouched.
    const arrangement = shuffle(images.slice());

    arrangement.forEach(image => {
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

function initAnimations() {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;

    // If GSAP failed to load, items stay on their CSS path: they reveal via the
    // `.loaded` class on image load. Nothing else here runs.
    if (!gsap || !ScrollTrigger) return;

    gsap.registerPlugin(ScrollTrigger);
    // The mobile address bar showing/hiding shouldn't trigger costly re-measures.
    ScrollTrigger.config({ ignoreMobileResize: true });

    initScrollProgress(gsap);
    initGalleryReveal(gsap, ScrollTrigger);
    initHoverZoom(gsap);
}

// Top-edge bar scrubbed to scroll position — one composited transform, no layout.
function initScrollProgress(gsap) {
    const bar = document.querySelector('.scroll-progress');
    if (!bar) return;

    gsap.to(bar, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: 0.3 }
    });
}

function initGalleryReveal(gsap, ScrollTrigger) {
    const items = gsap.utils.toArray('.gallery-item');

    // Honour reduced-motion: show everything, no movement.
    if (reducedMotion.matches) {
        gsap.set(items, { autoAlpha: 1, y: 0 });
        return;
    }

    // GSAP now owns the item entrance. Inline styles set here take precedence
    // over the stylesheet, so the CSS `.loaded` reveal stands down while present.
    // autoAlpha (opacity + visibility) also keeps off-screen items out of hit-testing.
    // Per-item random offset/tilt gives the reveal an organic, scattered feel that
    // complements the randomized arrangement; each settles back to y:0, rotate:0.
    gsap.set(items, {
        autoAlpha: 0,
        y: () => gsap.utils.random(30, 70),
        rotate: () => gsap.utils.random(-2.5, 2.5)
    });

    // One batched trigger for the whole grid instead of N triggers — far less
    // work per scroll frame. `once` kills each trigger after it fires.
    ScrollTrigger.batch(items, {
        start: 'top 90%',
        once: true,
        onEnter: batch => gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            rotate: 0,
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

// Subtle zoom of the image inside its clipped tile on hover. Pointer devices
// only (no sticky zoom on touch) and disabled under reduced-motion.
function initHoverZoom(gsap) {
    if (reducedMotion.matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    // quickTo gives an interruptible, reusable tween per image; built lazily.
    const zoomers = new WeakMap();
    const zoomFor = img => {
        let setter = zoomers.get(img);
        if (!setter) {
            setter = gsap.quickTo(img, 'scale', { duration: 0.5, ease: 'power3.out' });
            zoomers.set(img, setter);
        }
        return setter;
    };

    let active = null;

    // Delegated to the gallery container — two listeners total, not two per tile.
    gallery.addEventListener('pointerover', event => {
        const item = event.target.closest('.gallery-item');
        if (!item || item === active) return;
        active = item;
        const img = item.querySelector('img');
        if (img) zoomFor(img)(1.08);
    });

    gallery.addEventListener('pointerout', event => {
        const item = event.target.closest('.gallery-item');
        if (!item) return;
        // Ignore moves that stay within the same tile.
        if (event.relatedTarget && item.contains(event.relatedTarget)) return;
        if (item === active) active = null;
        const img = item.querySelector('img');
        if (img) zoomFor(img)(1);
    });
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

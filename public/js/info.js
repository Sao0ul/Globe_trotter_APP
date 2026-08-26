/**
 * info.js — Discover Cameroon About Page
 * Handles dynamic content, interactions, and profile data
 */

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 1. PROFILE DATA (can be extended or fetched from an API)
    // ============================================================
    const profile = {
        name: 'Raoul Daril',
        title: 'Full-Stack Developer & UI/UX Designer',
        email: 'raoul.daril@example.com',
        location: 'Yaoundé, Cameroon',
        website: 'discover-cameroon.com',
        bio: `Hello! I'm Raoul Daril, a passionate Computer Science student 
              with a love for building meaningful digital experiences. 
              This project, Discover Cameroon, was created as part of my school 
              curriculum to combine my interest in tourism, technology, 
              and user-centered design.`,
        projectDescription: `Discover Cameroon is a web application designed to help 
                             users explore tourist sites, cultural landmarks, and natural 
                             wonders across Cameroon. It's built with modern web technologies 
                             and focuses on clean interfaces, geolocation, rich multimedia, 
                             and bilingual support.`,
        features: [
            { icon: 'fa-paint-brush', title: 'Modern Design', desc: 'Clean, responsive interface optimized for both desktop and mobile devices.' },
            { icon: 'fa-search', title: 'Smart Search', desc: 'Reliable and fast place search to quickly find destinations.' },
            { icon: 'fa-plus-circle', title: 'Rich Places', desc: 'Add and display tourist sites with descriptions, categories, difficulty, danger level, and estimated price.' },
            { icon: 'fa-video', title: 'Multimedia Content', desc: 'Videos, photos, and detailed information for each location.' },
            { icon: 'fa-map-marked-alt', title: 'Geolocation', desc: 'Find your current position and explore nearby places with ease.' },
            { icon: 'fa-route', title: 'Directions', desc: 'Get turn‑by‑turn directions between your location and any destination.' },
            { icon: 'fa-info-circle', title: 'Place Details', desc: 'Dedicated page with full info, location, and multimedia for each site.' },
            { icon: 'fa-language', title: 'Bilingual', desc: 'Available in both French and English for a wider audience.' }
        ],
        social: {
            github: '#',
            linkedin: '#',
            twitter: '#',
            instagram: '#'
        }
    };

    // ============================================================
    // 2. POPULATE PROFILE CARD (with fallback for missing image)
    // ============================================================
    const avatarImg = document.getElementById('profileImage');
    if (avatarImg) {
        // If the image fails to load, show initials instead
        avatarImg.addEventListener('error', function () {
            this.style.display = 'none';
            const parent = this.parentElement;
            const fallback = document.createElement('span');
            fallback.textContent = 'RD';
            fallback.style.cssText = `
                display: flex; align-items: center; justify-content: center;
                width: 100%; height: 100%; background: linear-gradient(135deg, #6c5ce7, #0984e3);
                color: white; font-size: 2.8rem; font-weight: 700; border-radius: 50%;
            `;
            parent.appendChild(fallback);
        });
    }

    // Set profile name and title (already in HTML, but we keep dynamic if needed)
    const nameEl = document.querySelector('.profile-name');
    const titleEl = document.querySelector('.profile-title');
    if (nameEl) nameEl.textContent = profile.name;
    if (titleEl) titleEl.textContent = profile.title;

    // Update info items (if they exist, otherwise we could create them)
    const infoItems = document.querySelectorAll('.profile-info-item');
    if (infoItems.length >= 4) {
        // Assuming order: graduation, location, email, website
        const locationItem = infoItems[1];
        const emailItem = infoItems[2];
        const websiteItem = infoItems[3];
        if (locationItem) locationItem.innerHTML = `<i class="fas fa-map-pin"></i> <span>${profile.location}</span>`;
        if (emailItem) emailItem.innerHTML = `<i class="fas fa-envelope"></i> <span>${profile.email}</span>`;
        if (websiteItem) websiteItem.innerHTML = `<i class="fas fa-globe"></i> <span>${profile.website}</span>`;
    }

    // Update social links
    const socialLinks = document.querySelectorAll('.profile-social a');
    if (socialLinks.length >= 4) {
        const socialKeys = ['github', 'linkedin', 'twitter', 'instagram'];
        socialLinks.forEach((link, index) => {
            if (index < socialKeys.length) {
                const key = socialKeys[index];
                if (profile.social[key]) {
                    link.href = profile.social[key];
                }
            }
        });
    }

    // ============================================================
    // 3. DYNAMICALLY RENDER FEATURES (optional, if you want JS control)
    // ============================================================
    const featuresContainer = document.querySelector('.features-grid');
    if (featuresContainer) {
        // Clear any placeholder children (keep only if we want to rebuild)
        // featuresContainer.innerHTML = '';
        // profile.features.forEach(feat => {
        //     const card = document.createElement('div');
        //     card.className = 'feature-card';
        //     card.innerHTML = `
        //         <div class="feature-icon"><i class="fas ${feat.icon}"></i></div>
        //         <h3>${feat.title}</h3>
        //         <p>${feat.desc}</p>
        //     `;
        //     featuresContainer.appendChild(card);
        // });
        // 
        // NOTE: I've left the HTML static for clarity, but you can 
        // uncomment this block to render features purely from JS.
    }

    // ============================================================
    // 4. SMOOTH SCROLL FOR INTERNAL LINKS (if any)
    // ============================================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    // ============================================================
    // 5. BACK BUTTON WITH HISTORY
    // ============================================================
    const backBtn = document.querySelector('.btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (document.referrer && document.referrer.includes(window.location.host)) {
                history.back();
            } else {
                window.location.href = this.getAttribute('href');
            }
        });
    }

    // ============================================================
    // 6. CONSOLE WELCOME (just for fun)
    // ============================================================
    console.log('%c🌍 Discover Cameroon', 'font-size: 1.4rem; font-weight: 700; color: #6c5ce7;');
    console.log(`%cBuilt with ❤️ by ${profile.name}`, 'font-size: 1rem; color: #2d3436;');
    console.log('📌 Explore Cameroon like never before!');

});
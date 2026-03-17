/* ==========================================================================
   NEXUS TECH - JavaScript Interactions
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all modules
    initNavbar();
    initScrollReveal();
    // initCountUp(); // 会社情報が変わったため一時無効化、必要に応じて復活
    initHamburger();
    initSmoothScroll();
    initVideoSound();
});

/* --------------------------------------------------------------------------
   Navigation Bar - Scroll Effects
   -------------------------------------------------------------------------- */
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        // Add/remove scrolled class
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    });
}

/* --------------------------------------------------------------------------
   Scroll Reveal Animation
   -------------------------------------------------------------------------- */
function initScrollReveal() {
    // Add reveal class to elements
    const revealElements = document.querySelectorAll(
        '.section-header, .business-card, .company-text, .company-stats, .contact-content'
    );
    
    revealElements.forEach((el, index) => {
        el.classList.add('reveal');
        // Grid delay logic for 3 columns
        // 0, 1, 2 -> row 1
        // 3, 4, 5 -> row 2
        // etc.
        // We can just use modulo 3 for a nice wave effect
        const delayClass = `reveal-delay-${(index % 3) + 1}`;
        el.classList.add(delayClass);
    });
    
    // Intersection Observer for reveal animation
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Once revealed, we don't need to observe it anymore
                revealObserver.unobserve(entry.target); 
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    document.querySelectorAll('.reveal').forEach(el => {
        revealObserver.observe(el);
    });
}

/* --------------------------------------------------------------------------
   Hamburger Menu
   -------------------------------------------------------------------------- */
function initHamburger() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (!hamburger || !navMenu) return;
    
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });
    
    // Close menu when clicking on a link
    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.classList.remove('menu-open');
        });
    });
}

/* --------------------------------------------------------------------------
   Video Sound Toggle
   -------------------------------------------------------------------------- */
function initVideoSound() {
    const video = document.getElementById('promoVideo');
    const soundBtn = document.getElementById('videoSoundBtn');
    const replayBtn = document.getElementById('videoReplayBtn');
    if (!video) return;

    if (soundBtn) {
        const iconMuted = soundBtn.querySelector('.icon-muted');
        const iconUnmuted = soundBtn.querySelector('.icon-unmuted');
        soundBtn.addEventListener('click', () => {
            if (video.muted) {
                video.muted = false;
                soundBtn.setAttribute('aria-label', '音声をオフにする');
                soundBtn.setAttribute('title', '音声をオフにする');
                iconMuted.style.display = 'none';
                iconUnmuted.style.display = '';
            } else {
                video.muted = true;
                soundBtn.setAttribute('aria-label', '音声をオンにする');
                soundBtn.setAttribute('title', '音声をオンにする');
                iconMuted.style.display = '';
                iconUnmuted.style.display = 'none';
            }
        });
    }

    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            video.currentTime = 0;
            video.play();
        });
    }
}

/* --------------------------------------------------------------------------
   Smooth Scroll
   -------------------------------------------------------------------------- */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#' || !targetId.startsWith('#')) return;

            e.preventDefault();
            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;
            
            const navbarHeight = document.querySelector('.navbar').offsetHeight;
            const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navbarHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        });
    });
}
